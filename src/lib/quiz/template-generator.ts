/**
 * template-generator.ts
 * DB 기반 동적 퀴즈 생성기 — quiz_templates 테이블에서 템플릿을 가져와
 * calc-engine으로 정답을 합성한다.
 *
 * 동일한 DynamicQuestion 출력 모양을 유지하므로 기존 player가 변경 없이 동작한다.
 * 실패 시 descriptive error를 throw하여 호출자(route.ts)가 fallback을 처리한다.
 */

import type { CalcOptions, CalcResult, ICalcRepository } from '@/lib/calc-engine';
import { calculate } from '@/lib/calc-engine';
import {
  fetchDrugMaster,
  type DynamicQuestion,
  type DynamicDrug,
  type DynamicQuestionType,
  type DynamicAnswerField,
  type DrugMasterRow,
} from './dynamic-generator';

// ─── Supabase 최소 시그니처 ───────────────────────────────────────────────────
type MinimalSupabase = { from: (table: string) => any };

// ─── quiz_templates 행 타입 ─────────────────────────────────────────────────

type TemplateType = DynamicQuestionType; // 'calc-copay' | 'calc-total' | 'calc-drug-amount' | 'multi-step' | 'error-spot' | 'fill-blank'
type AnswerField = DynamicAnswerField;

interface NumberRange {
  min: number;
  max: number;
}

interface ParamSchema {
  age?: NumberRange;
  drugCount?: NumberRange;
  dayRange?: NumberRange;
  priceRange?: NumberRange;
  doseChoices?: number[];
  dnumChoices?: number[];
}

interface DrugPoolFilter {
  atc_class?: string[];
  /** 임상 그룹 화이트리스트 (이 그룹의 약품만 픽) */
  clinicalGroups?: string[];
}

interface QuizTemplateRow {
  id: number;
  template_type: TemplateType;
  difficulty: 1 | 2 | 3;
  /** 시나리오 라벨 (성인 감기, 고혈압 단독 등) — UI 노출 */
  scenario_label: string | null;
  insu_code_pool: string[];
  param_schema: ParamSchema;
  prompt_template: string;
  answer_field: AnswerField;
  hint_template: string[] | null;
  drug_pool_filter: DrugPoolFilter | null;
  enabled: boolean;
}

// ─── Fallback 상수 (drug_master 비었을 때) ──────────────────────────────────

const SAMPLE_CODES = [
  '012345678',
  '023456789',
  '034567890',
  '045678901',
  '056789012',
];
const SAMPLE_NAMES = ['약품A', '약품B', '약품C', '약품D', '약품E'];

const DEFAULT_DOSE_CHOICES = [0.5, 1, 1.5, 2];
const DEFAULT_DNUM_CHOICES = [1, 2, 3];

// ─── 작은 유틸 ────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function insuLabel(code: string): string {
  if (code.startsWith('C')) return '건강보험';
  if (code.startsWith('D')) return '의료급여';
  if (code.startsWith('G')) return '보훈';
  if (code.startsWith('S')) return '산재';
  if (code.startsWith('A')) return '자동차보험';
  return '기타보험';
}

function ageDescription(age: number): string {
  if (age < 6) return `${age}세 영유아(6세 미만)`;
  if (age >= 65) return `${age}세 노인(65세 이상)`;
  return `${age}세 성인`;
}

function difficultyLabel(d: 1 | 2 | 3): string {
  return d === 1 ? '쉬움' : d === 2 ? '보통' : '어려움';
}

function drugListText(drugs: DynamicDrug[]): string {
  return drugs
    .map(
      (d, i) =>
        `  약품${i + 1} [${d.name}]: 단가 ${d.price.toLocaleString()}원, ` +
        `1회 ${d.dose}정, 1일 ${d.dnum}회, ${d.dday}일치`
    )
    .join('\n');
}

/** {key} 패턴을 vars[key]로 대체. 누락된 키는 그대로 둔다(crash 방지). */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key];
    }
    return match;
  });
}

// ─── DB 행 정규화 ─────────────────────────────────────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNumberRange(v: unknown): v is NumberRange {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.min === 'number' && typeof o.max === 'number';
}

