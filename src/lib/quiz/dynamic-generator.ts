/**
 * dynamic-generator.ts
 * 계산형 동적 문제 생성기 — calc-engine을 활용한 무한 문제 생성
 *
 * 난이도별 파라미터 범위:
 *   1=쉬움  : 성인(20~60세), 약품 1개, 투여일수 1~7일, 보험: 건강보험
 *   2=보통  : 65세 이상 포함, 약품 2~3개, 투여일수 1~14일, 보험: 건강보험/의료급여
 *   3=어려움: 6세 미만 포함, 약품 3~5개, 투여일수 1~14일, 보험: 건강보험/의료급여/보훈
 */

import type { CalcOptions, CalcResult, ICalcRepository } from '@/lib/calc-engine';
import { calculate } from '@/lib/calc-engine';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** drug_master 테이블 행 (퀴즈 재설계 스키마) */
export interface DrugMasterRow {
  edi_code: string;
  name: string;
  unit_price: number;
  insu_pay_type: 'C' | 'N' | 'S';
  is_powder: boolean;
  atc_class: string | null;
  /** 임상 그룹 (cold_adult, hypertension_mono 등) — 함께 처방되는 약품 묶음 */
  clinical_group: string | null;
  /** 적합 연령 하한 (NULL=무관) */
  age_min: number | null;
  /** 적합 연령 상한 (NULL=무관) */
  age_max: number | null;
  /** 표준 1회 투약량 */
  typical_dose: number;
  /** 표준 1일 투여횟수 */
  typical_dnum: number;
  /** 표준 처방일수 하한 */
  typical_dday_min: number;
  /** 표준 처방일수 상한 */
  typical_dday_max: number;
  apply_year: number;
}

export interface DynamicDrug {
  code: string;
  name: string;
  price: number;
  dose: number;
  dnum: number;
  dday: number;
}

export type DynamicQuestionType =
  | 'calc-copay'
  | 'calc-total'
  | 'calc-drug-amount'
  | 'multi-step'
  | 'error-spot'
  | 'fill-blank';

export type DynamicAnswerField =
  | 'totalPrice'
  | 'userPrice'
  | 'insuPrice'
  | 'drugAmount'
  | 'multiStep'
  | 'errorSpot'
  | 'fillBlank';

export interface DynamicQuestion {
  id: string;
  type: DynamicQuestionType;
  difficulty: 1 | 2 | 3;
  prompt: string;
  given: {
    insuCode: string;
    age: number;
    drugs: DynamicDrug[];
  };
  /** 단일 정답 (calc-* 유형). 복합 정답은 correctAnswerComplex 사용 */
  correctAnswer: number;
  /** 복합 정답 (multi-step / fill-blank: {step1, step2, ...} / error-spot: 인덱스 배열 등) */
  correctAnswerComplex?: Record<string, number | string>;
  answerField: DynamicAnswerField;
  explanation: string;
  /** 시나리오 라벨 (성인 감기, 고혈압 단독 등) — UI 노출 */
  scenarioLabel?: string;
  /** 렌더러용 추가 데이터 (multi-step steps / fill-blank slots / error-spot steps 등) */
  payload?: unknown;
}

// ─── 내부 유틸리티 ───────────────────────────────────────────────────────────

/** 정수 범위 내 랜덤 값 (min, max 포함) */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 배열에서 무작위 원소 선택 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 오늘 날짜 yyyyMMdd 형식 */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// 예시 약품 코드 목록 (drug_master 미사용 시 fallback)
const SAMPLE_CODES = [
  '012345678',
  '023456789',
  '034567890',
  '045678901',
  '056789012',
];

const SAMPLE_NAMES = ['약품A', '약품B', '약품C', '약품D', '약품E'];

// ─── 보험코드 풀 ──────────────────────────────────────────────────────────────

const INSU_POOL: Record<1 | 2 | 3, string[]> = {
  1: ['C10'],
  2: ['C10', 'D10'],
  3: ['C10', 'D10', 'G10'],
};

function insuLabel(code: string): string {
  if (code.startsWith('C')) return '건강보험';
  if (code.startsWith('D')) return '의료급여';
  if (code.startsWith('G')) return '보훈';
  if (code.startsWith('S')) return '산재';
  if (code.startsWith('A')) return '자동차보험';
  return '기타보험';
}

// ─── drug_master 페처 (lazy-cached) ───────────────────────────────────────────

