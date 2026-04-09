/**
 * calc-engine/index.ts
 * 공개 API — calculate(options, repo): CalcResult
 *
 * Phase 5 파이프라인:
 *   Step 0: 648903860 5일 상한 적용 (약품 목록 전처리)
 *   Step 1: 약품금액 계산 (calcDrugAmountSum)
 *   Step 2: 조제료 계산 (calcDispensingFee)
 *   Step 3: 보험요율 조회 + 산정특례 요율 결정 (determineExemptionRate)
 *   Step 4: 본인부담금 계산 (calcCopayment — 보험유형별 모듈 위임)
 *   Step 5: 648 5% 가산 후처리
 *   Step 6: 본인부담상한제 후처리 (yearlyAccumulated 제공 시)
 */

import type { CalcOptions, CalcResult, ICalcRepository, MediIllnessInfo } from './types';
import { calcDrugAmountSum } from './drug-amount';
import { calcDispensingFee } from './dispensing-fee';
import { calcCopayment } from './copayment';
import { process648Special, calcDrug648Surcharge } from './modules/special/drug-648';
import { applySafetyNet } from './modules/special/safety-net';

export type { CalcOptions, CalcResult, DrugItem, InsuRate, WageListItem, CalcStep, ICalcRepository, MediIllnessInfo }
  from './types';
export { SupabaseCalcRepository } from './supabase-repo';
export { determineSurcharge } from './surcharge';
export type { SurchargeFlags, SurchargeInput } from './surcharge';

/**
 * 약제비 계산 메인 엔트리포인트
 *
 * @param opt 계산 입력 파라미터
 * @param repo 수가 데이터 조회 리포지토리
 * @returns CalcResult
 */
export async function calculate(opt: CalcOptions, repo: ICalcRepository): Promise<CalcResult> {
  try {
    // 입력 검증
    if (!opt.dosDate || opt.dosDate.length < 8) {
      return errorResult('DosDate가 올바르지 않습니다 (yyyyMMdd 형식)');
    }
    if (!opt.drugList || opt.drugList.length === 0) {
      return errorResult('약품 목록이 비어있습니다');
    }
    if (!opt.insuCode) {
      return errorResult('보험코드가 누락되었습니다');
    }

    // ── Step 0: 648903860 특수약품 전처리 ─────────────────────────────────
    // 5일 투약 상한 적용 (약품 금액 계산 전에 처리)
    const { modifiedDrugList, sum648, surcharge648 } = process648Special(
      opt.drugList,
      opt.dosDate
    );
    // 수정된 약품 목록을 이번 계산에 사용
    const effectiveDrugList = modifiedDrugList;
    const effectiveOpt: CalcOptions = { ...opt, drugList: effectiveDrugList };

    // ── Step 1: 약품금액 계산 ────────────────────────────────────────────
    // [B-11] dosDate 전달: EXTYPE="9" 2020.03.01 날짜 분기에 사용
    const { sumInsu: sumInsuDrug, sumUser: sumUserDrug, sectionTotals } = calcDrugAmountSum(effectiveDrugList, opt.dosDate);

    // ── Step 2: 조제료 계산 ──────────────────────────────────────────────
    const { wageList, sumWage } = await calcDispensingFee(effectiveOpt, repo);

    // ── Step 3: 보험요율 조회 + 산정특례 요율 결정 ─────────────────────
    const rate = await repo.getInsuRate(opt.insuCode);

    // 산정특례 MediIllnessInfo: opt.mediIllnessInfo 우선, DB 조회 가능하면 조회
    let illnessInfo: MediIllnessInfo | undefined = opt.mediIllnessInfo;
    if (!illnessInfo && opt.mediIllness && repo.getMediIllnessInfo) {
      illnessInfo = (await repo.getMediIllnessInfo(opt.mediIllness)) ?? undefined;
    }

    if (!rate) {
      // 보험요율 조회 실패 시 기본값으로 계산
      const fallbackRate = {
        insuCode: opt.insuCode,
        rate: 30,
        sixAgeRate: 70,
        fixCost: 1000,
        mcode: 0,
        bcode: 0,
        age65_12000Less: 20,
      };
      const copay = calcCopayment(sumInsuDrug, sumWage, effectiveOpt, fallbackRate, illnessInfo, sectionTotals);
      let result = buildResult(sumInsuDrug, sumUserDrug, sumWage, wageList, copay);
      result = applyPostProcessing(result, effectiveOpt, sum648, surcharge648);
      result = { ...result, formNumber: determineFormNumber(opt.insuCode, opt.isDirectDispensing) };
      return result;
    }

    // ── Step 4: 본인부담금 계산 (보험유형별 모듈 위임) ──────────────────
    const copay = calcCopayment(sumInsuDrug, sumWage, effectiveOpt, rate, illnessInfo, sectionTotals);

    let result = buildResult(sumInsuDrug, sumUserDrug, sumWage, wageList, copay);

    // sum648 결과를 CalcResult에 기록
    if (sum648 > 0) {
      result = { ...result, sum648 };
    }

    // ── Step 5/6: 후처리 (648 가산 + 상한제) ─────────────────────────
    result = applyPostProcessing(result, effectiveOpt, sum648, surcharge648);

    // ── Step 7: 서식번호 결정 (B-6) ──────────────────────────────────
    result = {
      ...result,
      formNumber: determineFormNumber(opt.insuCode, opt.isDirectDispensing),
    };

    return result;

  } catch (e) {
    console.error('[calc-engine] calculate error:', e);
    return errorResult(e instanceof Error ? e.message : '알 수 없는 오류');
  }
}

