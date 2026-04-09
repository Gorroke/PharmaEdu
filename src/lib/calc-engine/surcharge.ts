/**
 * calc-engine/surcharge.ts
 * 가산 판정 로직 — CH04 기반
 *
 * 가산 우선순위 (상호 배타적 if-else 체인):
 *   [전제] 비대면 조제 → 모든 가산 비활성화
 *   1순위: 가루약 가산 → 야간/공휴/소아심야/토요/소아 전부 배제
 *   2순위: 야간/공휴 가산 → 배타적(야간 또는 공휴 중 하나)
 *   3순위: 소아심야 가산 → 2순위 미해당 시
 *   4순위: 토요 가산 → 2~3순위 미해당 시
 *   [추가] 소아 가산: 1순위(가루약) 미적용 시 2~4순위와 중복 가능
 *
 * holidayGb 코드 체계 (비즈팜 호환):
 *   "0" — 해당 없음
 *   "1" — 야간
 *   "3" — 토요
 *   "5" — 공휴일
 *   "6" — 6세 미만 단독
 *   "7" — 6세 미만 + 공휴일
 *   "8" — 6세 미만 + 야간
 *   "9" — 6세 미만 + 심야 (소아심야 전용 — C-16 수정)
 *
 * Z코드 접미사:
 *   야간   → 010 (차등 해당) / 011 (차등 비해당)
 *   공휴일 → 050
 *   토요   → 030
 *   6세미만  → 600 (Z2000 전용)
 *   6세미만+야간  → 610 / 611 (Z2000 전용, 차등 해당/비해당)
 *   6세미만+공휴  → 650 (Z2000 전용)
 *   6세미만+심야  → 640 / 641 (Z2000 전용, 2023.11.01 이후, 차등 해당/비해당)
 *                  620      (Z2000 전용, 2023.11.01 이전)
 *
 * text3 (차등수가 접미사):
 *   "0" — 차등 해당 (건강보험 C 계열 기본)
 *   "1" — 차등 비해당 (비건강보험 또는 차등 면제)
 *
 * 근거: DispensingFeeCalculator.cs:BuildSuffix():L570,
 *        DispensingFeeCalculator.cs:BuildStoreManageCode():L96,
 *        DispensingFeeCalculator.cs:BuildBaseJojeCode():L101
 */

export interface SurchargeInput {
  /** 환자 나이 */
  age: number;
  /** 야간 가산 여부 */
  isNight?: boolean;
  /** 공휴일 가산 여부 */
  isHolyDay?: boolean;
  /** 토요일 가산 여부 */
  isSaturday?: boolean;
  /** 심야 가산 여부 (6세 미만 전용) */
  isMidNight?: boolean;
  /** 가루약(산제) 가산 여부 */
  isPowder?: boolean;
  /** 비대면 조제 여부 ("U") */
  isNonFace?: boolean;
}

export interface SurchargeFlags {
  /**
   * 비즈팜 호환 holiday_gb 단일 코드
   * "0"/"1"/"3"/"5"/"6"/"7"/"8"/"9"
   * "9" = 6세 미만 + 심야(소아심야) — C-16 신규
   */
  holidayGb: string;

  /** 가루약 가산 활성 여부 */
  isPowder: boolean;

  /** 6세 미만 가산 활성 여부 */
  isChild: boolean;

  /** 토요 가산 활성 여부 (별도 행 분리용) */
  isSaturday: boolean;

  /** 야간 가산 활성 여부 */
  isNight: boolean;

  /** 공휴일 가산 활성 여부 */
  isHolyDay: boolean;

  /** 소아심야 가산 활성 여부 (holidayGb="9") — C-16 신규 */
  isMidNight: boolean;
}

/**
 * 가산 판정 — 우선순위 체인 적용
 *
 * C# 원본: DispensingFeeCalculator.cs:DetermineSurcharge():L496
 *
 * @param input 가산 입력 파라미터
 * @returns SurchargeFlags — 어느 가산이 활성화되었는지와 holidayGb 코드
 */