// 모듈 레벨 캐시
let _drugMasterCache: DrugMasterRow[] | null = null;

/**
 * Supabase 클라이언트 최소 시그니처.
 * @supabase/supabase-js의 PostgrestFilterBuilder는 PromiseLike(thenable)지만
 * 실제 Promise는 아니므로, 호출부 호환을 위해 from()을 any로 둔다.
 * 런타임에서는 정상 동작하며, fetchDrugMaster 내부에서 결과를 unknown으로 좁힌다.
 */
type MinimalSupabase = { from: (table: string) => any };

/**
 * drug_master 테이블에서 약품 마스터를 조회 (apply_year <= 현재 연도)
 * 모듈 레벨 캐시 사용 — 첫 호출 시에만 실제 쿼리
 */
export async function fetchDrugMaster(
  supabase: MinimalSupabase
): Promise<DrugMasterRow[]> {
  if (_drugMasterCache && _drugMasterCache.length > 0) {
    return _drugMasterCache;
  }

  try {
    const currentYear = new Date().getFullYear();
    const { data, error } = await supabase
      .from('drug_master')
      .select(
        'edi_code, name, unit_price, insu_pay_type, is_powder, atc_class, ' +
        'clinical_group, age_min, age_max, ' +
        'typical_dose, typical_dnum, typical_dday_min, typical_dday_max, apply_year'
      )
      .lte('apply_year', currentYear);

    if (error || !data) {
      console.error('[dynamic-generator] fetchDrugMaster error:', error);
      _drugMasterCache = [];
      return [];
    }

    const rows = (data as unknown[]).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        edi_code: String(row.edi_code),
        name: String(row.name),
        unit_price: Number(row.unit_price),
        insu_pay_type: (row.insu_pay_type as 'C' | 'N' | 'S') ?? 'C',
        is_powder: Boolean(row.is_powder),
        atc_class: row.atc_class != null ? String(row.atc_class) : null,
        clinical_group: row.clinical_group != null ? String(row.clinical_group) : null,
        age_min: row.age_min != null ? Number(row.age_min) : null,
        age_max: row.age_max != null ? Number(row.age_max) : null,
        typical_dose: row.typical_dose != null ? Number(row.typical_dose) : 1,
        typical_dnum: row.typical_dnum != null ? Number(row.typical_dnum) : 1,
        typical_dday_min: row.typical_dday_min != null ? Number(row.typical_dday_min) : 1,
        typical_dday_max: row.typical_dday_max != null ? Number(row.typical_dday_max) : 7,
        apply_year: Number(row.apply_year),
      } satisfies DrugMasterRow;
    });

    _drugMasterCache = rows;
    return rows;
  } catch (err) {
    console.error('[dynamic-generator] fetchDrugMaster exception:', err);
    _drugMasterCache = [];
    return [];
  }
}

/** 캐시 리셋 (테스트/개발용) */
export function _resetDrugMasterCache(): void {
  _drugMasterCache = null;
}

// ─── 나이 선택 로직 ──────────────────────────────────────────────────────────

function pickAge(difficulty: 1 | 2 | 3): number {
  if (difficulty === 1) {
    return randInt(20, 60);
  } else if (difficulty === 2) {
    return Math.random() < 0.5 ? randInt(20, 60) : randInt(65, 80);
  } else {
    const r = Math.random();
    if (r < 0.33) return randInt(20, 60);
    if (r < 0.66) return randInt(65, 80);
    return randInt(0, 5);
  }
}

// ─── 약품 목록 생성 ──────────────────────────────────────────────────────────

/**
 * 약품 목록 생성
 * @param difficulty 난이도
 * @param availableDrugs drug_master 풀 (빈 배열이면 SAMPLE_CODES fallback)
 */
