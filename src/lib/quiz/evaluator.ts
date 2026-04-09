import type { QuizQuestion, QuestionType } from './types';

export type Evaluator = (userAnswer: string, question: QuizQuestion) => boolean;

// ── 헬퍼 파서 (모두 try/catch로 래핑, 절대 throw 하지 않음) ──────────────

function safeParseObject(s: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── 타입별 비교 함수 (테스트용으로 export) ─────────────────────────────

/** matching: JSON 매핑 객체 deep-equal (키 순서 무관) */
export function evaluateMatching(userAnswer: string, question: QuizQuestion): boolean {
  try {
    const u = safeParseObject(userAnswer);
    const c = safeParseObject(question.correct_answer);
    if (!u || !c) return false;
    const uKeys = Object.keys(u);
    const cKeys = Object.keys(c);
    if (uKeys.length !== cKeys.length) return false;
    for (const k of cKeys) {
      const uv = asString(u[k]);
      const cv = asString(c[k]);
      if (uv === null || cv === null) return false;
      if (uv !== cv) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** ordering: 콤마 split → 항목별 trim → 배열 동등 비교 (공백 차이에 관대) */
export function evaluateOrdering(userAnswer: string, question: QuizQuestion): boolean {
  try {
    const u = (userAnswer ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const c = (question.correct_answer ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (u.length === 0 || c.length === 0) return false;
    if (u.length !== c.length) return false;
    return u.every((v, i) => v === c[i]);
  } catch {
    return false;
  }
}

/** fill_blank: 모든 값 case-insensitive trim 비교 */
export function evaluateFillBlank(userAnswer: string, question: QuizQuestion): boolean {
  try {
    const u = safeParseObject(userAnswer);
    const c = safeParseObject(question.correct_answer);
    if (!u || !c) return false;
    const cKeys = Object.keys(c);
    if (cKeys.length === 0) return false;
    for (const k of cKeys) {
      const uvRaw = u[k];
      const cvRaw = c[k];
      const uv =
        typeof uvRaw === 'string'
          ? uvRaw
          : typeof uvRaw === 'number'
          ? String(uvRaw)
          : null;
      const cv =
        typeof cvRaw === 'string'
          ? cvRaw
          : typeof cvRaw === 'number'
          ? String(cvRaw)
          : null;
      if (uv === null || cv === null) return false;
      if (uv.trim().toLowerCase() !== cv.trim().toLowerCase()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * error_spot: step.id 기반 비교.
 * correct_answer 가 step.id, 0-based 인덱스, 1-based 인덱스 어느 형식이든 정규화해서 비교.
 * payload.steps 에 id 필드가 없는 옛 시드도 step{N+1} 로 자동 부여하여 처리한다.
 * (renderer 와 동일한 로직 — ErrorSpotRenderer.normalizeSteps/resolveCorrectId 참조)
 */
export function evaluateErrorSpot(userAnswer: string, question: QuizQuestion): boolean {
  try {
    const u = (userAnswer ?? '').trim();
    const cRaw = (question.correct_answer ?? '').trim();
    if (!u || !cRaw) return false;

    // 시드의 step id 목록 (없으면 step1, step2 ... 자동 부여)
    const stepIds: string[] = [];
    if (question.payload && typeof question.payload === 'object') {
      const steps = (question.payload as { steps?: unknown }).steps;
      if (Array.isArray(steps)) {
        steps.forEach((s, i) => {
          const sid =
            s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string'
              ? (s as { id: string }).id
              : `step${i + 1}`;
          stepIds.push(sid);
        });
      }
    }

    // correct_answer 정규화
    let c = cRaw;
    if (!stepIds.includes(c) && /^\d+$/.test(c) && stepIds.length > 0) {
      const n = parseInt(c, 10);
      if (n >= 0 && n < stepIds.length) c = stepIds[n];          // 0-based
      else if (n >= 1 && n <= stepIds.length) c = stepIds[n - 1]; // 1-based fallback
    }

    return u === c;
  } catch {
    return false;
  }
}

/** multi_step: JSON 객체 — 각 단계 ±1 허용 */
const MULTI_STEP_TOLERANCE = 1;
export function evaluateMultiStep(userAnswer: string, question: QuizQuestion): boolean {
  try {
    const u = safeParseObject(userAnswer);
    const c = safeParseObject(question.correct_answer);
    if (!u || !c) return false;
    const cKeys = Object.keys(c);
    if (cKeys.length === 0) return false;
    for (const k of cKeys) {
      const uv = asNumber(u[k]);
      const cv = asNumber(c[k]);
      if (uv === null || cv === null) return false;
      if (Math.abs(uv - cv) > MULTI_STEP_TOLERANCE) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 타입별 정답 비교기 레지스트리.
 */
export const EVALUATORS: Partial<Record<QuestionType, Evaluator>> = {
  multiple_choice: (a, q) => a === q.correct_answer,
  true_false: (a, q) => a === q.correct_answer,
  numeric: (a, q) => a.trim() === q.correct_answer.trim(),
  matching: evaluateMatching,
  ordering: evaluateOrdering,
  fill_blank: evaluateFillBlank,
  error_spot: evaluateErrorSpot,
  multi_step: evaluateMultiStep,
};

export function evaluateAnswer(userAnswer: string, question: QuizQuestion): boolean {
  const fn = EVALUATORS[question.question_type];
  if (!fn) return false;
  try {
    return fn(userAnswer, question);
  } catch {
    return false;
  }
}
