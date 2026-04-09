/**
 * calc-engine/drug-amount.ts
 * 약품금액 계산 — CH01 기반
 *
 * 공식: (int)(소모량 × 단가 + 0.5)
 * 소모량 = 1회투약량 × 1일투여횟수 × 총투여일수 / 포장단위
 *
 * [B-11] EXTYPE 필터 + Del_Yn 분기:
 *   - exType="1": 심사 제외 → skip (약품금액 집계/sectionTotals 모두 제외)
 *   - exType="9" && dosDate >= "20200301": 100% 본인부담 → 조제료 계산 대상 제외,
 *       단 약품금액 집계(sectionU)에는 반영 (C-8)
 *   - delYn="F": 폐기 약품 → 비급여(nonCovered) 강제전환 후 W항 합산
 *   근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L334-L335 (조제료 제외),
 *         C# DispensingFeeCalculator.cs:AssembleResult():L1796-L1822 (약품금액 집계),
 *         CH01_약품금액_계산.md §3-3
 *
 * [C-6] ForceSetSum — 비급여 코로나19 치료제 50,000원 강제 세팅:
 *   - insuPay='nonCovered' AND dosDate >= '20240501'
 *   - 대상 코드: 648903670 / 655502130 / 648903860
 *   - 약품금액 합계를 50,000원으로 강제 (단가×소모량 계산 결과 무시)
 *   근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346,
 *         drug.ForceSetSum(50000m)
 *
 * [C-8] EXTYPE9 → sectionU 전환 (3자배분 반영):
 *   - exType="9" && dosDate >= "20200301" 약품은 조제료 계산에서만 제외
 *   - 약품금액 집계에서는 sectionU(U항)에 포함 → _calcUSection에서 3자배분 반영
 *   근거: C# AssembleResult():L1818-L1822 — InsuPay=FullSelf → sumInsuDrug100 누적
 */

import type { DrugItem, SectionTotals } from './types';

// ─── [C-6] 비급여 코로나19 치료제 50,000원 강제 세팅 상수 ──────────────────────

/** ForceSetSum 적용 시작일 (yyyyMMdd) */
const FORCE_SET_SUM_START_DATE = '20240501';

/** ForceSetSum 고정단가 50,000원 */
const FORCE_SET_SUM_AMOUNT = 50000;

/** 비급여 코로나19 치료제 코드 목록 (3종) */
const CORONA_DRUG_CODES = new Set(['648903670', '655502130', '648903860']);

/**
 * 비급여 코로나19 치료제 50,000원 강제 세팅 판정
 *
 * C# DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346 포팅
 *   if (drug.InsuPay == NonCovered
 *       && dosDate >= "20240501"
 *       && (code == "648903670" || code == "655502130" || code == "648903860"))
 *     drug.ForceSetSum(50000m);
 *
 * @param drug    DrugItem
 * @param dosDate 조제일자 yyyyMMdd
 * @returns 50,000원 강제 세팅 대상이면 true
 */
export function isForceSetSum(drug: DrugItem, dosDate?: string): boolean {
  if (drug.insuPay !== 'nonCovered') return false;
  if (!dosDate || dosDate < FORCE_SET_SUM_START_DATE) return false;
  return CORONA_DRUG_CODES.has(drug.code);
}

/**
 * 약품 1줄의 금액을 계산한다.
 *
 * @param drug DrugItem
 * @returns 약품금액 (정수, 원) — 원미만 사사오입
 */
export function calcDrugAmount(drug: DrugItem): number {
  const pack = drug.pack && drug.pack > 1 ? drug.pack : 1;
  const amount = (drug.dose * drug.dNum * drug.dDay) / pack;
  // (int)(amount * price + 0.5) — 4사5입
  return Math.floor(amount * drug.price + 0.5);
}