function buildDrugList(
  difficulty: 1 | 2 | 3,
  availableDrugs: DrugMasterRow[]
): DynamicDrug[] {
  const countMap: Record<1 | 2 | 3, [number, number]> = {
    1: [1, 1],
    2: [2, 3],
    3: [3, 5],
  };
  const [minCount, maxCount] = countMap[difficulty];
  const count = randInt(minCount, maxCount);

  const dayRange: Record<1 | 2 | 3, [number, number]> = {
    1: [1, 7],
    2: [3, 14],
    3: [7, 14],
  };
  const [minDay, maxDay] = dayRange[difficulty];

  // 가격 범위 (drug_master fallback 시 사용)
  const priceRanges: Record<1 | 2 | 3, [number, number]> = {
    1: [100, 1000],
    2: [200, 3000],
    3: [500, 5000],
  };
  const [minPrice, maxPrice] = priceRanges[difficulty];

  // ── 약품 풀 필터링 ────────────────────────────────────────────────────────
  // 어려움 모드: 가루약(powder) 포함 가능 (확률 30%)
  // 그 외: 가루약 제외 (정제/캡슐 위주)
  let pool = availableDrugs;
  if (pool.length > 0) {
    if (difficulty === 3 && Math.random() < 0.3) {
      // 어려움 30% 확률로 powder 허용 — 풀 그대로
    } else {
      const nonPowder = pool.filter((d) => !d.is_powder);
      if (nonPowder.length > 0) pool = nonPowder;
    }
  }

  // ── 풀에서 중복 없이 count개 추출 ─────────────────────────────────────────
  const useDb = pool.length > 0;
  const picked: DrugMasterRow[] = [];
  if (useDb) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      picked.push(shuffled[i]);
    }
    // 풀이 count보다 작으면 반복 채움
    while (picked.length < count) {
      picked.push(pool[picked.length % pool.length]);
    }
  }

  return Array.from({ length: count }, (_, i) => {
    if (useDb) {
      const row = picked[i];
      return {
        code: row.edi_code,
        name: row.name,
        price: Math.round(row.unit_price),
        dose: pickRandom([0.5, 1, 1.5, 2]),
        dnum: pickRandom([1, 2, 3]),
        dday: randInt(minDay, maxDay),
      };
    }
    // Fallback: SAMPLE_CODES
    return {
      code: SAMPLE_CODES[i % SAMPLE_CODES.length],
      name: SAMPLE_NAMES[i % SAMPLE_NAMES.length],
      price: randInt(minPrice / 100, maxPrice / 100) * 100,
      dose: pickRandom([0.5, 1, 1.5, 2]),
      dnum: pickRandom([1, 2, 3]),
      dday: randInt(minDay, maxDay),
    };
  });
}

// ─── 문제 유형 선택 ──────────────────────────────────────────────────────────

type QuestionType = DynamicQuestion['type'];

function pickQuestionType(difficulty: 1 | 2 | 3): QuestionType {
  if (difficulty === 1) {
    return Math.random() < 0.5 ? 'calc-drug-amount' : 'calc-copay';
  }
  return pickRandom<QuestionType>(['calc-copay', 'calc-total', 'calc-drug-amount']);
}

// ─── 약품 금액 계산 (calc-engine 없이 단순 계산) ─────────────────────────────

function calcDrugAmountOnly(drugs: DynamicDrug[]): number {
  return drugs.reduce((sum, d) => {
    const raw = d.price * d.dose * d.dnum * d.dday;
    return sum + Math.round(raw);
  }, 0);
}

// ─── 한국어 나이 설명 ─────────────────────────────────────────────────────────

function ageDescription(age: number): string {
  if (age < 6) return `${age}세 영유아(6세 미만)`;
  if (age >= 65) return `${age}세 노인(65세 이상)`;
  return `${age}세 성인`;
}

// ─── 약품 목록 텍스트 ─────────────────────────────────────────────────────────

function drugListText(drugs: DynamicDrug[]): string {
  return drugs
    .map(
      (d, i) =>
        `  약품${i + 1} [${d.name}]: 단가 ${d.price.toLocaleString()}원, ` +
        `1회 ${d.dose}정, 1일 ${d.dnum}회, ${d.dday}일치`
    )
    .join('\n');
}

// ─── 단계별 해설 생성 ─────────────────────────────────────────────────────────