/**
 * 후처리 체인: 648 5% 가산 + 본인부담상한제
 */
function applyPostProcessing(
  result: CalcResult,
  opt: CalcOptions,
  sum648: number,
  surcharge648: number,
): CalcResult {
  let r = { ...result };

  // ── Step 5: 648903860 5% 가산 적용 ───────────────────────────────────────
  if (sum648 > 0) {
    const drug648Result = calcDrug648Surcharge({
      options: { dosDate: opt.dosDate },
      sum648,
      bohunCode: opt.bohunCode,
    });

    if (drug648Result.applied && drug648Result.surcharge > 0) {
      r = {
        ...r,
        userPrice: r.userPrice + drug648Result.surcharge,
        sum648,
        steps: [
          ...r.steps,
          {
            title: '648903860 특수약품 5% 가산',
            formula: `round1(${sum648} × 5%) = ${drug648Result.surcharge}원 → UserPrice에 가산`,
            result: drug648Result.surcharge,
            unit: '원',
          },
        ],
      };
    } else if (surcharge648 > 0) {
      // process648Special의 사전 계산값 사용 (보훈 면제 등 미고려된 경우 보완)
      r = { ...r, sum648 };
    }
  }

  // ── Step 6: 본인부담상한제 적용 (yearlyAccumulated 제공 시) ──────────────
  if (opt.yearlyAccumulated !== undefined && opt.incomeDecile !== undefined) {
    const snResult = applySafetyNet(opt, r, opt.yearlyAccumulated, opt.incomeDecile);
    r = { ...snResult };
  }

  return r;
}