/**
 * EXTYPE 필터 판정 — 해당 약품을 약품금액 합산에서 **완전 제외**할지 여부를 반환한다.
 *
 * 완전 제외 조건:
 *   - exType="1" : 심사 제외 약품 → 무조건 완전 제외 (sectionTotals에도 미반영)
 *   근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L334
 *
 * ※ exType="9"는 이 함수에서 제외하지 않는다. EXTYPE9 약품은 조제료 계산(classifyDrugs)
 *    에서만 제외되고, 약품금액 집계(AssembleResult)에서는 sectionU(U항)에 포함된다.
 *    → calcDrugAmountSum 루프 내 isExType9ForSection 분기로 처리.
 *    근거: C# DispensingFeeCalculator.cs:AssembleResult():L1818-L1822
 *
 * @param drug    DrugItem
 * @returns true → 완전 제외(skip), false → 계산에 포함
 */
export function isExcludedByExType(drug: DrugItem): boolean {
  const et = drug.exType ?? '';
  return et === '1';
}

/**
 * EXTYPE9 약품 판정 — sectionU에는 포함하되 sumInsu/조제료 계산에서는 제외하는 약품인지.
 *
 * 조건: exType="9" && dosDate >= "20200301"
 *   - 2020.03.01 이후: 조제료 계산 제외 + 약품금액은 sectionU에만 반영 (C-8)
 *   - 2020.03.01 이전: 일반 처리 (EXTYPE 없는 것처럼)
 *
 * 근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L335 (조제료 skip),
 *       AssembleResult():L1818-L1822 (약품금액 sectionU 누적)
 *
 * @param drug    DrugItem
 * @param dosDate 조제일자 yyyyMMdd
 * @returns true → sectionU 전용 처리 (sumInsu 제외), false → 일반 처리
 */
export function isExType9ForSection(drug: DrugItem, dosDate?: string): boolean {
  if ((drug.exType ?? '') !== '9') return false;
  const date = dosDate ?? '99991231'; // dosDate 미전달 시 최신으로 처리
  return date >= '20200301';
}

/**
 * Del_Yn 코드에 따라 insuPay를 재결정한다 (Del_Yn="F" 폐기 약품 전용).
 *
 * calc-engine은 EDB 방식(외부에서 price/insuPay를 결정해서 전달)을 따르므로
 * 대부분의 Del_Yn 분기는 상위 계층 책임이다.
 * 단, Del_Yn="F"(폐기) 약품이 잘못 입력된 경우에 대한 안전망으로,
 * calc-engine 내부에서 강제 비급여 전환 처리한다.
 *
 * 분기 요약 (비즈팜 기준, CH01_약품금액_계산.md §3-3):
 *   - (없음/"")/"M"/"G"/"P"/"A"/"B"/"C" → 상위 계층에서 이미 처리됨, 변경 없음
 *   - "F" → 폐기 약품, 강제 nonCovered 전환
 *
 * @param drug DrugItem
 * @returns 유효 insuPay (del_Yn="F"이면 'nonCovered', 그 외 drug.insuPay 그대로)
 */
export function resolveInsuPayByDelYn(drug: DrugItem): DrugItem['insuPay'] {
  if (drug.delYn === 'F') {
    return 'nonCovered'; // 폐기 약품 → 강제 비급여
  }
  return drug.insuPay;
}

/**
 * 약품 목록의 급여약품 금액 합계를 산출한다.
 * (비급여는 sumUserDrug로 분리, MVP에서는 급여합계만 반환)
 *
 * B-1 확장: 기존 sumInsu/sumUser 필드는 후방 호환 유지,
 * sectionTotals 필드로 항별(01/A/B/D/E/U/V/W) 독립 집계를 추가한다.
 *
 * [B-11] EXTYPE 필터 + Del_Yn 분기 추가:
 *   - exType="1": 심사 제외 → loop 완전 skip (sectionTotals 미반영)
 *   - exType="9" && dosDate >= "20200301": 조제료 계산 제외 + sectionU에만 반영 (C-8)
 *   - delYn="F": 폐기 → insuPay를 nonCovered로 강제전환 후 W항 합산
 *
 * 항별 분류 기준 (CH10 §Step3-4, CH01 §4-1,
 *   C# DispensingFeeCalculator.cs:AssembleResult():L1796-L1824):
 *   covered    → 01항 (급여 일반)
 *   partial50  → A항  (선별급여 50%)
 *   partial80  → B항  (선별급여 80%)
 *   partial30  → D항  (선별급여 30%)
 *   partial90  → E항  (선별급여 90%)
 *   fullSelf   → U항  (100% 본인부담)
 *   veteran100 → V항  (보훈 100/100)
 *   nonCovered → W항  (비급여)
 *
 * @param drugs   DrugItem 배열
 * @param dosDate 조제일자 yyyyMMdd (EXTYPE="9" 날짜 분기에 사용)
 */