export function determineSurcharge(input: SurchargeInput): SurchargeFlags {
  const age = typeof input.age === 'number' ? input.age : 0;
  const isChild = age < 6;

  // [전제] 비대면 조제 → 모든 가산 비활성화
  if (input.isNonFace) {
    return {
      holidayGb: '0',
      isPowder: false,
      isChild: false,
      isSaturday: false,
      isNight: false,
      isHolyDay: false,
      isMidNight: false,
    };
  }

  // [1순위] 가루약 가산 → 다른 모든 가산 배제 (소아 포함)
  if (input.isPowder) {
    return {
      holidayGb: '0',
      isPowder: true,
      isChild: false, // 가루약 + 소아 → 소아 미적용
      isSaturday: false,
      isNight: false,
      isHolyDay: false,
      isMidNight: false,
    };
  }

  // ── [2순위] 야간/공휴 가산 (배타적) ────────────────────────────────────────
  // 공휴일이 야간보다 우선 (공휴일이면 야간 판정 생략)
  if (input.isHolyDay) {
    // 공휴일 + 6세 미만
    if (isChild) {
      return {
        holidayGb: '7',
        isPowder: false,
        isChild: true,
        isSaturday: false,
        isNight: false,
        isHolyDay: true,
        isMidNight: false,
      };
    }
    return {
      holidayGb: '5',
      isPowder: false,
      isChild: false,
      isSaturday: false,
      isNight: false,
      isHolyDay: true,
      isMidNight: false,
    };
  }

  if (input.isNight) {
    // 야간 + 6세 미만
    if (isChild) {
      return {
        holidayGb: '8',
        isPowder: false,
        isChild: true,
        isSaturday: false,
        isNight: true,
        isHolyDay: false,
        isMidNight: false,
      };
    }
    return {
      holidayGb: '1',
      isPowder: false,
      isChild: false,
      isSaturday: false,
      isNight: true,
      isHolyDay: false,
      isMidNight: false,
    };
  }

  // ── [3순위] 소아심야 가산 (6세 미만 + 심야) ────────────────────────────────
  // C# 원본: DetermineSurcharge():L529-L541
  if (input.isMidNight) {
    if (isChild) {
      // 6세 미만 + 심야 → 소아심야 (holidayGb="9")
      // C-16 수정: "8" 대신 "9" 사용하여 소아야간과 소아심야 구별
      return {
        holidayGb: '9',
        isPowder: false,
        isChild: true,
        isSaturday: false,
        isNight: false,
        isHolyDay: false,
        isMidNight: true,
      };
    } else {
      // 6세 이상 심야 → 야간으로 다운그레이드
      // C# 원본: else if (options.Age != "") { sc.IsNight = true; }
      // (나이가 있으면 다운그레이드, 없으면 무시 — 여기선 age=0이 기본이므로 항상 다운그레이드)
      return {
        holidayGb: '1',
        isPowder: false,
        isChild: false,
        isSaturday: false,
        isNight: true,
        isHolyDay: false,
        isMidNight: false,
      };
    }
  }

  // ── [4순위] 토요 가산 ────────────────────────────────────────────────────────
  // 2~3순위 미해당 시에만 (2016.09.29 이후 별도 행으로 분리)
  if (input.isSaturday) {
    // 토요 + 6세 미만: 소아 가산은 토요와 중복 가능
    return {
      holidayGb: '3',
      isPowder: false,
      isChild: isChild,
      isSaturday: true,
      isNight: false,
      isHolyDay: false,
      isMidNight: false,
    };
  }

  // ── 가산 없음 (소아 단독은 holidayGb="6") ───────────────────────────────────
  if (isChild) {
    return {
      holidayGb: '6',
      isPowder: false,
      isChild: true,
      isSaturday: false,
      isNight: false,
      isHolyDay: false,
      isMidNight: false,
    };
  }

  return {
    holidayGb: '0',
    isPowder: false,
    isChild: false,
    isSaturday: false,
    isNight: false,
    isHolyDay: false,
    isMidNight: false,
  };
}

// ─── 차등수가 (C-1) ───────────────────────────────────────────────────────────

/**
 * 차등수가 text3 결정
 *
 * C# 원본: DispensingFeeCalculator.cs:BuildSuffix():L589-L641
 *
 * 건강보험(보험코드 첫 자리 "C") + 야간/심야 조건 + 영업시간 충족 시 차등 비해당(text3="1").
 * 그 외 건강보험은 차등 해당(text3="0").
 * 비건강보험은 text3="0" (차등 비해당이나, Z1000001 같은 코드 불사용).
 *
 * PharmaEdu 구현 주의:
 * C#은 영업시간 DB 조회(`_repo.SelectManageInOutTime`)를 통해 토요4시간/평일8시간 기준으로
 * isChadungExempt를 판정하나, PharmaEdu는 그 데이터가 없다.
 * → CalcOptions.isChadungExempt 플래그로 외부 주입 방식 사용.
 *   플래그가 없으면 차등 해당(text3="0")으로 처리 (건강보험 C 계열 기본값).
 *
 * DrugSafeYN 'Y'/'A' → 차등 비해당(text3="1")
 * C# 근거: BuildSuffix():L598-L603, L635-L638
 *
 * @param insuCode 보험코드 (C10/D10/G10 등)
 * @param isNightOrMidNight 야간 또는 심야 여부
 * @param isChadungExempt 차등 면제 여부 (영업시간 기반, 외부 주입)
 * @param drugSafeYN 약물안전서비스 코드 ('Y'/'A'/'U'/'' 등)
 * @returns text3 — "0"(차등 해당) | "1"(차등 비해당)
 */
