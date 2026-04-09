/**
 * calc-engine/dispensing-fee.ts
 * 조제료 계산 — CH03/CH04 기반
 *
 * 지원 범위:
 * - 직접조제 (isDirectDispensing=true) → calcDirectDispensing 모듈로 위임
 * - 처방조제: Z1000/Z2000/Z3000/Z41xx/Z4120/Z4121/Z4130/Z5000
 * - 산제 가산: calcPowderSurchargeFromCtx (Z4010 또는 Z41xx100)
 * - 토요 가산: applySaturdaySurchargeRows (별도 행 분리)
 * - 명절 가산: calcSeasonalSurcharge (ZE 계열)
 * - 복약상담/비대면: calcCounseling (Z7001/ZC 계열)
 * - [C-2] 자가주사 조제료: Z4130 (selfInjYN='Y'/'1' + 주사제 단독 처방)
 * - [C-5] 비급여 조제료 차액 산정 (insuDose < maxInternalDay 시 insuPay="0" 별도 행)
 */

import type { CalcOptions, DrugItem, WageListItem, ICalcRepository } from './types';
import { determineSurcharge, getTieredText3 } from './surcharge';
import type { SurchargeFlags } from './surcharge';
import { calcDirectDispensing, isDirectDispensingMode } from './modules/modes/direct-dispensing';
import { calcPowderSurchargeFromCtx, hasPowderDrug } from './modules/surcharges/powder';
import { applySaturdaySurchargeRows } from './modules/surcharges/saturday-split';
import { calcSeasonalSurcharge } from './modules/surcharges/seasonal';
import { calcCounseling } from './modules/modes/counseling';
import { applyNPayRound } from './rounding';

// ─── surcharge 컨텍스트 빌더 (CalcOptions → SurchargeFlags) ────────────────

function buildSurcharge(opt: CalcOptions & { isPowder?: boolean }): SurchargeFlags {
  return determineSurcharge({
    age: typeof opt.age === 'number' ? opt.age : 0,
    isNight: opt.isNight,
    isHolyDay: opt.isHolyDay,
    isSaturday: opt.isSaturday,
    isMidNight: opt.isMidNight,
    isNonFace: opt.isNonFace,
    isPowder: opt.isPowder,
  });
}

// SurchargeFlags → 내부 코드 선택용 별칭 타입
type SurchargeCtx = SurchargeFlags;

// ─── 약품 분류 ────────────────────────────────────────────────────────────────

interface DrugClassify {
  hasInternal: boolean;
  hasExternal: boolean;
  hasInjection: boolean;
  coveredCount: number;
  maxInternalDay: number;
  maxExternalDay: number;
  /** 마약/향정 포함 여부 — Z5001 산정 조건 (C# DrugClassifyContext.HasNarcotic) */
  hasNarcotic: boolean;
  /** 전체 내복약이 병팩(pack>1) 여부 — Z5011 산정 조건 (C# DrugClassifyContext.IsAllPack) */
  allPack: boolean;
}

function classifyDrugs(drugs: DrugItem[]): DrugClassify {
  const ctx: DrugClassify = {
    hasInternal: false,
    hasExternal: false,
    hasInjection: false,
    coveredCount: 0,
    maxInternalDay: 0,
    maxExternalDay: 0,
    hasNarcotic: false,
    allPack: true,  // 내복약이 없으면 false로 전환
  };

  let internalCount = 0;

  for (const drug of drugs) {
    const isCovered =
      drug.insuPay === 'covered' ||
      drug.insuPay === 'fullSelf' ||
      drug.insuPay === 'partial50' ||
      drug.insuPay === 'partial80' ||
      drug.insuPay === 'partial30' ||
      drug.insuPay === 'partial90';

    if (isCovered) ctx.coveredCount++;

    // 마약/향정 판정: spec='3'(마약) 또는 '4'(향정)
    // 근거: DispensingFeeCalculator.cs:CalcDrugMgm():L1540 HasNarcotic 판정
    if (drug.spec === '3' || drug.spec === '4') {
      ctx.hasNarcotic = true;
    }

    if (drug.take === 'internal') {
      ctx.hasInternal = true;
      internalCount++;
      if (isCovered && drug.dDay > ctx.maxInternalDay) {
        ctx.maxInternalDay = Math.floor(drug.dDay);
      }
      // 병팩 판정: pack이 1보다 큰 경우가 아니면 allPack=false
      if (!drug.pack || drug.pack <= 1) {
        ctx.allPack = false;
      }
    } else if (drug.take === 'external') {
      ctx.hasExternal = true;
      if (isCovered && drug.dDay > ctx.maxExternalDay) {
        ctx.maxExternalDay = Math.floor(drug.dDay);
      }
    } else if (drug.take === 'injection') {
      ctx.hasInjection = true;
    }
  }

  // 내복약이 전혀 없으면 allPack=false
  if (internalCount === 0) ctx.allPack = false;

  return ctx;

}

