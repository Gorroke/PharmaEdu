/**
 * calc-engine/supabase-repo.ts
 * ICalcRepository Supabase 구현체
 * 서버 사이드(Route Handler)에서만 사용
 */

import type { ICalcRepository, InsuRate } from './types';

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase-server').createServerSupabase>>;

export class SupabaseCalcRepository implements ICalcRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Z코드별 단가/수가명 Map 반환
   * A-8: 시그니처를 dosDate 8자리(yyyyMMdd)로 변경 — 연내 수가 개정 반영 준비
   * 현재 DB 스키마는 apply_year 연단위 — 8자리에서 연도만 추출하여 조회
   * 향후 suga_fee 테이블에 DueDate(yyyyMMdd) 컬럼 추가 시:
   *   .lte('due_date', dosDate).order('due_date', { ascending: false }) 패턴으로 교체 예정
   * 근거: ch10_analyst.md §5 "CH10 §3-2 MAX(DueDate) <= 조제일자 패턴 요구"
   *       99_FINAL_REPORT.md §4.10 C-40 "dispensing-fee.ts:L179 year만 추출"
   */
  async getSugaFeeMap(dosDate: string | number): Promise<Map<string, { price: number; name: string }>> {
    // A-8: dosDate 8자리(string) 또는 연도(number, 레거시) 모두 수용
    // 현재는 연도만 추출하여 apply_year 기준 조회 (DB 스키마 변경 보류)
    // 향후 DueDate 컬럼 추가 시: .lte('due_date', dosDate).order('due_date', {ascending:false}) 패턴 적용
    const year = typeof dosDate === 'number'
      ? dosDate
      : (parseInt(String(dosDate).substring(0, 4), 10) || new Date().getFullYear());
    const { data, error } = await this.supabase
      .from('suga_fee')
      .select('code, name, price')
      .eq('apply_year', year);

    if (error || !data) {
      console.error('[SupabaseRepo] getSugaFeeMap error:', error?.message);
      return new Map();
    }

    const map = new Map<string, { price: number; name: string }>();
    for (const row of data) {
      map.set(row.code as string, {
        price: Number(row.price),
        name: row.name as string,
      });
    }
    return map;
  }

  /**
   * 투약일수에 해당하는 처방조제료 조회
   * presc_dosage_fee 테이블: min_days <= days <= max_days 인 행
   */
  async getPrescDosageFee(
    year: number,
    days: number
  ): Promise<{ sugaCode: string; fee: number } | null> {
    const { data, error } = await this.supabase
      .from('presc_dosage_fee')
      .select('suga_code, fee')
      .eq('apply_year', year)
      .lte('min_days', days)
      .gte('max_days', days)
      .maybeSingle();

    if (error || !data) {
      console.error('[SupabaseRepo] getPrescDosageFee error:', error?.message);
      return null;
    }

    return {
      sugaCode: data.suga_code as string,
      fee: Number(data.fee),
    };
  }

  /**
   * 보험코드별 요율 조회
   * insu_rate 테이블
   */
  async getInsuRate(insuCode: string): Promise<InsuRate | null> {
    // L-1 검수: v2520/v2521 필드 추가 (exemption.ts:determineV252RateByGrade 조회에 필요)
    // 근거: 99_FINAL_REPORT §4.5 C-19; exemption.ts:determineV252RateByGrade():L218-L228
    const { data, error } = await this.supabase
      .from('insu_rate')
      .select('insu_code, rate, six_age_rate, fix_cost, mcode, bcode, age65_12000_less, v2520, v2521')
      .eq('insu_code', insuCode)
      .maybeSingle();

    if (error || !data) {
      console.error('[SupabaseRepo] getInsuRate error:', error?.message);
      return null;
    }

    return {
      insuCode: data.insu_code as string,
      rate: Number(data.rate),
      sixAgeRate: Number(data.six_age_rate),
      fixCost: Number(data.fix_cost),
      mcode: Number(data.mcode),
      bcode: Number(data.bcode),
      age65_12000Less: Number(data.age65_12000_less),
      // V252 등급별 요율 (DB에 없으면 undefined — exemption.ts에서 고정값 fallback 처리)
      v2520: data.v2520 != null ? Number(data.v2520) : undefined,
      v2521: data.v2521 != null ? Number(data.v2521) : undefined,
    };
  }
}