export function getTieredText3(
  insuCode: string,
  isNightOrMidNight: boolean,
  isChadungExempt: boolean,
  drugSafeYN?: string,
): '0' | '1' {
  const isHealthInsurance = insuCode.startsWith('C');

  if (isHealthInsurance) {
    // 약물안전서비스 Y/A → 차등 비해당
    if (drugSafeYN && (drugSafeYN[0] === 'Y' || drugSafeYN[0] === 'A')) {
      return '1';
    }
    // 영업시간 기반 차등 면제 (외부 주입)
    if (isNightOrMidNight && isChadungExempt) {
      return '1';
    }
    // 건강보험 기본: 차등 해당
    return '0';
  } else {
    // 비건강보험
    // 약물안전서비스 Y/A → "1" (C# L635-L638)
    if (drugSafeYN && (drugSafeYN[0] === 'Y' || drugSafeYN[0] === 'A')) {
      return '1';
    }
    return '0';
  }
}

/**
 * 4구간 차등지수 산출
 *
 * C# 구현은 영업시간 프록시(text3="0"/"1")만 있고 정식 4구간은 미구현.
 * PharmaEdu는 공식 4구간 공식을 직접 구현.
 *
 * 근거: ch04_analyst.md 부록 B §B-2, B-3
 *       상대가치점수표 제1부 일반원칙 III (고시 제2025-186호)
 *
 * @param dailyAvgCount 1일 평균 조제건수 (소수점 절사된 정수)
 * @returns 차등지수 (소수점 7자리, 4사5입)
 */
export function calcTieredIndex(dailyAvgCount: number): number {
  const n = Math.floor(dailyAvgCount); // 소수점 첫째 자리에서 절사

  let raw: number;

  if (n <= 75) {
    // 1구간: 100% (차등 없음)
    raw = 1.0;
  } else if (n <= 100) {
    // 2구간: 75×1.00 + (n-75)×0.90 / n
    raw = (75 * 1.00 + (n - 75) * 0.90) / n;
  } else if (n <= 150) {
    // 3구간: 75×1.00 + 25×0.90 + (n-100)×0.75 / n
    raw = (75 * 1.00 + 25 * 0.90 + (n - 100) * 0.75) / n;
  } else {
    // 4구간: 75×1.00 + 25×0.90 + 50×0.75 + (n-150)×0.50 / n
    raw = (75 * 1.00 + 25 * 0.90 + 50 * 0.75 + (n - 150) * 0.50) / n;
  }

  // 소수점 여덟째 자리에서 4사5입 → 소수점 일곱째 자리까지
  return Math.round(raw * 1e7) / 1e7;
}

/**
 * 4구간 구간 코드 반환
 *
 * @param dailyAvgCount 1일 평균 조제건수
 * @returns 구간 인덱스 (1~4)
 */
export function getTieredTier(dailyAvgCount: number): 1 | 2 | 3 | 4 {
  const n = Math.floor(dailyAvgCount);
  if (n <= 75) return 1;
  if (n <= 100) return 2;
  if (n <= 150) return 3;
  return 4;
}

/**
 * 차등수가 청구액 차감액 산출
 *
 * 차감액 = 조제료등_합계 × (1 - 차등지수)
 *
 * 근거: ch04_analyst.md 부록 B §B-4
 * 적용 대상: Z40~Z43 + Z10 + Z20 + Z30 합계
 * (Z10 의미I='1' 차등 제외분 — Z1000001 코드 — 는 제외)
 *
 * @param tieredIndex 차등지수 (calcTieredIndex 반환값)
 * @param dispensingFeeSum 차등 적용 대상 조제료 합계
 * @returns 차감액 (원, 정수)
 */
export function calcTieredDeduction(tieredIndex: number, dispensingFeeSum: number): number {
  return Math.round(dispensingFeeSum * (1 - tieredIndex));
}

// ─── 접미사 생성 ─────────────────────────────────────────────────────────────

/**
 * holidayGb + text3 → Z코드 접미사 변환
 *
 * C# 원본: DispensingFeeCalculator.cs:BuildBaseJojeCode():L101,
 *           BuildDrugGuideCode():L129, BuildStoreManageCode():L96,
 *           BuildTimedCode():L73
 *
 * @param holidayGb 비즈팜 holidayGb 코드 ("0"~"9")
 * @param codeType 수가 코드 종류
 * @param text3 차등수가 접미사 ("0" 또는 "1")
 * @param dosDate 조제일자 yyyyMMdd (소아심야 2023.11.01 분기용)
 * @returns 접미사 문자열 (없으면 "")
 */