function normalizeParamSchema(raw: unknown): ParamSchema {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: ParamSchema = {};
  if (isNumberRange(o.age)) out.age = o.age;
  if (isNumberRange(o.drugCount)) out.drugCount = o.drugCount;
  if (isNumberRange(o.dayRange)) out.dayRange = o.dayRange;
  if (isNumberRange(o.priceRange)) out.priceRange = o.priceRange;
  if (Array.isArray(o.doseChoices)) {
    const arr = (o.doseChoices as unknown[]).filter((x): x is number => typeof x === 'number');
    if (arr.length > 0) out.doseChoices = arr;
  }
  if (Array.isArray(o.dnumChoices)) {
    const arr = (o.dnumChoices as unknown[]).filter((x): x is number => typeof x === 'number');
    if (arr.length > 0) out.dnumChoices = arr;
  }
  return out;
}

function normalizeDrugPoolFilter(raw: unknown): DrugPoolFilter | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: DrugPoolFilter = {};
  if (isStringArray(o.atc_class)) out.atc_class = o.atc_class;
  if (isStringArray(o.clinicalGroups)) out.clinicalGroups = o.clinicalGroups;
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeTemplateRow(raw: unknown): QuizTemplateRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const template_type = String(o.template_type ?? '') as TemplateType;
  const difficulty = Number(o.difficulty) as 1 | 2 | 3;
  const answer_field = String(o.answer_field ?? '') as AnswerField;
  const prompt_template = String(o.prompt_template ?? '');
  if (!id || !template_type || !difficulty || !answer_field || !prompt_template) {
    return null;
  }
  return {
    id,
    template_type,
    difficulty,
    scenario_label: typeof o.scenario_label === 'string' ? o.scenario_label : null,
    insu_code_pool: isStringArray(o.insu_code_pool) ? o.insu_code_pool : [],
    param_schema: normalizeParamSchema(o.param_schema),
    prompt_template,
    answer_field,
    hint_template: isStringArray(o.hint_template) ? o.hint_template : null,
    drug_pool_filter: normalizeDrugPoolFilter(o.drug_pool_filter),
    enabled: o.enabled !== false,
  };
}

// ─── 파라미터 샘플링 ─────────────────────────────────────────────────────────

interface SampledParams {
  age: number;
  drugCount: number;
  dayMin: number;
  dayMax: number;
  priceMin: number;
  priceMax: number;
  doseChoices: number[];
  dnumChoices: number[];
}

function sampleParams(schema: ParamSchema, difficulty: 1 | 2 | 3): SampledParams {
  // 기본값 (난이도별 합리적 디폴트)
  const ageR = schema.age ?? { min: 20, max: 60 };
  const countR = schema.drugCount ?? (difficulty === 1 ? { min: 1, max: 1 } : difficulty === 2 ? { min: 2, max: 3 } : { min: 3, max: 5 });
  const dayR = schema.dayRange ?? { min: 1, max: 7 };
  const priceR = schema.priceRange ?? { min: 100, max: 3000 };

  return {
    age: randInt(ageR.min, ageR.max),
    drugCount: randInt(countR.min, countR.max),
    dayMin: dayR.min,
    dayMax: dayR.max,
    priceMin: priceR.min,
    priceMax: priceR.max,
    doseChoices: schema.doseChoices ?? DEFAULT_DOSE_CHOICES,
    dnumChoices: schema.dnumChoices ?? DEFAULT_DNUM_CHOICES,
  };
}

// ─── 약품 풀 필터링 + 약품 목록 생성 ─────────────────────────────────────────

/**
 * 임상 그룹 / atc_class 화이트리스트 적용.
 * 필터 결과가 비면 원본 pool 그대로 반환 (안전).
 */
function applyDrugPoolFilter(
  pool: DrugMasterRow[],
  filter: DrugPoolFilter | null
): DrugMasterRow[] {
  if (!filter) return pool;
  let working = pool;

  // 1) clinical_group 필터 (가장 우선)
  if (filter.clinicalGroups && filter.clinicalGroups.length > 0) {
    const allow = new Set(filter.clinicalGroups);
    const filtered = working.filter(
      (d) => d.clinical_group != null && allow.has(d.clinical_group)
    );
    if (filtered.length > 0) working = filtered;
  }

  // 2) atc_class 필터 (보조)
  if (filter.atc_class && filter.atc_class.length > 0) {
    const allow = new Set(filter.atc_class);
    const filtered = working.filter(
      (d) => d.atc_class != null && allow.has(d.atc_class)
    );
    if (filtered.length > 0) working = filtered;
  }

  return working;
}

/**
 * 환자 연령에 적합한 약품만 필터링.
 * age_min/age_max 가 NULL이면 무관 (통과).
 */