function buildExplanation(
  drugs: DynamicDrug[],
  result: CalcResult,
  type: QuestionType
): string {
  const lines: string[] = [];

  lines.push('【약품금액 계산】');
  let totalDrug = 0;
  drugs.forEach((d, i) => {
    const amt = Math.round(d.price * d.dose * d.dnum * d.dday);
    totalDrug += amt;
    lines.push(
      `  약품${i + 1} [${d.name}]: ${d.price} × ${d.dose} × ${d.dnum} × ${d.dday} = ${amt.toLocaleString()}원`
    );
  });
  lines.push(`  약품금액 합계 = ${totalDrug.toLocaleString()}원`);

  if (type !== 'calc-drug-amount') {
    lines.push(`\n【조제료】`);
    lines.push(`  조제료 합계 = ${result.sumWage.toLocaleString()}원`);

    lines.push(`\n【요양급여비용 총액 (10원 미만 절사)】`);
    lines.push(
      `  (${totalDrug.toLocaleString()} + ${result.sumWage.toLocaleString()})` +
        ` → 10원 단위 절사 = ${result.totalPrice.toLocaleString()}원`
    );

    if (type === 'calc-copay') {
      lines.push(`\n【본인일부부담금】`);
      lines.push(`  본인부담금 = ${result.userPrice.toLocaleString()}원`);
      if (result.steps) {
        const copayStep = result.steps.find(
          (s) => s.title.includes('본인부담') || s.title.includes('본인일부')
        );
        if (copayStep) {
          lines.push(`  계산식: ${copayStep.formula}`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ─── 메인 생성 함수 ───────────────────────────────────────────────────────────

/**
 * 동적 계산 문제 생성
 *
 * @param difficulty 난이도 (1=쉬움, 2=보통, 3=어려움)
 * @param repo       ICalcRepository (서버 사이드에서 주입)
 * @param type       문제 유형 (미지정 시 난이도에 맞게 랜덤)
 * @param supabase   Supabase 클라이언트 (drug_master 조회용; 미제공 시 SAMPLE_CODES fallback)
 */
export async function generateQuestion(
  difficulty: 1 | 2 | 3,
  repo: ICalcRepository,
  type?: string,
  supabase?: MinimalSupabase
): Promise<DynamicQuestion> {
  const questionType = (type as QuestionType | undefined) ?? pickQuestionType(difficulty);
  const age = pickAge(difficulty);

  // ── drug_master 조회 (제공된 경우) ────────────────────────────────────────
  let availableDrugs: DrugMasterRow[] = [];
  if (supabase) {
    availableDrugs = await fetchDrugMaster(supabase);
  }

  const drugs = buildDrugList(difficulty, availableDrugs);
  const insuCode = pickRandom(INSU_POOL[difficulty]);

  // ── calc-engine 호출 ──────────────────────────────────────────────────────
  const calcOpt: CalcOptions = {
    dosDate: todayStr(),
    insuCode,
    age,
    drugList: drugs.map((d) => ({
      code: d.code,
      insuPay: 'covered' as const,
      take: 'internal' as const,
      price: d.price,
      dose: d.dose,
      dNum: d.dnum,
      dDay: d.dday,
    })),
  };

  const result = await calculate(calcOpt, repo);

  // ── 정답 값 결정 ──────────────────────────────────────────────────────────
  let correctAnswer: number;
  let answerField: DynamicQuestion['answerField'];
  let promptSuffix: string;

  if (questionType === 'calc-drug-amount') {
    correctAnswer = calcDrugAmountOnly(drugs);
    answerField = 'drugAmount';
    promptSuffix = '이 처방전의 약품금액 합계(01항)는 얼마입니까?';
  } else if (questionType === 'calc-total') {
    correctAnswer = result.totalPrice;
    answerField = 'totalPrice';
    promptSuffix = '이 처방전의 요양급여비용 총액(총액1)은 얼마입니까?';
  } else {
    correctAnswer = result.userPrice;
    answerField = 'userPrice';
    promptSuffix = '이 처방전에서 환자가 부담하는 본인일부부담금은 얼마입니까?';
  }

  // ── 문제 텍스트 구성 ─────────────────────────────────────────────────────
  const diffLabel = difficulty === 1 ? '쉬움' : difficulty === 2 ? '보통' : '어려움';
  const insuName = insuLabel(insuCode);
  const prompt = [
    `[${diffLabel}] ${insuName}(${insuCode}) 환자입니다.`,
    `환자 나이: ${ageDescription(age)}`,
    `처방 약품 목록:`,
    drugListText(drugs),
    ``,
    promptSuffix,
    `(단위: 원, 정수로 입력)`,
  ].join('\n');

  // ── 해설 생성 ─────────────────────────────────────────────────────────────
  const explanation = buildExplanation(drugs, result, questionType);

  // ── ID 생성 ───────────────────────────────────────────────────────────────
  const id = `dyn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    type: questionType,
    difficulty,
    prompt,
    given: { insuCode, age, drugs },
    correctAnswer,
    answerField,
    explanation,
  };
}