export function getSurchargeSuffix(
  holidayGb: string,
  codeType: 'Z1000' | 'Z2000' | 'Z3000' | 'Z41xx' | 'Z4120' | 'Z4121' | 'other',
  text3: '0' | '1' = '0',
  dosDate?: string,
): string {
  switch (codeType) {
    case 'Z1000':
      // Z1000: 야간/심야일 때만 "00"+text3, 그 외 기본코드
      // C# BuildStoreManageCode(): (text2=="1"||"2") && text3=="1" → Z1000001
      // text3="0": Z1000 (기본), text3="1" + 야간: Z1000001
      if ((holidayGb === '1' || holidayGb === '8' || holidayGb === '9') && text3 === '1') {
        return '001'; // → Z1000001 (차등 비해당)
      }
      return ''; // Z1000 기본

    case 'Z2000':
      // Z2000 전용: 6세미만 복합 코드 존재
      // C# BuildBaseJojeCode(): 심야+6세미만 "64"+text3(이후) / "62"+text3(이전)
      //                         야간+6세미만 "61"+text3
      //                         공휴+6세미만 "650" (text3 없음)
      //                         야간 "01"+text3, 공휴 "05"+"0"
      switch (holidayGb) {
        case '1': return '01' + text3;     // 야간: 010/011
        case '5': return '050';            // 공휴 (text3 없음)
        case '6': return '600';            // 6세미만 단독
        case '7': return '650';            // 6세미만+공휴 (text3 없음)
        case '8': return '61' + text3;     // 6세미만+야간: 610/611
        case '9': {                        // 소아심야 (C-16)
          // 2023.11.01 이후: "640"/"641", 이전: "620"
          const isAfter = dosDate !== undefined && dosDate >= '20231101';
          if (isAfter) return '64' + text3; // 640/641
          return '620';                    // 이전: "62"+"0" (text3 미적용)
        }
        case '3': return '030';            // 토요 (text3 없음)
        default:  return '';
      }

    case 'Z3000':
      // Z3000: 6세미만 단독 코드 없음 (CH04 §4-3 주의사항)
      // C# BuildDrugGuideCode(): 심야 "04"+text3(이후)/"02"+text3(이전)
      //                          야간/공휴 BuildTimedCode → "0"+text2+text3
      switch (holidayGb) {
        case '1': return '01' + text3;     // 야간: 010/011
        case '8': return '01' + text3;     // 6세미만+야간도 야간 코드
        case '9': {                        // 소아심야 (C-16)
          const isAfter = dosDate !== undefined && dosDate >= '20231101';
          return isAfter ? '04' + text3 : '02' + text3; // 040/041 or 020/021
        }
        case '5': return '050';            // 공휴 (text3 없음)
        case '7': return '050';            // 6세미만+공휴도 공휴 코드
        case '3': return '030';            // 토요
        default:  return '';               // 6세미만 단독은 기본 코드
      }

    case 'Z41xx':
    case 'Z4120':
      // 내복약·외용약: 야간/공휴/토요/심야 접미사
      // C# BuildTimedCode(): "0"+text2+text3
      switch (holidayGb) {
        case '1': return '01' + text3;     // 야간: 010/011
        case '8': return '01' + text3;     // 6세미만+야간
        case '9': return '02' + text3;     // 소아심야: 020/021
        case '5': return '050';            // 공휴
        case '7': return '050';            // 6세미만+공휴
        case '3': return '030';            // 토요
        default:  return '';
      }

    case 'Z4121':
      // 내복+외용 동시: 야간/공휴/토요/심야
      switch (holidayGb) {
        case '1': return '01' + text3;
        case '8': return '01' + text3;
        case '9': return '02' + text3;     // 소아심야
        case '5': return '050';
        case '7': return '050';
        case '3': return '030';
        default:  return '';
      }

    default:
      return '';
  }
}

/**
 * 토요 가산 별도 행 코드 목록 (2016.09.29 이후)
 *
 * 토요일에는 기본 조제료에 더해 토요 가산분을 별도 행으로 추가.
 * 반환값: 추가할 Z코드 목록 (가산 접미사 "030" 포함)
 */
export function getSaturdayAddCodes(
  hasInternal: boolean,
  hasExternal: boolean,
  internalDay: number
): string[] {
  const codes: string[] = [];

  // Z2000030, Z3000030 — 항상 추가
  codes.push('Z2000030');
  codes.push('Z3000030');

  // Z41xx030 — 내복약 있으면
  if (hasInternal) {
    if (internalDay <= 15) {
      codes.push(`Z41${String(internalDay).padStart(2, '0')}030`);
    }
    // 16일 이상은 presc_dosage_fee에서 조회 후 "030" 붙임 (별도 처리)
  }

  // Z4120030 — 외용약 있으면
  if (hasExternal) {
    codes.push('Z4120030');
  }

  return codes;
}
