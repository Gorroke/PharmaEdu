/**
 * modules/insurance/gs-code.ts
 * 공상등구분 코드 결정 모듈 (HIRA EDI 명세서 필드)
 *
 * 대상:
 *   G10 (보훈병원 업무처리 P08 약국)
 *   G20 (보훈위탁진료 약국)
 *
 * C# YakjaebiCalc.Engine.Enums.GsCode 포팅
 * 근거: 2025 요양급여비용 청구방법 심사청구서 명세서서식 및 작성요령
 *       p.491, p.593, p.604, p.616, p.697; CH12 §5.4~5.6
 */

// ─── GsCode 상수 ─────────────────────────────────────────────────────────────

/**
 * 공상등구분 코드 상수
 * C# GsCode 클래스 상수 포팅
 */
export const GsCodeValues = {
  // ── 보훈병원 업무처리(P08) 약국 코드 ──

  /** 국비 100% — M10 (보훈병원 P08) */
  National100: '3',

  /** 이중감면 — M20 (보훈병원 P08) */
  DoubleReduction: '5',

  /** 감면 30% — M30 (보훈병원 P08) */
  Reduction30: '6',

  /** 감면 50% — M50 (보훈병원 P08) */
  Reduction50: '4',

  /** 감면 60% — M60 (보훈병원 P08) */
  Reduction60: '7',

  /** 감면 90% — M90 (보훈병원 P08) */
  Reduction90: 'J',

  // ── 보훈위탁진료(G20) 약국 코드 ──

  /** 국비환자 조제분 (보훈위탁 G20) */
  DelegateNational: '4',

  /** 국비환자 타질환 (보훈위탁 G20, 2013~) */
  DelegateOtherDisease: '7',

  /** 감면환자 (보훈위탁 G20, 90%/60% 도서벽지 외) */
  DelegateReduction: '0',

  /** 60% 감면 도서벽지 내 (보훈위탁 G20, MT038='A') */
  DelegateIsland60: '6',

  // ── 기타 ──

  /** 공상등구분 없음 (비보훈) */
  None: '',
} as const;

// ─── 공개 함수 ────────────────────────────────────────────────────────────────

/**
 * BohunCode + InsuCode + MT038 조합으로 공상등구분을 결정한다.
 *
 * C# GsCode.Determine(insuCode, bohunCode, mt038, dosDate) 포팅
 *
 * 동작:
 *   - bohunCode가 없으면 "" 반환
 *   - G20 위탁진료이고 mt038이 있으면 MT038 분기 적용
 *   - 그 외(G10 또는 MT038 없음)는 기본 매핑 적용
 *
 * G10 기본 매핑 (P08 보훈병원):
 *   M10 → '3', M20 → '5', M30 → '6', M50 → '4',
 *   M60/M61/M81 → '7', M82 → '', M83/M90 → 'J'
 *
 * G20 기본 매핑 (보훈위탁):
 *   M10 → '4', M20/M30/M50/M60/M61/M81/M83/M90 → '0', M82 → ''
 *
 * G20 MT038 분기:
 *   MT038='A' + M60/M61/M81 → '6' (도서벽지 60% 감면)
 *   MT038='2' + M10         → '7' (국비환자 타질환)
 *   MT038='1' + 2018 이전   → '4' (국비환자 조제분 유지)
 *   MT038='1' + 2018 이후   → 기본 매핑 위임
 *
 * @param insuCode  보험코드 (G10/G20 등)
 * @param bohunCode 보훈코드 (M10~M90)
 * @param mt038     MT038 특정내역 ("1"/"2"/"A"/"") — 없으면 생략 가능
 * @param dosDate   조제일자 (yyyyMMdd) — MT038='1' 날짜분기에 사용
 * @returns 공상등구분 코드 문자열
 */
export function determineGsCode(
  insuCode: string,
  bohunCode: string,
  mt038?: string,
  dosDate?: string,
): string {
  if (!bohunCode) return GsCodeValues.None;

  const isDelegate = insuCode === 'G20';
  const mt038val = mt038 ?? '';
  const dosDateVal = dosDate ?? '';

  // G20 위탁진료 약국에 한해 MT038 분기 적용
  if (isDelegate && mt038val !== '') {
    // MT038='A': 60% 감면 도서벽지 내 → GsCode='6'
    // 근거: 작성요령 p.593, p.616, p.697; CH12 §5.4
    if (mt038val === 'A' && (bohunCode === 'M60' || bohunCode === 'M61' || bohunCode === 'M81')) {
      return GsCodeValues.DelegateIsland60;
    }

    // MT038='2': 국비환자 타질환 조제분 → GsCode='7'
    // 2013.01.01부터 적용. 근거: 작성요령 p.604; CH12 §5.6
    if (mt038val === '2' && bohunCode === 'M10') {
      return GsCodeValues.DelegateOtherDisease;
    }

    // MT038='1': 2018.01.01 이전 일부본인부담대상 전상군경등 국비질환분
    // 2018.01.01부터 폐지. 이전 데이터 역호환용. 근거: CH12 §5.6
    if (mt038val === '1') {
      if (dosDateVal < '20180101') {
        return GsCodeValues.DelegateNational; // 2018 이전: 국비환자 조제분 코드 유지
      }
      // 2018 이후: 기본 매핑 위임 (fall through)
      return _determineBaseGsCode(insuCode, bohunCode);
    }

    // 그 외 mt038 값(또는 MT038 미적용 bohunCode 조합)은 기본 매핑 위임
    return _determineBaseGsCode(insuCode, bohunCode);
  }

  // G10 또는 MT038 없음: 기본 매핑 적용
  return _determineBaseGsCode(insuCode, bohunCode);
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * BohunCode + InsuCode 기본 매핑 (MT038 미적용)
 * C# GsCode.Determine(insuCode, bohunCode) 포팅
 */
function _determineBaseGsCode(insuCode: string, bohunCode: string): string {
  const isDelegate = insuCode === 'G20';

  switch (bohunCode) {
    case 'M10': return isDelegate ? GsCodeValues.DelegateNational  : GsCodeValues.National100;
    case 'M20': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.DoubleReduction;
    case 'M30': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction30;
    case 'M50': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction50;
    case 'M60': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction60;
    case 'M61': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction60;
    case 'M81': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction60;
    case 'M82': return GsCodeValues.None;     // 감면 없음
    case 'M83': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction90;
    case 'M90': return isDelegate ? GsCodeValues.DelegateReduction  : GsCodeValues.Reduction90;
    default:    return GsCodeValues.None;
  }
}
