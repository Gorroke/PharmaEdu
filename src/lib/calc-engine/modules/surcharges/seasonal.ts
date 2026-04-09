/**
 * modules/surcharges/seasonal.ts
 * 명절(설/추석) 연휴 가산 계산 모듈
 *
 * 수가코드: ZE 계열
 *   ZE100  — 2024 추석 연휴 기본 가산 (1,000원)
 *   ZE010  — 2025 설날 연휴 기본 가산 (1,000원)
 *   ZE020  — 2025 설날 당일 가산    (3,000원 = 연휴 1,000 + 당일 2,000)
 *   ZE101  — 2025 추석 연휴 기본 가산 (1,000원)
 *   ZE102  — 2025 추석 당일 가산    (3,000원 = 연휴 1,000 + 당일 2,000)
 *
 * 적용 조건:
 *   - 건강보험(C계열), 의료급여(D계열) 등 급여 보험코드
 *   - 비대면(isNonFace) 조제 시 미적용
 *   - 비급여만인 경우 미적용 (insuCode가 급여 계열이 아닌 경우)
 *
 * 명절 날짜 (하드코딩):
 *   2024 추석: 2024-09-14 ~ 2024-09-18 (당일: 2024-09-17)
 *              09-14~09-15(선행일) + 09-16~09-18(본 연휴) 2개 항목으로 분리 등록
 *   2025 설날: 2025-01-25 ~ 2025-01-30 + 2025-02-01 ~ 2025-02-02 (당일: 2025-01-29)
 *              비연속 범위이므로 HOLIDAY_TABLE에 3개 항목으로 분리 등록
 *   2025 추석: 2025-10-03 ~ 2025-10-09 (당일: 2025-10-06)
 *              비연속 범위이므로 HOLIDAY_TABLE에 3개 항목으로 분리 등록
 *
 * 참조 문서:
 *   - output/CH08_특수케이스.md §2 명절가산
 *   - C#: DispensingFeeCalculator.cs → 명절 가산 분기
 */

import type { WageListItem } from '../../types';

// ─── 명절 날짜 테이블 ─────────────────────────────────────────────────────────

/**
 * 명절 연휴 정의 (하드코딩)
 * dosDate 형식: yyyyMMdd (예: '20240916')
 */
interface HolidayDef {
  /** 수가코드: 연휴 기간 기본 가산 (당일 제외) */
  code: string;
  /** 수가코드: 당일 가산 */
  codeActual: string;
  /** 수가명 (기본) */
  name: string;
  /** 수가명 (당일) */
  nameActual: string;
  /** 연휴 시작일 yyyyMMdd */
  start: string;
  /** 연휴 종료일 yyyyMMdd */
  end: string;
  /** 명절 당일 yyyyMMdd */
  actualDay: string;
  /** 연휴 기본 가산액 (원) */
  baseAmount: number;
  /** 당일 가산 합계액 (원) = 연휴 기본 + 당일 추가 */
  actualAmount: number;
}