function buildResult(
  sumInsuDrug: number,
  sumUserDrug: number,
  sumWage: number,
  wageList: import('./types').WageListItem[],
  copay: import('./copayment').CopayResult
): CalcResult {
  const result: CalcResult = {
    sumInsuDrug,
    sumWage,
    // [C-9] MpvaComm 산출용: 비급여 약품 합계를 CalcResult에 보존
    // 근거: CopaymentCalculator.cs:L1207-L1208 (SumUserDrug + SumWageComm)
    sumUserDrug,
    totalPrice: copay.totalPrice,
    userPrice: copay.userPrice,
    pubPrice: copay.pubPrice,
    wageList,
    steps: [
      {
        title: '약품금액 (01항)',
        formula: '단가 × 1회투약량 × 1일투여횟수 × 총투여일수 (원미만 사사오입)',
        result: sumInsuDrug,
        unit: '원',
      },
      {
        title: '조제료 (02항)',
        formula: 'Z1000+Z2000+Z3000+Z41xx+Z5000 합계',
        result: sumWage,
        unit: '원',
      },
      ...copay.steps,
    ],
  };

  // ── 3자배분 필드 전달 (보훈 등) ──────────────────────────────────────────
  if (copay.mpvaPrice !== undefined) result.mpvaPrice = copay.mpvaPrice;
  if (copay.insuPrice !== undefined) result.insuPrice = copay.insuPrice;

  // ── B-9/B-10: GsCode, MT038 전달 ────────────────────────────────────────
  if (copay.gsCode !== undefined) result.gsCode = copay.gsCode;
  if (copay.mt038  !== undefined) result.mt038  = copay.mt038;

  // ── [B-2] 선별급여 항별 합계 + UnderUser/UnderInsu ──────────────────────
  if (copay.sumInsuDrug50 !== undefined) result.sumInsuDrug50 = copay.sumInsuDrug50;
  if (copay.sumInsuDrug80 !== undefined) result.sumInsuDrug80 = copay.sumInsuDrug80;
  if (copay.sumInsuDrug30 !== undefined) result.sumInsuDrug30 = copay.sumInsuDrug30;
  if (copay.sumInsuDrug90 !== undefined) result.sumInsuDrug90 = copay.sumInsuDrug90;
  if (copay.underUser !== undefined) result.underUser = copay.underUser;
  if (copay.underInsu !== undefined) result.underInsu = copay.underInsu;

  // ── [B-3] U항 100/100 + 요양급여비용총액2 ───────────────────────────────
  if (copay.sumInsuDrug100 !== undefined) result.sumInsuDrug100 = copay.sumInsuDrug100;
  if (copay.totalPrice100  !== undefined) result.totalPrice100  = copay.totalPrice100;
  if (copay.userPrice100   !== undefined) result.userPrice100   = copay.userPrice100;
  if (copay.totalPrice2    !== undefined) result.totalPrice2    = copay.totalPrice2;

  // ── [B-4] RealPrice / SumUser / SumInsure ──────────────────────────────
  if (copay.realPrice  !== undefined) result.realPrice  = copay.realPrice;
  if (copay.sumUser    !== undefined) result.sumUser    = copay.sumUser;
  if (copay.sumInsure  !== undefined) result.sumInsure  = copay.sumInsure;

  // ── [B-5] 특수공비 재배분 결과 ──────────────────────────────────────────
  if (copay.pub100Price !== undefined) result.pub100Price = copay.pub100Price;

  // ── [C-9] MpvaComm 보훈 비급여 감면분 전달 ──────────────────────────────
  // 근거: CopaymentCalculator.cs:L1182-L1217, L284
  if (copay.mpvaComm !== undefined) result.mpvaComm = copay.mpvaComm;

  return result;
}

function errorResult(message: string): CalcResult {
  return {
    sumInsuDrug: 0,
    sumWage: 0,
    totalPrice: 0,
    userPrice: 0,
    pubPrice: 0,
    wageList: [],
    steps: [],
    error: message,
  };
}

/**
 * 전자청구 서식번호 결정 (B-6)
 *
 * 처방조제/직접조제 여부 × 보험유형(건강보험/의료급여)으로 서식번호를 결정한다.
 *
 * | 조제방식  | 보험유형   | 서식번호 |
 * |----------|-----------|--------|
 * | 처방조제  | 건강보험   | H024   |
 * | 처방조제  | 의료급여   | H124   |
 * | 직접조제  | 건강보험   | H025   |
 * | 직접조제  | 의료급여   | H125   |
 *
 * 근거: CH10 §Step1-2, ch10_verifier.md §3.3
 *
 * @param insuCode 보험코드 (C10/D10/G10 등) — 첫 글자 C=건강보험, D=의료급여
 * @param isDirectDispensing 직접조제 여부 (true=직접조제, false/undefined=처방조제)
 * @returns 서식번호 ('H024' | 'H124' | 'H025' | 'H125')
 */
export function determineFormNumber(
  insuCode: string,
  isDirectDispensing?: boolean,
): string {
  // 보험유형 판별: D 계열 → 의료급여, 그 외 → 건강보험
  const isMedicalAid = insuCode.charAt(0).toUpperCase() === 'D';
  const isDirect = isDirectDispensing === true;

  if (!isDirect && !isMedicalAid) return 'H024'; // 처방조제 × 건강보험
  if (!isDirect && isMedicalAid)  return 'H124'; // 처방조제 × 의료급여
  if (isDirect  && !isMedicalAid) return 'H025'; // 직접조제  × 건강보험
  return 'H125';                                  // 직접조제  × 의료급여
}