function filterByAge(pool: DrugMasterRow[], age: number): DrugMasterRow[] {
  const filtered = pool.filter((d) => {
    if (d.age_min != null && age < d.age_min) return false;
    if (d.age_max != null && age > d.age_max) return false;
    return true;
  });
  return filtered.length > 0 ? filtered : pool;
}

/** typical 값 ± 변동 (자연스러운 다양성). */
function jitterDose(typical: number): number {
  // 0.5 / 1 / 1.5 / 2 후보 중 typical 근처 픽
  const candidates = [0.5, 1, 1.5, 2];
  const closest = candidates.reduce((a, b) =>
    Math.abs(b - typical) < Math.abs(a - typical) ? b : a
  );
  return closest;
}

function buildDrugListFromMaster(
  pool: DrugMasterRow[],
  params: SampledParams,
  /** 템플릿이 typical_* 를 우선 사용하도록 지정한 경우 */
  useTypical: boolean = true
): DynamicDrug[] {
  const useDb = pool.length > 0;
  const count = params.drugCount;

  // DB 사용: 가루약은 가능한 한 제외
  let workingPool = pool;
  if (useDb) {
    const nonPowder = workingPool.filter((d) => !d.is_powder);
    if (nonPowder.length > 0) workingPool = nonPowder;
  }

  const picked: DrugMasterRow[] = [];
  if (useDb) {
    const shuffled = [...workingPool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      picked.push(shuffled[i]);
    }
    while (picked.length < count) {
      picked.push(workingPool[picked.length % workingPool.length]);
    }
  }

  return Array.from({ length: count }, (_, i) => {
    if (useDb) {
      const row = picked[i];

      // typical_* 가 정상값이고 사용 모드면 그것을 우선,
      // 아니면 param_schema 의 doseChoices/dnumChoices/dayRange 사용.
      let dose: number;
      let dnum: number;
      let dday: number;

      if (useTypical) {
        // typical_dose 를 ±변동 (0.5/1/1.5/2 중 가까운 값)
        dose = jitterDose(row.typical_dose);
        dnum = row.typical_dnum;
        // 처방일수: drug_master 의 typical_dday_min/max 와 template 의 dayRange 교집합
        const minDay = Math.max(row.typical_dday_min, params.dayMin);
        const maxDay = Math.min(row.typical_dday_max, params.dayMax);
        dday = minDay <= maxDay
          ? randInt(minDay, maxDay)
          : randInt(params.dayMin, params.dayMax);
      } else {
        dose = pickRandom(params.doseChoices);
        dnum = pickRandom(params.dnumChoices);
        dday = randInt(params.dayMin, params.dayMax);
      }

      return {
        code: row.edi_code,
        name: row.name,
        price: Math.round(row.unit_price),
        dose,
        dnum,
        dday,
      };
    }
    return {
      code: SAMPLE_CODES[i % SAMPLE_CODES.length],
      name: SAMPLE_NAMES[i % SAMPLE_NAMES.length],
      price: randInt(Math.max(1, Math.floor(params.priceMin / 100)), Math.max(1, Math.floor(params.priceMax / 100))) * 100,
      dose: pickRandom(params.doseChoices),
      dnum: pickRandom(params.dnumChoices),
      dday: randInt(params.dayMin, params.dayMax),
    };
  });
}

// ─── 보험코드 선택 ──────────────────────────────────────────────────────────

function pickInsu(pool: string[], difficulty: 1 | 2 | 3): string {
  if (pool.length > 0) return pickRandom(pool);
  // 디폴트
  if (difficulty === 1) return 'C10';
  if (difficulty === 2) return pickRandom(['C10', 'D10']);
  return pickRandom(['C10', 'D10', 'G10']);
}

// ─── 약품금액 단순 합계 (drug-amount용) ─────────────────────────────────────

function calcDrugAmountOnly(drugs: DynamicDrug[]): number {
  return drugs.reduce((sum, d) => sum + Math.round(d.price * d.dose * d.dnum * d.dday), 0);
}

// ─── 해설 빌더 (template-aware) ─────────────────────────────────────────────

