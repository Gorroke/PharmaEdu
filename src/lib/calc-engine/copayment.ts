/**
 * calc-engine/copayment.ts
 * 본인부담금 계산 — CH05 기반
 *
 * 지원 범위:
 * - C10 건강보험 일반 (30%)
 * - 65세 이상 3구간 (정액 FixCost / 20% / 30%)
 * - 6세 미만 소아 (21% = 30% × 70%)
 * - D계열 의료급여 — calcMedicalAid 모듈로 위임 (확장)
 * - G계열 보훈 — calcVeteran 모듈로 위임
 * - F계열 자동차보험 — calcAutoInsurance 모듈로 위임
 * - E계열 산재 — calcWorkersComp 모듈로 위임
 *
 * [B-2] 선별급여(A/B/D/E항) 독립 본인부담 계산
 * [B-3] U항 100/100 본인부담금 + 요양급여비용총액2
 * [B-4] 공비(PubPrice) 계산 로직 + RealPrice/SumUser/SumInsure 확정
 * [B-5] 특수공비 302/101/102 재배분 (ApplySpecialPub)
 */

import type { CalcOptions, CalcResult, InsuRate, MediIllnessInfo, SectionTotals } from './types';
import { trunc10, trunc100, roundToInt } from './rounding';
import { calcVeteran } from './modules/insurance/veteran';
import { calcMedicalAid } from './modules/insurance/medical-aid';
import { calcAutoInsurance } from './modules/insurance/auto-insurance';
import { calcWorkersComp } from './modules/insurance/workers-comp';
import { determineExemptionRate, determineV252RateByGrade } from './modules/special/exemption';

export interface CopayResult {
  totalPrice: number;   // 요양급여비용총액1 = trunc10(약가+조제료)
  userPrice: number;    // 본인일부부담금
  pubPrice: number;     // 청구액 = totalPrice - userPrice
  steps: CopayStep[];
  /** 보훈청 청구액 (3자배분 시 채워짐) */
  mpvaPrice?: number;
  /** 공단 청구액 (3자배분 시 채워짐) */
  insuPrice?: number;
  // ── [B-9] 공상등구분 코드 ──────────────────────────────────────────────────
  /** 공상등구분 코드 (보훈 처리 시 채워짐) */
  gsCode?: string;
  // ── [B-10] MT038 출력값 ────────────────────────────────────────────────────
  /** MT038 특정내역 출력값 (보훈위탁 G20 처리 시 채워짐) */
  mt038?: string;

  // ── [B-2] 선별급여 항별 합계 ───────────────────────────────────────────────
  /** 선별급여 50% 약품 합계 (A항) */
  sumInsuDrug50?: number;
  /** 선별급여 80% 약품 합계 (B항) */
  sumInsuDrug80?: number;
  /** 선별급여 30% 약품 합계 (D항) */
  sumInsuDrug30?: number;
  /** 선별급여 90% 약품 합계 (E항) */
  sumInsuDrug90?: number;
  /**
   * 부분부담(선별급여) 본인부담 합계
   * = trunc10(RoundToInt(A×50%) + RoundToInt(B×80%) + RoundToInt(D×30%) + RoundToInt(E×90%))
   * 근거: C# DispensingFeeCalculator.cs:L1836-L1840
   */
  underUser?: number;
  /** 부분부담(선별급여) 공단부담 합계 = trunc10(A+B+D+E) - underUser */
  underInsu?: number;

  // ── [B-3] 요양급여비용총액2 ────────────────────────────────────────────────
  /** 요양급여비용총액2 = trunc10(총액1 + U항 본인부담금총액) */
  totalPrice2?: number;
  /** 100% 자부담 약품금액 합계 (U항) */
  sumInsuDrug100?: number;
  /** 100% 약품 총액 = trunc10(U항 합계) */
  totalPrice100?: number;
  /** 100% 약품 환자분 = totalPrice100 */
  userPrice100?: number;