const HOLIDAY_TABLE: HolidayDef[] = [
  // 2024 추석 연휴 선행일: 09-14(토)·09-15(일) — 기본 가산만 (당일 없음)
  {
    code:         'ZE100',
    codeActual:   'ZE100', // 이 범위에 추석 당일 없음 → 항상 연휴 기본 가산
    name:         '2024 추석 연휴 명절가산',
    nameActual:   '2024 추석 연휴 명절가산',
    start:        '20240914',
    end:          '20240915',
    actualDay:    '99999999', // 범위 내 당일 없음 — isActualDay 항상 false
    baseAmount:   1000,
    actualAmount: 1000,
  },
  {
    code:         'ZE100',
    codeActual:   'ZE100', // 2024 추석은 당일/연휴 코드 구분 없음
    name:         '2024 추석 연휴 명절가산',
    nameActual:   '2024 추석 당일 명절가산',
    start:        '20240916',
    end:          '20240918',
    actualDay:    '20240917',
    baseAmount:   1000,
    actualAmount: 1000, // 2024 추석은 단일 코드 1,000원
  },
  // 2025 설날 연휴는 비연속(01-25~01-30 + 02-01~02-02)이므로 3개 항목으로 분리 등록
  // ① 설날 전 연휴: 01-25(토)·01-26(일)·01-27(월) — 기본 가산만 (당일 없음)
  {
    code:         'ZE010',
    codeActual:   'ZE010', // 이 범위에 설날 당일 없음 → 항상 연휴 기본 가산
    name:         '2025 설날 연휴 명절가산',
    nameActual:   '2025 설날 연휴 명절가산',
    start:        '20250125',
    end:          '20250127',
    actualDay:    '99999999', // 범위 내 당일 없음 — isActualDay 항상 false
    baseAmount:   1000,
    actualAmount: 1000,
  },
  // ② 설날 본 연휴: 01-28(수)·01-29(목, 설날 당일)·01-30(금)
  {
    code:         'ZE010',
    codeActual:   'ZE020',
    name:         '2025 설날 연휴 명절가산',
    nameActual:   '2025 설날 당일 명절가산',
    start:        '20250128',
    end:          '20250130',
    actualDay:    '20250129',
    baseAmount:   1000,
    actualAmount: 3000,
  },
  // ③ 설날 후 연휴: 02-01(토)·02-02(일) — 기본 가산만 (당일 없음)
  {
    code:         'ZE010',
    codeActual:   'ZE010', // 이 범위에 설날 당일 없음 → 항상 연휴 기본 가산
    name:         '2025 설날 연휴 명절가산',
    nameActual:   '2025 설날 연휴 명절가산',
    start:        '20250201',
    end:          '20250202',
    actualDay:    '99999999', // 범위 내 당일 없음 — isActualDay 항상 false
    baseAmount:   1000,
    actualAmount: 1000,
  },
  // 2025 추석 연휴는 비연속(10-03~10-04 + 10-05~10-07 + 10-08~10-09)이므로 3개 항목으로 분리 등록
  // ① 추석 전 연휴: 10-03(금)·10-04(토) — 기본 가산만 (당일 없음)
  {
    code:         'ZE101',
    codeActual:   'ZE101', // 이 범위에 추석 당일 없음 → 항상 연휴 기본 가산
    name:         '2025 추석 연휴 명절가산',
    nameActual:   '2025 추석 연휴 명절가산',
    start:        '20251003',
    end:          '20251004',
    actualDay:    '99999999', // 범위 내 당일 없음 — isActualDay 항상 false
    baseAmount:   1000,
    actualAmount: 1000,
  },
  // ② 추석 본 연휴: 10-05(일)·10-06(월, 추석 당일)·10-07(화)
  {
    code:         'ZE101',
    codeActual:   'ZE102',
    name:         '2025 추석 연휴 명절가산',
    nameActual:   '2025 추석 당일 명절가산',
    start:        '20251005',
    end:          '20251007',
    actualDay:    '20251006',
    baseAmount:   1000,
    actualAmount: 3000,
  },
  // ③ 추석 후 연휴: 10-08(수)·10-09(목) — 기본 가산만 (당일 없음)
  {
    code:         'ZE101',
    codeActual:   'ZE101', // 이 범위에 추석 당일 없음 → 항상 연휴 기본 가산
    name:         '2025 추석 연휴 명절가산',
    nameActual:   '2025 추석 연휴 명절가산',
    start:        '20251008',
    end:          '20251009',
    actualDay:    '99999999', // 범위 내 당일 없음 — isActualDay 항상 false
    baseAmount:   1000,
    actualAmount: 1000,
  },
];

// ─── 급여 보험코드 판정 ───────────────────────────────────────────────────────

/**
 * 명절가산 적용 대상 보험코드 여부 판정
 *
 * 적용: 건강보험(C), 의료급여(D) 계열
 * 미적용: 보훈(G), 자동차보험(F), 산재(E) 및 기타
 *
 * @param insuCode 보험코드 (예: 'C10', 'D10', 'G10')
 */
function isEligibleInsuCode(insuCode: string): boolean {
  if (!insuCode || insuCode.length === 0) return false;
  const first = insuCode.charAt(0).toUpperCase();
  return first === 'C' || first === 'D';
}

// ─── 공개 함수 ────────────────────────────────────────────────────────────────