// ─── 의약품관리료 일수별 코드 결정 ──────────────────────────────────────────

/**
 * 의약품관리료 25구간 Z코드 생성 (처방조제 경로)
 *
 * C# 원본: DispensingFeeCalculator.cs:GetMedMgmtSugaCD():L672
 * - 1~15일: Z51DD (DD = 2자리 일수)
 * - 16~20일: Z5316
 * - 21~25일: Z5321
 * - 26~30일: Z5326
 * - 31~40일: Z5331
 * - 41~50일: Z5341
 * - 51~60일: Z5351
 * - 61~70일: Z5361
 * - 71~80일: Z5371
 * - 81~90일: Z5381
 * - 91일+: Z5391
 *
 * 외용약만인 경우: Z5010 고정 (C# CalcDrugMgm():L1553)
 *
 * 근거: ch02_analyst.md §5-3 "GetMedMgmtSugaCD() 미포팅",
 *        ch02_verifier.md §1 "GetMedMgmtSugaCD():L672 — ✗ 미포팅",
 *        99_FINAL_REPORT.md §4.2 C-05, §7 B-8
 *
 * 주의: Z5101~Z5391 단가는 수가 고시에 개별 코드로 없음.
 *        seed.sql에 단가가 없으면 addWage에서 price=0 → 자동 skip됨.
 *        단가 데이터 추가 시 자동으로 산정됨.
 */
function getMedMgmtSugaCode(days: number, hasExternalOnly: boolean): string {
  if (hasExternalOnly) return 'Z5010'; // 외용약만: Z5010 고정
  if (days <= 0) return 'Z5010';       // 안전 처리
  if (days <= 15) return `Z51${String(days).padStart(2, '0')}`;
  if (days <= 20) return 'Z5316';
  if (days <= 25) return 'Z5321';
  if (days <= 30) return 'Z5326';
  if (days <= 40) return 'Z5331';
  if (days <= 50) return 'Z5341';
  if (days <= 60) return 'Z5351';
  if (days <= 70) return 'Z5361';
  if (days <= 80) return 'Z5371';
  if (days <= 90) return 'Z5381';
  return 'Z5391';
}

// ─── Z코드 선택 로직 ─────────────────────────────────────────────────────────

/**
 * Z1000 약국관리료 코드
 * [C-1] text3 적용: 야간/심야 + 차등비해당(text3="1") → Z1000001
 * 근거: DispensingFeeCalculator.cs:BuildStoreManageCode():L96
 */
function z1000Code(sc: SurchargeCtx, text3: '0' | '1'): string {
  if ((sc.holidayGb === '1' || sc.holidayGb === '8' || sc.holidayGb === '9') && text3 === '1') {
    return 'Z1000001';
  }
  return 'Z1000';
}

/**
 * Z2000 기본조제기술료 코드 (토요는 기본 코드 사용 — 가산분은 별도 행)
 * [C-1] text3 적용: 야간 010/011, 소아야간 610/611, 소아심야 640/641(이후)/620(이전)
 * [C-16] holidayGb="9" → 소아심야 전용 코드
 * 근거: DispensingFeeCalculator.cs:BuildBaseJojeCode():L101
 */
function z2000Code(sc: SurchargeCtx, text3: '0' | '1', dosDate: string): string {
  switch (sc.holidayGb) {
    case '1': return 'Z200001' + text3;    // 야간: Z2000010/Z2000011
    case '5': return 'Z2000050';           // 공휴 (text3 없음)
    case '6': return 'Z2000600';           // 6세미만 단독
    case '7': return 'Z2000650';           // 6세미만+공휴 (text3 없음)
    case '8': return 'Z200061' + text3;    // 6세미만+야간: Z2000610/Z2000611
    case '9': {                            // 소아심야 [C-16]
      const isAfter = dosDate >= '20231101';
      return isAfter ? 'Z200064' + text3 : 'Z2000620';
    }
    default:  return 'Z2000';
  }
}