function buildExplanation(
  drugs: DynamicDrug[],
  result: CalcResult,
  type: TemplateType,
  templateId: number,
  hints: string[] | null
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
    lines.push('\n【조제료】');
    lines.push(`  조제료 합계 = ${result.sumWage.toLocaleString()}원`);

    lines.push('\n【요양급여비용 총액 (10원 미만 절사)】');
    lines.push(
      `  (${totalDrug.toLocaleString()} + ${result.sumWage.toLocaleString()})` +
        ` → 10원 단위 절사 = ${result.totalPrice.toLocaleString()}원`
    );

    if (type === 'calc-copay') {
      lines.push('\n【본인일부부담금】');
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

  if (hints && hints.length > 0) {
    lines.push('\n【힌트】');
    hints.forEach((h) => lines.push(`  • ${h}`));
  }

  lines.push(`\n(template #${templateId})`);
  return lines.join('\n');
}

// ─── DB 템플릿 로더 ─────────────────────────────────────────────────────────

async function loadTemplates(
  supabase: MinimalSupabase,
  difficulty: 1 | 2 | 3,
  templateType?: TemplateType
): Promise<QuizTemplateRow[]> {
  let query = supabase
    .from('quiz_templates')
    .select('*')
    .eq('difficulty', difficulty)
    .eq('enabled', true);

  if (templateType) {
    query = query.eq('template_type', templateType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`quiz_templates 조회 실패: ${String((error as { message?: string }).message ?? error)}`);
  }
  if (!data || !Array.isArray(data)) {
    return [];
  }

  return (data as unknown[])
    .map(normalizeTemplateRow)
    .filter((r): r is QuizTemplateRow => r !== null);
}

// ─── 메인 엔트리 ────────────────────────────────────────────────────────────

/**
 * DB의 quiz_templates에서 무작위 템플릿을 골라 calc-engine으로 정답을 합성한 문제를 생성한다.
 *
 * @param difficulty   1=쉬움, 2=보통, 3=어려움
 * @param repo         calc-engine 리포지토리
 * @param supabase     Supabase 클라이언트
 * @param templateType (선택) 특정 유형으로 제한
 */
export async function generateFromTemplate(
  difficulty: 1 | 2 | 3,
  repo: ICalcRepository,
  supabase: MinimalSupabase,
  templateType?: TemplateType
): Promise<DynamicQuestion> {
  // step 1~2: 템플릿 로드 + 무작위 선택
  const templates = await loadTemplates(supabase, difficulty, templateType);
  if (templates.length === 0) {
    throw new Error(`No quiz templates found for difficulty ${difficulty}`);
  }
  const tpl = pickRandom(templates);

  // step 3: 파라미터 샘플링
  const params = sampleParams(tpl.param_schema, difficulty);

  // step 4: drug_master 로드
  const drugMaster = await fetchDrugMaster(supabase);

  // step 5: drug_pool_filter 적용 (clinical_group / atc_class)
  let filteredPool = applyDrugPoolFilter(drugMaster, tpl.drug_pool_filter);

  // step 5b: 환자 연령 적합성 필터
  filteredPool = filterByAge(filteredPool, params.age);

  // step 6: 약품 목록 빌드 (drug_master 의 typical_* 우선 사용)
  const drugs = buildDrugListFromMaster(filteredPool, params, true);

  // step 7: 보험코드 선택
  const insuCode = pickInsu(tpl.insu_code_pool, difficulty);

  // step 8: calc-engine 호출
  const calcOpt: CalcOptions = {
    dosDate: todayStr(),
    insuCode,
    age: params.age,
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

  let result: CalcResult;
  try {
    result = await calculate(calcOpt, repo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Calc engine failed in template ${tpl.id}: ${msg}`);
  }
  if (result.error) {
    throw new Error(`Calc engine failed in template ${tpl.id}: ${result.error}`);
  }

  // step 9: 정답 추출 (유형별 분기)
  let correctAnswer: number;
  let answerField: DynamicQuestion['answerField'];
  let questionTextDefault: string;
  let correctAnswerComplex: Record<string, number | string> | undefined;
  let payload: unknown;

  const drugAmountTotal = calcDrugAmountOnly(drugs);

  switch (tpl.answer_field) {
    case 'drugAmount':
      correctAnswer = drugAmountTotal;
      answerField = 'drugAmount';
      questionTextDefault = '이 처방전의 약품금액 합계(01항)는 얼마입니까?';
      break;

    case 'totalPrice':
      correctAnswer = result.totalPrice;
      answerField = 'totalPrice';
      questionTextDefault = '이 처방전의 요양급여비용 총액(총액1)은 얼마입니까?';
      break;

    case 'multiStep': {
      // 4단계: 약품금액 합계 → 조제료 합계 → 총액1 → 본인부담금
      correctAnswerComplex = {
        step1: drugAmountTotal,
        step2: result.sumWage,
        step3: result.totalPrice,
        step4: result.userPrice,
      };
      // 단일 fallback 값으로는 마지막 단계(본인부담금) 사용
      correctAnswer = result.userPrice;
      answerField = 'multiStep';
      payload = {
        steps: [
          { id: 'step1', label: '약품금액 합계' },
          { id: 'step2', label: '조제료 합계' },
          { id: 'step3', label: '총액1' },
          { id: 'step4', label: '본인부담금' },
        ],
      };
      questionTextDefault =
        '다음 4단계를 모두 계산하세요:\n(1) 약품금액 합계\n(2) 조제료 합계\n(3) 총액1\n(4) 본인부담금';
      break;
    }

    case 'errorSpot': {
      // 4단계 중 임의 1개에 의도적 오차 ±10~50원 주입
      const truthSteps = [
        { id: 'step1', label: '약품금액 합계', value: drugAmountTotal },
        { id: 'step2', label: '조제료 합계', value: result.sumWage },
        { id: 'step3', label: '총액1', value: result.totalPrice },
        { id: 'step4', label: '본인부담금', value: result.userPrice },
      ];
      const errorIdx = randInt(0, truthSteps.length - 1);
      const errorMagnitude = pickRandom([10, 20, 30, 40, 50]);
      const errorSign = Math.random() < 0.5 ? -1 : 1;
      const corruptedSteps = truthSteps.map((s, i) =>
        i === errorIdx
          ? { ...s, value: Math.max(0, s.value + errorSign * errorMagnitude) }
          : s
      );
      correctAnswer = errorIdx; // 정답은 잘못된 단계 인덱스
      correctAnswerComplex = { errorIndex: errorIdx };
      answerField = 'errorSpot';
      payload = {
        steps: corruptedSteps.map((s) => ({
          label: s.label,
          value: `${s.value.toLocaleString()}원`,
        })),
      };
      questionTextDefault = '다음 명세서에서 잘못 계산된 항목을 고르시오.';
      break;
    }

    case 'fillBlank': {
      // 약품금액 합계 + 조제료 = 총액1 의 3개 빈칸
      correctAnswerComplex = {
        b1: String(drugAmountTotal),
        b2: String(result.sumWage),
        b3: String(result.totalPrice),
      };
      correctAnswer = result.totalPrice;
      answerField = 'fillBlank';
      payload = {
        template: '약품금액 {b1} + 조제료 {b2} = 총액1 {b3}',
        slots: [
          { id: 'b1', label: '약품금액' },
          { id: 'b2', label: '조제료' },
          { id: 'b3', label: '총액1' },
        ],
      };
      questionTextDefault = '다음 식의 빈칸을 채우세요: 약품금액 ___ + 조제료 ___ = 총액1 ___';
      break;
    }

    case 'userPrice':
    default:
      correctAnswer = result.userPrice;
      answerField = 'userPrice';
      questionTextDefault = '이 처방전에서 환자가 부담하는 본인일부부담금은 얼마입니까?';
      break;
  }

  // step 10: 프롬프트 합성
  const vars: Record<string, string> = {
    difficultyLabel: difficultyLabel(difficulty),
    insuName: insuLabel(insuCode),
    insuCode,
    age: String(params.age),
    ageDesc: ageDescription(params.age),
    drugListText: drugListText(drugs),
    drugCount: String(drugs.length),
    questionText: questionTextDefault,
  };

  let prompt = interpolate(tpl.prompt_template, vars).trim();
  if (!prompt) {
    // 빈 템플릿 방어
    prompt = [
      `[${vars.difficultyLabel}] ${vars.insuName}(${insuCode}) 환자입니다.`,
      `환자 나이: ${vars.ageDesc}`,
      `처방 약품 목록:`,
      vars.drugListText,
      ``,
      questionTextDefault,
      `(단위: 원, 정수로 입력)`,
    ].join('\n');
  }

  // step 11: 해설
  const explanation = buildExplanation(drugs, result, tpl.template_type, tpl.id, tpl.hint_template);

  // step 12: 결과 반환
  const id = `tpl-${tpl.id}-${Date.now()}`;

  return {
    id,
    type: tpl.template_type,
    difficulty,
    prompt,
    given: { insuCode, age: params.age, drugs },
    correctAnswer,
    correctAnswerComplex,
    answerField,
    explanation,
    scenarioLabel: tpl.scenario_label ?? undefined,
    payload,
  };
}