/**
 * 조제일자가 명절가산 대상인지 판정
 *
 * @param dosDate 조제일자 (yyyyMMdd 형식, 예: '20250129')
 * @returns 가산 코드(ZE100 등), 가산액(원), 당일 여부를 포함한 객체 또는 null
 *
 * @example
 * detectSeasonalHoliday('20250129')
 * // → { code: 'ZE020', amount: 3000, isActualDay: true }
 *
 * detectSeasonalHoliday('20250128')
 * // → { code: 'ZE010', amount: 1000, isActualDay: false }
 *
 * detectSeasonalHoliday('20250101')
 * // → null
 */
export function detectSeasonalHoliday(
  dosDate: string
): { code: string; amount: number; isActualDay: boolean } | null {
  for (const holiday of HOLIDAY_TABLE) {
    if (dosDate >= holiday.start && dosDate <= holiday.end) {
      const isActualDay = dosDate === holiday.actualDay;

      if (isActualDay) {
        return {
          code:        holiday.codeActual,
          amount:      holiday.actualAmount,
          isActualDay: true,
        };
      } else {
        return {
          code:        holiday.code,
          amount:      holiday.baseAmount,
          isActualDay: false,
        };
      }
    }
  }
  return null;
}

/**
 * 명절가산 WageListItem 생성
 *
 * 다음 조건에서 null 반환 (미적용):
 *   1. 조제일자가 명절 연휴에 해당하지 않음
 *   2. 비대면 조제 (isNonFace === true)
 *   3. 급여 미적용 보험코드 (보훈/자동차보험/산재 등)
 *
 * @param dosDate   조제일자 (yyyyMMdd)
 * @param insuCode  보험코드 (예: 'C10', 'D10')
 * @param isNonFace 비대면 조제 여부
 * @returns WageListItem 또는 null
 *
 * @example
 * calcSeasonalSurcharge('20250129', 'C10', false)
 * // → { sugaCd: 'ZE020', name: '2025 설날 당일 명절가산', insuPay: '1',
 * //     cnt: 1, price: 3000, sum: 3000, addType: 'seasonal' }
 */
export function calcSeasonalSurcharge(
  dosDate: string,
  insuCode: string,
  isNonFace: boolean
): WageListItem | null {
  // 비대면 조제는 명절가산 미적용
  if (isNonFace) return null;

  // 급여 보험코드가 아닌 경우 미적용
  if (!isEligibleInsuCode(insuCode)) return null;

  // 명절 날짜 판정
  const holiday = detectSeasonalHoliday(dosDate);
  if (holiday === null) return null;

  // 수가명 결정
  const def = HOLIDAY_TABLE.find(h => {
    if (h.code === holiday.code || h.codeActual === holiday.code) return true;
    return false;
  });
  const name = def
    ? (holiday.isActualDay ? def.nameActual : def.name)
    : `명절가산(${holiday.code})`;

  return {
    sugaCd:  holiday.code,
    name,
    insuPay: '1',
    cnt:     1,
    price:   holiday.amount,
    sum:     holiday.amount,
    addType: 'seasonal',
  };
}

// ─── 레거시 인터페이스 (통합 레이어 호환용) ──────────────────────────────────

import type { CalcOptions, ICalcRepository } from '../../types';

/**
 * 명절 가산 계산 컨텍스트 (Phase 5 통합 레이어용)
 */
export interface SeasonalCalcContext {
  options: CalcOptions;
  repo: ICalcRepository;
}

/**
 * 명절 가산 계산 결과 (Phase 5 통합 레이어용)
 */
export interface SeasonalCalcResult {
  wageItems: WageListItem[];
  sumSeasonal: number;
  applied: boolean;
}

/**
 * 명절 연휴 가산 계산 (async 래퍼 — 통합 레이어 호환)
 *
 * calcSeasonalSurcharge()의 async 래퍼.
 * isNonFace 는 ctx.options.isNonFace 에서, insuCode는 ctx.options.insuCode에서 읽는다.
 *
 * @param ctx SeasonalCalcContext
 * @returns SeasonalCalcResult
 */
export async function calcSeasonalSurchargeCtx(
  ctx: SeasonalCalcContext
): Promise<SeasonalCalcResult> {
  const { dosDate, insuCode } = ctx.options;
  const isNonFace = ctx.options.isNonFace === true;
  const item = calcSeasonalSurcharge(dosDate, insuCode, isNonFace);

  if (item === null) {
    return { wageItems: [], sumSeasonal: 0, applied: false };
  }

  return {
    wageItems:   [item],
    sumSeasonal: item.sum,
    applied:     true,
  };
}