  // ── [B-4] RealPrice / SumUser / SumInsure ─────────────────────────────────
  /** 실수납금 = userPrice - pubPrice */
  realPrice?: number;
  /** 최종 환자수납액 = realPrice + UnderUser + UserPrice100 - MpvaComm */
  sumUser?: number;
  /** 최종 공단청구액 = insuPrice */
  sumInsure?: number;

  // ── [B-5] 특수공비 재배분 ──────────────────────────────────────────────────
  /** 100% 약품 공비 전환금액 (특수공비 302/101 재배분 결과) */
  pub100Price?: number;

  // ── [C-9] 보훈 비급여 감면분 ───────────────────────────────────────────────
  /**
   * MpvaComm — 보훈 비급여 감면분 (veteran.ts:calcMpvaComm 결과)
   * SumUser 최종 확정 시 차감: SumUser -= MpvaComm
   * 근거: CopaymentCalculator.cs:L1182-L1217, L284
   */
  mpvaComm?: number;
}

export interface CopayStep {
  title: string;
  formula: string;
  result: number;
  unit: string;
}

/**
 * 본인부담금 계산
 *
 * @param sumInsuDrug 급여 약가 합계 (01항 — covered만)
 * @param sumWage 조제료 합계
 * @param opt CalcOptions
 * @param rate 보험요율 마스터
 * @param illness 산정특례 질병코드 상세 (옵션)
 * @param sectionTotals 항별 분리 집계 (B-1 결과 — 선별급여/U항 처리에 사용)
 */