/**
 * Z3000 복약지도료 코드 (토요는 기본 코드 — 가산분은 별도 행)
 * [C-1] text3 적용: 야간 010/011, 소아심야 040/041(이후)/020/021(이전)
 * [C-16] holidayGb="9" → 소아심야 분기
 * 근거: DispensingFeeCalculator.cs:BuildDrugGuideCode():L129
 */
function z3000Code(sc: SurchargeCtx, text3: '0' | '1', dosDate: string): string {
  switch (sc.holidayGb) {
    case '1':
    case '8': return 'Z300001' + text3;   // 야간/소아야간: Z3000010/Z3000011
    case '9': {                            // 소아심야 [C-16]
      const isAfter = dosDate >= '20231101';
      return isAfter ? 'Z300004' + text3 : 'Z300002' + text3;
    }
    case '5':
    case '7': return 'Z3000050';          // 공휴/소아공휴
    default:  return 'Z3000';
  }
}

/**
 * Z41xx 내복약 조제료 코드 결정
 * 1~15일: Z4101~Z4115, 16일+: presc_dosage_fee 테이블 조회
 * [C-1] text3 적용: 야간/소아야간 01x, 소아심야 02x
 */
function z4InternalCode(days: number, sc: SurchargeCtx, text3: '0' | '1'): { code: string; needsTableLookup: boolean } {
  let baseCode: string;
  let needsTableLookup = false;

  if (days <= 15) {
    baseCode = `Z41${String(days).padStart(2, '0')}`;
  } else {
    needsTableLookup = true;
    baseCode = 'Z4116';
  }

  if (sc.holidayGb === '1' || sc.holidayGb === '8') {
    return { code: baseCode + '01' + text3, needsTableLookup };  // 야간/소아야간: 010/011
  }
  if (sc.holidayGb === '9') {
    return { code: baseCode + '02' + text3, needsTableLookup };  // 소아심야: 020/021
  }
  if (sc.holidayGb === '5' || sc.holidayGb === '7') {
    return { code: baseCode + '050', needsTableLookup };
  }

  return { code: baseCode, needsTableLookup };
}

/**
 * Z4120 외용약 조제료 코드
 * [C-1] text3 적용
 */
function z4ExternalCode(sc: SurchargeCtx, text3: '0' | '1'): string {
  if (sc.holidayGb === '1' || sc.holidayGb === '8') return 'Z412001' + text3;
  if (sc.holidayGb === '9') return 'Z412002' + text3;    // 소아심야
  if (sc.holidayGb === '5' || sc.holidayGb === '7') return 'Z4120050';
  return 'Z4120';
}

/**
 * Z4121 내복+외용 동시 조제료 코드
 * [C-1] text3 적용
 */
function z4BothCode(sc: SurchargeCtx, text3: '0' | '1'): string {
  if (sc.holidayGb === '1' || sc.holidayGb === '8') return 'Z412101' + text3;  // 야간/소아야간
  if (sc.holidayGb === '9') return 'Z412102' + text3;                           // 소아심야
  if (sc.holidayGb === '5' || sc.holidayGb === '7') return 'Z4121050';
  if (sc.holidayGb === '3') return 'Z4121030';
  return 'Z4121';
}

// ─── 메인 조제료 계산 ─────────────────────────────────────────────────────────

interface DispensingFeeResult {
  wageList: WageListItem[];
  sumWage: number;
}

