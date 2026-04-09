/**
 * calc-engine/rounding.ts
 * 약제비 계산 반올림/절사 유틸리티 — C# RoundingHelper.cs 포팅
 *
 * 주의: JavaScript Math.round()는 "round half to even"이 아닌 "round half up"이지만
 * 정확히는 음수 처리에서 차이가 있다. 약제비는 항상 양수이므로 Math.round = AwayFromZero.
 */

/**
 * R01/R04/R06~R11: 원미만 사사오입 (4사5입)
 * 용도: 약품금액, 조제료금액, 할증금액 등 대부분의 금액 계산
 * 공식: Math.round(v) — JS의 Math.round는 양수에서 AwayFromZero와 동일
 */
export function round1(v: number): number {
  return Math.round(v);
}

/**
 * R12~R17: 10원 미만 절사 (내림)
 * 용도: 요양급여비용총액1/2, 의료급여 본인부담금
 * 공식: Math.floor(v / 10) * 10
 */
export function trunc10(v: number): number {
  return Math.floor(v / 10) * 10;
}

/**
 * 건보(C) 본인부담금: 100원 미만 절사 (내림)
 * 용도: 건강보험 본인부담금, 보훈 일반 본인부담금
 * 공식: Math.floor(v / 100) * 100
 */
export function trunc100(v: number): number {
  return Math.floor(v / 100) * 100;
}

/**
 * 10원 미만 사사오입
 * 용도: 조제료 단가 (점수 × 점수당단가)
 * 공식: Math.round(v / 10) * 10
 */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

/**
 * EDB 호환: (int)(v + 0.5) 사사오입
 * 양수 영역에서 round1과 동일
 */
export function roundToInt(v: number): number {
  return Math.floor(v + 0.5);
}

/**
 * 10원 미만 올림 (올림)
 * 용도: 보훈청구액 유팜 방식 올림, 비급여 NPayRoundType 4(십원단위 올림)
 * 공식: Math.ceil(v / 10) * 10
 *
 * C# 원본: RoundingHelper.cs Ceil10():L76-L77
 *   public static decimal Ceil10(decimal v) => Math.Ceiling(v / 10m) * 10m;
 *
 * 주의: 현재 calc-engine은 MpvaPrice 산출에 EDB 역산 방식(trunc10)을 채택 중.
 * 유팜 호환 경로(Ceil10) 또는 NPayRoundType 4 적용 시 이 함수를 사용한다.
 * 사용처 변경은 후속 작업(C-5 등)에서 수행.
 */
export function ceil10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

/**
 * 100원 미만 사사오입
 * 용도: 비급여 NPayRoundType 2(십원단위 반올림)
 * 공식: Math.round(v / 100) * 100
 *
 * C# 원본: RoundingHelper.cs Round100():L93-L94
 *   public static decimal Round100(decimal v) =>
 *     Math.Round(v / 100m, 0, MidpointRounding.AwayFromZero) * 100m;
 */
export function round100(v: number): number {
  return Math.round(v / 100) * 100;
}

/**
 * 100원 미만 올림
 * 용도: 비급여 NPayRoundType 3(십원단위 올림)
 * 공식: Math.ceil(v / 100) * 100
 *
 * C# 원본: RoundingHelper.cs Ceil100():L103-L104
 *   public static decimal Ceil100(decimal v) => Math.Ceiling(v / 100m) * 100m;
 */
export function ceil100(v: number): number {
  return Math.ceil(v / 100) * 100;
}

/**
 * 비급여 반올림 6종 디스패처 (NPayRoundType)
 *
 * 용도: 비급여 조제료 차액, 비급여 금액 최종 절사
 * 6종 유형:
 *   'Floor10'  (0) → trunc10  : 10원 미만 버림  예: 1745 → 1740
 *   'Floor100' (1) → trunc100 : 100원 미만 버림  예: 1745 → 1700
 *   'Round100' (2) → round100 : 100원 미만 사사오입  예: 1745 → 1700
 *   'Ceil100'  (3) → ceil100  : 100원 미만 올림  예: 1745 → 1800
 *   'None'     (4) → 그대로    : 절사 없음  예: 1745 → 1745
 *   'Round10'  (5) → round1   : 원미만 사사오입  예: 1745.5 → 1746
 *
 * C# 원본: RoundingHelper.cs ApplyNPayRound():L118-L132
 *   Floor10  → Trunc10, Floor100 → Trunc100, Round100 → Round100,
 *   Ceil100  → Ceil100, None → v, Round10 → Round1
 *
 * 근거: RoundingHelper.cs:L113-L132, NPayRoundType.cs
 */
export function applyNPayRound(v: number, type: string | undefined): number {
  switch (type) {
    case 'Floor10':  return trunc10(v);
    case 'Floor100': return trunc100(v);
    case 'Round100': return round100(v);
    case 'Ceil100':  return ceil100(v);
    case 'None':     return v;
    case 'Round10':  return round1(v);
    default:         return trunc10(v); // 기본값: Floor10 (C# NPayRoundType.Floor10 = 0)
  }
}