export function calcCopayment(
  sumInsuDrug: number,
  sumWage: number,
  opt: CalcOptions,
  rate: InsuRate,
  illness?: MediIllnessInfo,
  sectionTotals?: SectionTotals
): CopayResult {
  const steps: CopayStep[] = [];

  // Step 1: 요양급여비용총액1 = trunc10(약가+조제료)
  const totalPrice = trunc10(sumInsuDrug + sumWage);
  steps.push({
    title: '요양급여비용총액1',
    formula: `trunc10(${sumInsuDrug} + ${sumWage})`,
    result: totalPrice,
    unit: '원',
  });

  const insuCategory = opt.insuCode.charAt(0).toUpperCase();

  // ── 중간 결과 객체 (모듈 공유용) ─────────────────────────────────────────
  // 각 모듈은 CalcResult를 받아 업데이트하고 반환하는 계약을 따른다.
  const partialResult: CalcResult = {
    sumInsuDrug,
    sumWage,
    totalPrice,
    userPrice: 0,
    pubPrice: 0,
    wageList: [],
    steps,
  };

  // ── 보훈 M코드 우선 처리 (insuCode 무관) ─────────────────────────────────
  // C10+M10 같이 건강보험 insuCode이지만 bohunCode가 M코드인 경우
  // (예: S07 시나리오 — C10+M10, 보훈 전액감면)
  if (opt.bohunCode && opt.bohunCode.startsWith('M')) {
    const updatedResult = calcVeteran(opt, partialResult, rate);
    return _resultToCopay(updatedResult);
  }

  // ── G 보훈 ───────────────────────────────────────────────────────────────
  if (insuCategory === 'G') {
    const updatedResult = calcVeteran(opt, partialResult, rate);
    return _resultToCopay(updatedResult);
  }

  // ── D 의료급여 ────────────────────────────────────────────────────────────
  if (insuCategory === 'D') {
    // illness: CalcOptions.mediIllnessInfo 우선, 없으면 파라미터 illness 사용
    const illnessInfo = opt.mediIllnessInfo ?? illness;
    const updatedResult = calcMedicalAid(opt, partialResult, rate, illnessInfo);
    return _resultToCopay(updatedResult);
  }

  // ── F 자동차보험 ──────────────────────────────────────────────────────────
  if (insuCategory === 'F') {
    const updatedResult = calcAutoInsurance(opt, partialResult, rate);
    return _resultToCopay(updatedResult);
  }

  // ── E 산재 ───────────────────────────────────────────────────────────────
  if (insuCategory === 'E') {
    const updatedResult = calcWorkersComp(opt, partialResult, rate);
    return _resultToCopay(updatedResult);
  }

  // ── C 건강보험 (기본) ────────────────────────────────────────────────────
  // C 이외의 미지원 보험유형도 여기서 fallback 처리

  // 산정특례 요율 결정 (mediIllness 있는 경우)
  const effectiveCopayRate = _determineEffectiveRate(opt, rate, illness);

  const age = opt.age;
  let userPrice: number;

  if (age >= 65 && effectiveCopayRate < 0) {
    // 65세 이상 3구간 (산정특례 없는 경우)
    if (totalPrice <= 10000) {
      const fixCost = rate.fixCost > 0 ? rate.fixCost : 1000;
      userPrice = Math.min(totalPrice, fixCost);
      steps.push({
        title: '65세 이상 본인부담금 (1구간: 정액)',
        formula: `min(${totalPrice}, ${fixCost})`,
        result: userPrice,
        unit: '원',
      });
    } else if (totalPrice <= 12000 && opt.dosDate >= '20180101') {
      // 2구간(10,001~12,000원)은 2018.01.01 이후 처방에만 적용
      // C# CalcCopay_C():L430 — dosDate >= "20180101" 조건
      const rate2 = rate.age65_12000Less > 0 ? rate.age65_12000Less : 20;
      userPrice = trunc100(totalPrice * (rate2 / 100));
      steps.push({
        title: '65세 이상 본인부담금 (2구간: 20%, 2018.01.01 이후)',
        formula: `trunc100(${totalPrice} × ${rate2}%)`,
        result: userPrice,
        unit: '원',
      });
    } else {
      userPrice = trunc100(totalPrice * (rate.rate / 100));
      steps.push({
        title: '65세 이상 본인부담금 (3구간: 30%)',
        formula: `trunc100(${totalPrice} × ${rate.rate}%)`,
        result: userPrice,
        unit: '원',
      });
    }
  } else if (effectiveCopayRate >= 0) {
    // 산정특례 요율 적용 (0%~99%)
    userPrice = trunc100(totalPrice * (effectiveCopayRate / 100));
    steps.push({
      title: `산정특례 본인부담금 (${opt.mediIllness ?? ''} — ${effectiveCopayRate}%)`,
      formula: `trunc100(${totalPrice} × ${effectiveCopayRate}%)`,
      result: userPrice,
      unit: '원',
    });
  } else if (age < 6) {
    // 6세 미만 소아: rate% × sixAgeRate%
    const effectiveRate = (rate.rate * rate.sixAgeRate) / 100;
    userPrice = trunc100(totalPrice * (effectiveRate / 100));
    steps.push({
      title: `6세 미만 본인부담금 (${rate.rate}% × ${rate.sixAgeRate}% = ${effectiveRate}%)`,
      formula: `trunc100(${totalPrice} × ${effectiveRate}%)`,
      result: userPrice,
      unit: '원',
    });
  } else {
    // 일반 C10: rate% (기본 30%)
    userPrice = trunc100(totalPrice * (rate.rate / 100));
    steps.push({
      title: '본인부담금 (건강보험)',
      formula: `trunc100(${totalPrice} × ${rate.rate}%)`,
      result: userPrice,
      unit: '원',
    });
  }

  // ── [B-2] 선별급여 독립 계산 ─────────────────────────────────────────────
  // C# DispensingFeeCalculator.cs:L1836-L1845
  const selectResult = _calcSelectBenefit(sectionTotals);

  // ── [B-3] U항 100/100 본인부담금 + 요양급여비용총액2 ─────────────────────
  // C# CopaymentCalculator.cs:L269-L275
  const uResult = _calcUSection(sectionTotals);

  // ── [B-4] 진짜 공비(공공기금: 희귀질환/긴급복지/특수공비 등) 계산 ─────────
  // C# CopaymentCalculator.cs:L232-L234 — CalcPubPrice(opt, result, insuRate, illness)
  // 주의: 기존 CalcResult.pubPrice 필드는 "청구액 = totalPrice - userPrice" 의미.
  //       I6가 도입한 이 함수의 출력은 다른 개념(공공기금 대납)이므로 별도 변수 pubFund로 보관.
  const pubFund = _calcPubPrice(opt, userPrice, illness, uResult.userPrice100 ?? 0);

  // ── [B-4] InsuPrice (공단청구액) = totalPrice - userPrice ─────────────────
  // 비보훈 C계열: InsuPrice = totalPrice - userPrice - mpvaPrice(0)
  const insuPrice = totalPrice - userPrice;

  // 기존 pubPrice 필드 의미("청구액 = totalPrice - userPrice") 유지 — 회귀 항등식 보존
  const pubPrice = insuPrice;
  steps.push({
    title: '청구액 (공단)',
    formula: `pubPrice = totalPrice(${totalPrice}) - userPrice(${userPrice}) = ${pubPrice}`,
    result: pubPrice,
    unit: '원',
  });

  // ── [B-4] RealPrice = UserPrice - PubFund ────────────────────────────────
  // 환자 실수납금 = 본인부담금 - 공공기금 대납분
  // C# CopaymentCalculator.cs:L239
  const realPrice = userPrice - pubFund;

  // ── [B-4] SumUser 최종 확정 ──────────────────────────────────────────────
  // C# CopaymentCalculator.cs:L282-L285
  // SumUser = RealPrice + UnderUser + UserPrice100 - MpvaComm
  // (비급여, 프리미엄은 index.ts 파이프라인에서 처리; 여기서는 급여분만)
  const sumUser = realPrice
    + (selectResult.underUser ?? 0)
    + (uResult.userPrice100 ?? 0);

  // ── [B-4] SumInsure ───────────────────────────────────────────────────────
  // C# CopaymentCalculator.cs:L305
  const sumInsure = insuPrice;

  // ── 최종 결과 조립 ─────────────────────────────────────────────────────────
  const copayResult: CopayResult = {
    totalPrice,
    userPrice,
    pubPrice,
    insuPrice,
    realPrice,
    sumUser,
    sumInsure,
    steps,
  };

  // 선별급여 결과 (B-2)
  if (selectResult.underUser !== undefined) {
    copayResult.sumInsuDrug50 = sectionTotals?.sectionA ?? 0;
    copayResult.sumInsuDrug80 = sectionTotals?.sectionB ?? 0;
    copayResult.sumInsuDrug30 = sectionTotals?.sectionD ?? 0;
    copayResult.sumInsuDrug90 = sectionTotals?.sectionE ?? 0;
    copayResult.underUser = selectResult.underUser;
    copayResult.underInsu = selectResult.underInsu;
  }

  // U항 결과 (B-3)
  if (uResult.sumInsuDrug100 !== undefined) {
    copayResult.sumInsuDrug100 = uResult.sumInsuDrug100;
    copayResult.totalPrice100  = uResult.totalPrice100;
    copayResult.userPrice100   = uResult.userPrice100;
    // totalPrice2 = trunc10(totalPrice + totalPrice100)
    // 근거: CH07 R13; CH05 §8.1
    copayResult.totalPrice2 = trunc10(totalPrice + (uResult.totalPrice100 ?? 0));
  }

  // ── [B-5] 특수공비 302/101/102 재배분 ────────────────────────────────────
  // C# CopaymentCalculator.cs:L290 — ApplySpecialPub(opt, result)
  _applySpecialPub(opt, copayResult);

  return copayResult;
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * CalcResult → CopayResult 변환
 * mpvaPrice, insuPrice 등 3자배분 필드도 함께 전달한다.
 */
function _resultToCopay(r: CalcResult): CopayResult {
  const result: CopayResult = {
    totalPrice: r.totalPrice,
    userPrice: r.userPrice,
    pubPrice: r.pubPrice,
    steps: r.steps as CopayStep[],
  };
  if (r.mpvaPrice  !== undefined) result.mpvaPrice  = r.mpvaPrice;
  if (r.insuPrice  !== undefined) result.insuPrice  = r.insuPrice;
  // B-9/B-10: GsCode, MT038 전달
  if (r.gsCode     !== undefined) result.gsCode     = r.gsCode;
  if (r.mt038      !== undefined) result.mt038      = r.mt038;
  // H-2: sumUser, realPrice, sumInsure 전달
  if (r.sumUser    !== undefined) result.sumUser    = r.sumUser;
  if (r.realPrice  !== undefined) result.realPrice  = r.realPrice;
  if (r.sumInsure  !== undefined) result.sumInsure  = r.sumInsure;
  // C-9: MpvaComm 전달
  if (r.mpvaComm   !== undefined) result.mpvaComm   = r.mpvaComm;
  return result;
}

// ─── [B-2] 선별급여 독립 본인부담 계산 ──────────────────────────────────────

/**
 * 선별급여(A/B/D/E항) 독립 본인부담금 계산
 *
 * 공식:
 *   underUserRaw = RoundToInt(A×50%) + RoundToInt(B×80%) + RoundToInt(D×30%) + RoundToInt(E×90%)
 *   UnderUser    = trunc10(underUserRaw)                    ← CH07 R16: 합산 후 1회 trunc10
 *   underTotal   = trunc10(A+B+D+E)
 *   UnderInsu    = underTotal - UnderUser
 *
 * 근거: C# DispensingFeeCalculator.cs:L1836-L1845
 */
function _calcSelectBenefit(sectionTotals?: SectionTotals): {
  underUser?: number;
  underInsu?: number;
} {
  if (!sectionTotals) return {};

  const { sectionA, sectionB, sectionD, sectionE } = sectionTotals;
  if (sectionA === 0 && sectionB === 0 && sectionD === 0 && sectionE === 0) return {};

  // 각 항목별 본인부담 사사오입 후 합산 → 1회 trunc10
  const underUserRaw = roundToInt(sectionA * 0.5)
                     + roundToInt(sectionB * 0.8)
                     + roundToInt(sectionD * 0.3)
                     + roundToInt(sectionE * 0.9);
  const underUser = trunc10(underUserRaw);

  // 부분부담 미만총액 (A+B+D+E) trunc10
  const underTotal = trunc10(sectionA + sectionB + sectionD + sectionE);
  const underInsu = underTotal - underUser;

  return { underUser, underInsu };
}

// ─── [B-3] U항 100/100 본인부담금 + 요양급여비용총액2 ────────────────────────

/**
 * U항(100% 본인부담) 처리
 *
 *   sumInsuDrug100 = sectionTotals.sectionU
 *   totalPrice100  = trunc10(sumInsuDrug100)    ← C# CopaymentCalculator.cs:L271
 *   userPrice100   = totalPrice100              ← C# :L273 환자 전액 부담
 *   totalPrice2    = trunc10(totalPrice + totalPrice100)
 *                    ← CH07 R13: 요양급여비용총액2 = 총액1 + 100/100본인부담금총액
 *
 * 근거: C# CopaymentCalculator.cs:L269-L275, CH05 §8.1, CH07 R13
 */
function _calcUSection(sectionTotals?: SectionTotals): {
  sumInsuDrug100?: number;
  totalPrice100?: number;
  userPrice100?: number;
  totalPrice2?: number;
} {
  if (!sectionTotals || sectionTotals.sectionU === 0) return {};

  const sumInsuDrug100 = sectionTotals.sectionU;
  const totalPrice100  = trunc10(sumInsuDrug100);
  const userPrice100   = totalPrice100;

  // totalPrice2는 외부에서 totalPrice를 받아야 하므로 임시 반환 후 호출측에서 계산
  return { sumInsuDrug100, totalPrice100, userPrice100 };
}

// ─── [B-4] 공비(PubPrice) 계산 ───────────────────────────────────────────────

/**
 * 공비(PubPrice) 결정 — 희귀질환/긴급복지/특수공비 등 제3기관 지원금
 *
 * 처리 우선순위:
 *   1. 희귀질환(isRare) + 비전액부담 → UserPrice 전액 공비
 *   2. G타입 보훈코드 없음 (긴급복지) → UserPrice 전액 공비
 *   3. C타입 + 특수공비(302/101 — N/102 아닌 경우) → UserPrice 전액 공비
 *   4. C타입 + 원내조제(IndYN=Y) → UserPrice 전액 공비
 *   5. V246/V206 + 2016.07.01 이전 → trunc10(UserPrice × 50%)
 *   6. F008 긴급복지 전액면제 → UserPrice + UserPrice100
 *
 * 근거: C# CopaymentCalculator.cs:L904-L961
 */
function _calcPubPrice(
  opt: CalcOptions,
  userPrice: number,
  illness?: MediIllnessInfo,
  userPrice100 = 0,
): number {
  let pubPrice = 0;
  const specialPubCode = _normalizeSpecialPubCode(opt.specialPub ?? '');
  const insuCategory = opt.insuCode.charAt(0).toUpperCase();

  // 1. 희귀질환 + 비전액부담
  if (opt.isRare) {
    pubPrice = userPrice;
  }
  // 2. G타입 + 보훈코드 없음 (긴급복지형 G타입)
  else if (insuCategory === 'G' && !opt.bohunCode) {
    pubPrice = userPrice;
  }
  // 3. C타입 + 특수공비(N/102 아닌 경우)
  else if (
    insuCategory === 'C'
    && specialPubCode !== ''
    && specialPubCode !== 'N'
    && specialPubCode !== '102'
  ) {
    pubPrice = userPrice;
  }
  // 4. C타입 + 원내조제
  else if (insuCategory === 'C' && opt.indYN === 'Y') {
    pubPrice = userPrice;
  }

  // 5. V246/V206 + 2016.07.01 이전 (C타입 한정)
  if (insuCategory === 'C') {
    const mi = illness?.code ?? opt.mediIllness ?? '';
    if ((mi === 'V246' || mi === 'V206') && opt.dosDate < '20160701') {
      pubPrice = trunc10(userPrice * 0.5);
    }
  }

  // 6. F008 긴급복지 전액면제 — UserPrice + UserPrice100 전환
  // 근거: C# CopaymentCalculator.cs:L952-L959
  if (opt.mediIllnessB === 'F008') {
    pubPrice = userPrice + userPrice100;
  }

  return pubPrice;
}

// ─── [B-5] 특수공비 302/101/102 재배분 ───────────────────────────────────────

/**
 * 특수공비(302/101/102) 재배분
 *
 * specialPub 코드에 따라 SumUser 조정 및 Pub100Price 산출:
 *   C/D타입 302: useNPayExpandedPublic → Pub100Price=SumUser, SumUser=0
 *                그 외              → Pub100Price=specialPub302Amount, SumUser-=specialPub302Amount
 *   C/D타입 101: Pub100Price=SumInsuDrug100, SumUser-=SumInsuDrug100
 *   C타입 102:   미처리 (pass)
 *   C타입 기타:  SumUser-=SumInsuDrug100, InsuPrice+=SumInsuDrug100
 *   G타입 302:   Pub100Price=SumUser, SumUser=0
 *
 * 근거: C# CopaymentCalculator.cs:L984-L1062
 */
function _applySpecialPub(opt: CalcOptions, result: CopayResult): void {
  const specialPub = _normalizeSpecialPubCode(opt.specialPub ?? '');
  if (!specialPub || specialPub === 'N') return;

  const insuCategory = opt.insuCode.charAt(0).toUpperCase();
  // NPayExpYN: 비급여 확장 공비 여부 ('Y' 또는 비-N 값)
  const useNPayExpandedPublic = !!opt.nPayExpYN
    && opt.nPayExpYN.toUpperCase() !== 'N';

  const sumInsuDrug100 = result.sumInsuDrug100 ?? 0;
  // 302 대상 금액: sumInsuDrug100_302 우선 (미지원 시 sumInsuDrug100)
  const specialPub302Amount = sumInsuDrug100;

  const sumUser = result.sumUser ?? 0;

  if (insuCategory === 'C') { // C타입
    switch (specialPub) {
      case '302':
        if (useNPayExpandedPublic) {
          result.pub100Price = sumUser;
          result.sumUser = 0;
        } else {
          result.pub100Price = specialPub302Amount;
          result.sumUser = sumUser - specialPub302Amount;
        }
        break;
      case '101':
        result.pub100Price = sumInsuDrug100;
        result.sumUser = sumUser - sumInsuDrug100;
        break;
      case '102':
        // 미처리 (pass)
        break;
      default:
        // 기타: 공단으로 전환
        result.sumUser = sumUser - sumInsuDrug100;
        result.insuPrice = (result.insuPrice ?? 0) + sumInsuDrug100;
        result.sumInsure = (result.sumInsure ?? 0) + sumInsuDrug100;
        break;
    }
  } else if (insuCategory === 'D') { // D타입
    switch (specialPub) {
      case '302':
        if (useNPayExpandedPublic) {
          result.pub100Price = sumUser;
          result.sumUser = 0;
        } else {
          result.pub100Price = specialPub302Amount;
          result.sumUser = sumUser - specialPub302Amount;
        }
        break;
      case '101':
        result.pub100Price = sumInsuDrug100;
        result.sumUser = sumUser - sumInsuDrug100;
        break;
      // 102 및 기타: 미처리
    }
  } else if (insuCategory === 'G') { // G타입
    switch (specialPub) {
      case '302':
        result.pub100Price = sumUser;
        result.sumUser = 0;
        break;
      // 기타: 미처리
    }
  }
}

// ─── 특수공비 코드 정규화 ─────────────────────────────────────────────────────

/**
 * 특수공비 코드 정규화 (공백 제거, 앞 3자리 추출)
 * 근거: C# CopaymentCalculator.cs:L1064-L1074
 */
function _normalizeSpecialPubCode(specialPub: string): string {
  if (!specialPub || !specialPub.trim()) return '';
  const trimmed = specialPub.trim();
  if (trimmed.toUpperCase() === 'N') return 'N';
  return trimmed.length >= 3 ? trimmed.slice(0, 3) : trimmed;
}

/**
 * 산정특례 요율 결정
 * 반환: 0~100 적용 요율, -1이면 산정특례 미적용 (기본 로직 사용)
 */
function _determineEffectiveRate(
  opt: CalcOptions,
  rate: InsuRate,
  illness?: MediIllnessInfo
): number {
  const mediIllness = opt.mediIllness ?? illness?.code;
  if (!mediIllness) return -1;

  // mediIllnessInfo에 grade가 있으면 V252 등급별 요율 시도
  const info = opt.mediIllnessInfo ?? illness;
  if (info?.grade !== undefined) {
    const gradeStr = String(info.grade);
    const gradeRate = determineV252RateByGrade(mediIllness, gradeStr, rate);
    if (gradeRate >= 0) return gradeRate;
  }

  return determineExemptionRate(mediIllness, rate, rate.rate);
}

// ─── 주: D계열 의료급여 로직은 modules/insurance/medical-aid.ts로 이관됨 ───
// calcMedicalAid() 함수가 D10/D20/D40/D80/D90/B014/B030/V103를 전부 처리한다.