export async function calcDispensingFee(
  opt: CalcOptions,
  repo: ICalcRepository
): Promise<DispensingFeeResult> {
  // A-8: dosDate 8자리 보존 — getSugaFeeMap에 8자리 전달 (연내 수가 개정 반영 준비)
  // 근거: 99_FINAL_REPORT.md §4.10 C-40, ch10_analyst.md §5 CH10 §3-2
  const year = parseInt(opt.dosDate.substring(0, 4), 10) || 2026; // getPrescDosageFee용 연도

  // ── 직접조제 모드 분기 ────────────────────────────────────────────────────
  // isDirectDispensing=true이면 Z42xx 코드 체계 사용 (처방조제와 완전히 다른 경로)
  if (isDirectDispensingMode(opt)) {
    const sc = buildSurcharge(opt);
    const ddResult = await calcDirectDispensing({
      options: opt,
      repo,
      surcharge: sc,
      isDirectDispensing: true,
    });
    if (ddResult.applied) {
      const sumWage = ddResult.wageItems.reduce((s, w) => s + w.sum, 0);
      return { wageList: ddResult.wageItems, sumWage };
    }
  }

  // ── 처방조제 경로 ─────────────────────────────────────────────────────────
  let wageList: WageListItem[] = [];

  // 수가 마스터 로드 — A-8: dosDate 8자리 전달 (향후 월·일 단위 조회 지원 준비)
  const sugaMap = await repo.getSugaFeeMap(opt.dosDate);

  function getPrice(code: string): number {
    return sugaMap.get(code)?.price ?? 0;
  }

  function getName(code: string): string {
    return sugaMap.get(code)?.name ?? code;
  }

  function addWage(code: string, cnt: number): void {
    const price = getPrice(code);
    if (price === 0) return; // 단가 없으면 미산정
    const sum = price * cnt;
    wageList.push({
      sugaCd: code,
      name: getName(code),
      insuPay: '1',
      cnt,
      price,
      sum,
      addType: '',
    });
  }

  // 약품 분류
  const drugCtx = classifyDrugs(opt.drugList);

  // 산제(가루약) 가산 여부 — 가루약 있으면 가산 우선순위 재조정
  const isPowder = hasPowderDrug(opt.drugList);
  const sc = buildSurcharge({ ...opt, isPowder } as Parameters<typeof buildSurcharge>[0]);

  // ── [C-1] 차등수가 text3 결정 ─────────────────────────────────────────────
  // 건강보험(C 계열) + 야간/심야 + 차등면제 판정
  // isChadungExempt: 영업시간 기반 면제 여부 (외부 주입 없으면 false → 차등 해당=text3="0")
  // 근거: DispensingFeeCalculator.cs:BuildSuffix():L589-L641
  const isNightOrMidNight = sc.isNight || sc.isMidNight;
  const text3 = getTieredText3(
    opt.insuCode,
    isNightOrMidNight,
    false,             // isChadungExempt — CalcOptions에 추가 시 opt.isChadungExempt 사용
    opt.drugSafeYN,
  );

  // 급여 약품이 없으면 조제료 미산정
  if (drugCtx.coveredCount === 0) {
    return { wageList: [], sumWage: 0 };
  }

  // 주사제만 처방이고 자가주사 아닌 경우 → 기본조제료 미산정
  const isInjectionOnly =
    !drugCtx.hasInternal && !drugCtx.hasExternal && drugCtx.hasInjection;

  // C-2: 자가주사 여부 판정 (C# CalcOptions.SelfInjYN 대응)
  // 근거: DispensingFeeCalculator.cs:L220 isSelfInj = options.SelfInjYN == "1" || options.SelfInjYN == "Y"
  const isSelfInj = opt.selfInjYN === '1' || opt.selfInjYN === 'Y';

  if (isInjectionOnly && isSelfInj) {
    // ── C-2: 자가투여주사제 조제료 Z4130 ────────────────────────────────────
    // 근거: DispensingFeeCalculator.cs:CalcSelfInjection():L1479-L1510
    // BuildTimedCode("Z4130", text2, text3) = "Z4130" + "0" + text2 + text3
    // text2: ""(일반), "1"(야간), "2"(심야), "5"(공휴)
    // text3: "0"(차등해당), "1"(차등비해당)
    const selfInjBaseCode = 'Z4130';
    // holidayGb → text2 매핑 (BuildTimedCode 방식)
    let text2: string;
    if (sc.holidayGb === '1' || sc.holidayGb === '8') text2 = '1';       // 야간/소아야간
    else if (sc.holidayGb === '9') text2 = '2';                           // 소아심야
    else if (sc.holidayGb === '5' || sc.holidayGb === '7') text2 = '5'; // 공휴
    else text2 = '';
    const selfInjCode = text2
      ? selfInjBaseCode + '0' + text2 + text3
      : selfInjBaseCode;

    // price=0이면 기본코드(Z4130) 폴백
    // 근거: DispensingFeeCalculator.cs:CalcSelfInjection():L1484
    let selfInjPrice = getPrice(selfInjCode);
    if (selfInjPrice === 0 && selfInjCode !== selfInjBaseCode) {
      selfInjPrice = getPrice(selfInjBaseCode);
    }
    if (selfInjPrice > 0) {
      wageList.push({
        sugaCd: selfInjCode,
        name: getName(selfInjCode) || getName(selfInjBaseCode),
        insuPay: '1',
        cnt: 1,
        price: selfInjPrice,
        sum: selfInjPrice,
        addType: '',
      });
    }

    // 토요 가산: Z4130030
    // 근거: DispensingFeeCalculator.cs:CalcSelfInjection():L1496-L1508
    if (opt.isSaturday) {
      addWage(selfInjBaseCode + '030', 1);
    }

    // 의약품관리료 Z5000/Z5001/Z5011
    if (drugCtx.allPack) {
      addWage('Z5011', 1);
    } else {
      const drugMgmCode = drugCtx.hasNarcotic ? 'Z5001' : 'Z5000';
      addWage(drugMgmCode, 1);
    }

    const sumWage = wageList.reduce((s, w) => s + w.sum, 0);
    return { wageList, sumWage };
  }

  if (isInjectionOnly && !isSelfInj) {
    // 주사제 단독 (자가주사 아님): Z5000(또는 Z5001) 의약품관리료만 적용 후 return
    // B-8: 마약/병팩 분기 동일 적용, 일수별 가산 없음(주사제는 투약일수 없음)
    // 근거: DispensingFeeCalculator.cs:L217-L219
    if (drugCtx.allPack) {
      addWage('Z5011', 1);
    } else {
      const baseCode = drugCtx.hasNarcotic ? 'Z5001' : 'Z5000';
      addWage(baseCode, 1);
    }
    const sumWage = wageList.reduce((s, w) => s + w.sum, 0);
    return { wageList, sumWage };
  }

  // (1) Z1000 약국관리료 — [C-1] text3 적용
  addWage(z1000Code(sc, text3), 1);

  // (2) Z2000 기본조제기술료 — [C-1] text3, [C-16] 소아심야 분기
  addWage(z2000Code(sc, text3, opt.dosDate), 1);

  // 2023.11.01 시행일 기준 플래그 (A-7 Z3000 심야 분기, A-6 산제 신체계 분기 공용)
  const isAfter20231101 = opt.dosDate >= '20231101';

  // (3) Z3000 복약지도료 — [C-1] text3, [C-16] 소아심야 분기
  // A-7 수정: 성인 심야(isMidNight=true, age>=6) 시 20231101 기준으로 신/구체계 분기
  // 근거: ch03_verifier.md §3 "C# BuildDrugGuideCode():L136"
  //        99_FINAL_REPORT.md §4.3 C-10
  // 주: C-16 이후 성인심야는 determineSurcharge에서 야간(holidayGb='1')으로 다운그레이드.
  //     A-7 분기는 opt.isMidNight 원본 체크로 유지 (호환성)
  {
    const isAdultMidNight = (opt.isMidNight === true) && (opt.age >= 6);
    if (isAdultMidNight) {
      // 성인 심야: 야간으로 다운그레이드되었으나 Z3000은 심야 전용 코드 직접 사용
      const midNightCode = isAfter20231101
        ? 'Z300004' + text3   // Z3000040/Z3000041
        : 'Z300002' + text3;  // Z3000020/Z3000021
      addWage(midNightCode, 1);
    } else {
      addWage(z3000Code(sc, text3, opt.dosDate), 1);
    }
  }

  // (4) Z4xxx 약품조제료
  // 산제 가산 활성 시: 2023.11.01 이후 → Z41xx100 코드 사용 (별도 경로)
  //                    2023.11.01 이전 → 기본 Z41xx + Z4010 별도 행
  const usePowderNewCode = isPowder && isAfter20231101;

  if (drugCtx.hasInternal) {
    if (usePowderNewCode) {
      // 신체계 산제: Z41xx100(1~15일) 또는 Z43xx100(16일+) 코드 (기본조제료 대체)
      // A-6 수정: 16일+ 시 Z4116 하드코딩 버그 → repo.getPrescDosageFee() 조회 후 100 접미사 부착
      // 근거: ch02_verifier.md §3 "Z4316이 올바른 코드이며 실제 구간을 repo에서 조회해야 한다"
      //       DispensingFeeCalculator.cs:GetInJojeSugaCD():L652-666
      if (drugCtx.maxInternalDay <= 15) {
        // 1~15일: Z41xx100 직접 결정
        const baseCode = `Z41${String(drugCtx.maxInternalDay).padStart(2, '0')}`;
        const powderCode = baseCode + '100';
        if (getPrice(powderCode) > 0) {
          addWage(powderCode, 1);
        } else {
          addWage(baseCode, 1);
        }
      } else {
        // 16일+: presc_dosage_fee 테이블에서 Z43xx 구간 코드 조회 후 100 접미사 부착
        const row = await repo.getPrescDosageFee(year, drugCtx.maxInternalDay);
        if (row) {
          const powderCode = row.sugaCode + '100';
          const finalPrice = getPrice(powderCode) > 0 ? getPrice(powderCode) : row.fee;
          const finalName = getName(powderCode) || getName(row.sugaCode);
          wageList.push({
            sugaCd: powderCode,
            name: finalName,
            insuPay: '1',
            cnt: 1,
            price: finalPrice > 0 ? finalPrice : row.fee,
            sum: finalPrice > 0 ? finalPrice : row.fee,
            addType: '',
          });
        }
      }
    } else {
      // 일반 처방조제 or 구체계 산제 — [C-1] text3 적용
      // C-5: 비급여 조제료 차액 산정
      // 근거: DispensingFeeCalculator.cs:TryCalcPresInternalSeparated():L1194-L1277
      // insuDose > 0 이고 실제 투약일수(maxInternalDay) > 보험 투약일수(insuDose) 이면
      // 급여분(insuDose 기준) + 차액분(actualDosage - insuDosage, insuPay="0") 로 분리 산정
      const effectiveInsuDose = (opt.insuDose && opt.insuDose > 0)
        ? opt.insuDose
        : drugCtx.maxInternalDay;
      const hasSeparated = effectiveInsuDose < drugCtx.maxInternalDay;

      // 급여분 (보험 투약일수 기준)
      const { code: insuCode, needsTableLookup: insuNeedsLookup } =
        z4InternalCode(effectiveInsuDose, sc, text3);

      let insuPrice = 0;

      if (insuNeedsLookup) {
        const row = await repo.getPrescDosageFee(year, effectiveInsuDose);
        if (row) {
          let finalCode = row.sugaCode;
          if (sc.holidayGb === '1' || sc.holidayGb === '8') finalCode += '01' + text3;
          else if (sc.holidayGb === '9') finalCode += '02' + text3;
          else if (sc.holidayGb === '5' || sc.holidayGb === '7') finalCode += '050';

          insuPrice = getPrice(finalCode) > 0 ? getPrice(finalCode) : row.fee;
          const finalName = getName(finalCode) || getName(row.sugaCode);
          wageList.push({
            sugaCd: finalCode,
            name: finalName,
            insuPay: '1',
            cnt: 1,
            price: insuPrice > 0 ? insuPrice : row.fee,
            sum: insuPrice > 0 ? insuPrice : row.fee,
            addType: '',
          });
          insuPrice = insuPrice > 0 ? insuPrice : row.fee;
        }
      } else {
        insuPrice = getPrice(insuCode);
        addWage(insuCode, 1);
      }

      // C-5: 차액분 (비급여 행, insuPay="0")
      // 근거: DispensingFeeCalculator.cs:TryCalcPresInternalSeparated():L1234-L1257
      if (hasSeparated) {
        const { code: actualCode, needsTableLookup: actualNeedsLookup } =
          z4InternalCode(drugCtx.maxInternalDay, sc, text3);

        let actualPrice = 0;
        let actualSugaCd = actualCode;

        if (actualNeedsLookup) {
          const row = await repo.getPrescDosageFee(year, drugCtx.maxInternalDay);
          if (row) {
            let finalCode = row.sugaCode;
            if (sc.holidayGb === '1' || sc.holidayGb === '8') finalCode += '01' + text3;
            else if (sc.holidayGb === '9') finalCode += '02' + text3;
            else if (sc.holidayGb === '5' || sc.holidayGb === '7') finalCode += '050';
            actualPrice = getPrice(finalCode) > 0 ? getPrice(finalCode) : row.fee;
            actualSugaCd = finalCode;
          }
        } else {
          actualPrice = getPrice(actualCode);
        }

        const diffPrice = actualPrice - insuPrice;
        if (diffPrice > 0) {
          // NPayRoundType 적용 (비급여 차액 반올림)
          // 근거: RoundingHelper.cs:ApplyNPayRound():L118-L132
          const roundedDiff = applyNPayRound(diffPrice, opt.nPayRoundType);
          if (roundedDiff > 0) {
            wageList.push({
              sugaCd: actualSugaCd,
              name: getName(actualSugaCd),
              insuPay: '0',
              cnt: 1,
              price: roundedDiff,
              sum: roundedDiff,
              addType: '',
            });
          }
        }
      }
    }

    // 외용도 같이 있으면 Z4121 동시조제료 추가 — [C-1] text3 적용
    if (drugCtx.hasExternal) {
      addWage(z4BothCode(sc, text3), 1);
    }
  } else if (drugCtx.hasExternal) {
    // 외용만 — [C-1] text3 적용
    addWage(z4ExternalCode(sc, text3), 1);
  }

  // (5) 의약품관리료 — B-8: Z5001/Z5011 분기 + 25구간 가산 행
  // 근거: DispensingFeeCalculator.cs CalcDrugMgm() L1524, GetMedMgmtSugaCD() L672
  if (drugCtx.allPack) {
    // 병팩 전용 관리료 — Z5011만 산정 후 return
    addWage('Z5011', 1);
  } else {
    // 기본 관리료: 마약/향정 포함 시 Z5001, 일반 시 Z5000
    const baseCode = drugCtx.hasNarcotic ? 'Z5001' : 'Z5000';
    addWage(baseCode, 1);

    // 일수별 가산 행 (25구간 코드 Z5101~Z5391)
    // price=0이면 addWage 내부에서 자동 skip → 단가 미등록 상태에서도 안전
    const hasExternalOnly = drugCtx.hasExternal && !drugCtx.hasInternal;
    const managementDays =
      drugCtx.maxInternalDay > 0 ? drugCtx.maxInternalDay : drugCtx.maxExternalDay;
    addWage(getMedMgmtSugaCode(managementDays, hasExternalOnly), 1);
  }

  // ── (6) 산제 가산 행 추가 (구체계: 2023.11.01 이전 Z4010) ─────────────────
  if (isPowder && !usePowderNewCode && drugCtx.hasInternal) {
    const powderResult = await calcPowderSurchargeFromCtx({
      options: opt,
      repo,
      maxInternalDay: drugCtx.maxInternalDay,
      isAfter20231101: false,
    });
    wageList.push(...powderResult.wageItems);
  }

  // ── (7) 토요 가산 별도 행 (2016.09.29 이후) ─────────────────────────────
  // 기존 wageList에서 토요 가산 대상 코드를 찾아 030 행 삽입
  // 단, 가루약 가산 활성 시(isPowder=true)는 토요 가산 비활성화 상태
  if (opt.isSaturday && !isPowder) {
    wageList = applySaturdaySurchargeRows(wageList, opt.dosDate, true);
  }

  // ── (8) 명절 가산 (ZE 계열) ──────────────────────────────────────────────
  const isNonFace = opt.isNonFace ?? false;
  const seasonalItem = calcSeasonalSurcharge(opt.dosDate, opt.insuCode, isNonFace);
  if (seasonalItem) {
    wageList.push(seasonalItem);
  }

  // ── (9) 복약상담료/비대면 조제 가산 (Z7001/ZC 계열) ────────────────────
  const counselingResult = await calcCounseling({
    options: opt,
    repo,
    isNonFace: opt.isNonFace,
    hasCounseling: opt.hasCounseling,
    isDalbitPharmacy: opt.isDalbitPharmacy,
  });
  if (counselingResult.wageItems.length > 0) {
    wageList.push(...counselingResult.wageItems);
  }

  const sumWage = wageList.reduce((s, w) => s + w.sum, 0);
  return { wageList, sumWage };
}