export function calcDrugAmountSum(drugs: DrugItem[], dosDate?: string): {
  sumInsu: number;       // 급여약 합계 (01항+A+B+D+E — 기존 필드, 후방 호환)
  sumUser: number;       // 비급여약 합계 (W항 — 기존 필드, 후방 호환)
  sectionTotals: SectionTotals; // 항별 독립 집계 (B-1 신설)
} {
  let sumInsu = 0;
  let sumUser = 0;

  const sectionTotals: SectionTotals = {
    section01: 0,
    sectionA: 0,
    sectionB: 0,
    sectionD: 0,
    sectionE: 0,
    sectionU: 0,
    sectionV: 0,
    sectionW: 0,
  };

  for (const drug of drugs) {
    // ── [B-11] EXTYPE="1" 필터: 심사 제외 약품 완전 skip ────────────────────
    // exType="1" → sectionTotals에도 미반영, sumInsu/sumUser에도 미포함
    // 근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L334
    if (isExcludedByExType(drug)) continue;

    // ── [C-8] EXTYPE="9" 약품: sectionU에만 반영 (sumInsu 제외) ─────────────
    // exType="9" && dosDate >= "20200301":
    //   조제료 계산(classifyDrugs)에서는 제외되지만,
    //   약품금액 집계(AssembleResult)에서는 InsuPay=FullSelf → sumInsuDrug100(U항) 누적
    // 근거: C# DispensingFeeCalculator.cs:AssembleResult():L1818-L1822
    if (isExType9ForSection(drug, dosDate)) {
      const amt9 = calcDrugAmount(drug);
      sectionTotals.sectionU += amt9;
      // sumInsu/sumUser 에는 포함하지 않음 (조제료 계산에서 제외되는 것과 연동)
      continue;
    }

    // ── [C-6] ForceSetSum: 비급여 코로나19 치료제 50,000원 강제 세팅 ─────────
    // 조건: insuPay='nonCovered' + dosDate >= '20240501' + 코드 3종
    // 근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346
    const amt = isForceSetSum(drug, dosDate)
      ? FORCE_SET_SUM_AMOUNT
      : calcDrugAmount(drug);

    // ── [B-11] Del_Yn="F" 폐기 약품: 강제 비급여 전환 ───────────────────────
    const effectiveInsuPay = resolveInsuPayByDelYn(drug);

    // ── 항별 분류 집계 (B-1) ──────────────────────────────────────────────
    switch (effectiveInsuPay) {
      case 'covered':
        sectionTotals.section01 += amt;
        break;
      case 'partial50':
        sectionTotals.sectionA += amt;
        break;
      case 'partial80':
        sectionTotals.sectionB += amt;
        break;
      case 'partial30':
        sectionTotals.sectionD += amt;
        break;
      case 'partial90':
        sectionTotals.sectionE += amt;
        break;
      case 'fullSelf':
        // exType="9" 이외의 fullSelf(insuPay로 직접 지정된 100%약품)
        sectionTotals.sectionU += amt;
        break;
      case 'veteran100':
        sectionTotals.sectionV += amt;
        break;
      case 'nonCovered':
        sectionTotals.sectionW += amt;
        break;
    }

    // ── 기존 2분류 (후방 호환 유지) ────────────────────────────────────────
    if (effectiveInsuPay === 'nonCovered') {
      sumUser += amt;
    } else {
      // covered / partial50/80/30/90 / fullSelf / veteran100
      // 주: U항(fullSelf), V항(veteran100)도 sumInsu에 포함하는 것이
      //   현재 MVP의 기존 동작이므로 후방 호환상 그대로 유지
      sumInsu += amt;
    }
  }

  return { sumInsu, sumUser, sectionTotals };
}
