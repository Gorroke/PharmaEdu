// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — Learning Progress Storage
// SSR-safe localStorage utilities
// ─────────────────────────────────────────────

import type { LearningState, LessonProgress, LessonMeta } from './types';

export const STORAGE_KEY = 'pharmaedu_learning_progress';

// ─────────────────────────────────────────────
// 기본값 팩토리
// ─────────────────────────────────────────────

function defaultLearningState(): LearningState {
  return {
    lessons: {},
    currentLesson: null,
    totalReadMinutes: 0,
  };
}

function defaultLessonProgress(slug: string): LessonProgress {
  return {
    slug,
    status: 'locked',
    readPercent: 0,
    quizPassed: false,
  };
}

// ─────────────────────────────────────────────
// 스토리지 읽기 / 쓰기
// ─────────────────────────────────────────────

/**
 * localStorage에서 학습 상태를 불러온다.
 * SSR 환경(window 없음)이나 파싱 오류 시 기본값을 반환한다.
 */
export function getLearningState(): LearningState {
  if (typeof window === 'undefined') {
    return defaultLearningState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLearningState();
    const parsed = JSON.parse(raw) as Partial<LearningState>;
    return {
      lessons: parsed.lessons ?? {},
      currentLesson: parsed.currentLesson ?? null,
      totalReadMinutes: parsed.totalReadMinutes ?? 0,
    };
  } catch {
    return defaultLearningState();
  }
}

/**
 * 학습 상태를 localStorage에 저장한다. SSR 환경에서는 no-op.
 */
export function saveLearningState(state: LearningState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 쿼터 초과 등 무시
  }
}

// ─────────────────────────────────────────────
// 레슨 개별 접근
// ─────────────────────────────────────────────

/**
 * 특정 레슨의 진도를 반환한다. 기록이 없으면 기본값(locked)을 반환한다.
 */
export function getLessonProgress(slug: string): LessonProgress {
  const state = getLearningState();
  return state.lessons[slug] ?? defaultLessonProgress(slug);
}

/**
 * 특정 레슨의 진도를 부분 업데이트한다.
 */
export function updateLessonProgress(
  slug: string,
  update: Partial<LessonProgress>,
): void {
  const state = getLearningState();
  const existing = state.lessons[slug] ?? defaultLessonProgress(slug);
  state.lessons[slug] = { ...existing, ...update, slug };
  saveLearningState(state);
}

// ─────────────────────────────────────────────
// 레슨 상태 전환 헬퍼
// ─────────────────────────────────────────────

/**
 * 레슨을 방문 처리한다.
 * - status: locked → unlocked 인 경우 in-progress 로 변경
 * - status: unlocked 인 경우 in-progress 로 변경
 * - 이미 in-progress / completed 이면 그대로 유지
 * - visitedAt(최초 방문 시각) 기록
 * - currentLesson 갱신
 */
export function markLessonVisited(slug: string): void {
  const state = getLearningState();
  const existing = state.lessons[slug] ?? defaultLessonProgress(slug);

  const nextStatus =
    existing.status === 'locked' || existing.status === 'unlocked'
      ? 'in-progress'
      : existing.status;

  state.lessons[slug] = {
    ...existing,
    slug,
    status: nextStatus,
    visitedAt: existing.visitedAt ?? Date.now(),
  };
  state.currentLesson = slug;
  saveLearningState(state);
}

/**
 * 읽기 진도를 업데이트한다 (0~100). in-progress 상태가 아니면 먼저 in-progress 로 전환한다.
 */
export function markReadPercent(slug: string, pct: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const existing = getLessonProgress(slug);

  const nextStatus =
    existing.status === 'locked' || existing.status === 'unlocked'
      ? 'in-progress'
      : existing.status;

  updateLessonProgress(slug, {
    readPercent: clamped,
    status: nextStatus,
    visitedAt: existing.visitedAt ?? Date.now(),
  });
}

/**
 * 퀴즈 통과를 기록한다.
 */
export function markQuizPassed(slug: string): void {
  updateLessonProgress(slug, { quizPassed: true });
}

/**
 * 레슨을 완료 처리한다 (readPercent=100, status=completed, completedAt 기록).
 */
export function markLessonCompleted(slug: string): void {
  const existing = getLessonProgress(slug);
  updateLessonProgress(slug, {
    readPercent: 100,
    status: 'completed',
    completedAt: existing.completedAt ?? Date.now(),
    visitedAt: existing.visitedAt ?? Date.now(),
  });
}

/**
 * 특정 레슨의 잠금을 해제한다 (locked → unlocked).
 * 이미 unlocked / in-progress / completed 이면 변경하지 않는다.
 */
export function unlockLesson(slug: string): void {
  const existing = getLessonProgress(slug);
  if (existing.status === 'locked') {
    updateLessonProgress(slug, { status: 'unlocked' });
  }
}

// ─────────────────────────────────────────────
// Unlock 규칙 (PHASE7_LEARNING_PLAN 기반)
// ─────────────────────────────────────────────

/**
 * 방금 완료된 레슨을 기준으로 새로 잠금 해제할 레슨을 찾아
 * unlockLesson()을 호출하고 새로 해제된 slug 목록을 반환한다.
 *
 * Unlock 규칙 (PHASE7_LEARNING_PLAN.md prerequisites 기반):
 *   - Lesson 1  : 선수 없음 (최초 unlocked)
 *   - Lesson 2  : Lesson 1 완료
 *   - Lesson 3  : Lesson 2 완료
 *   - Lesson 4  : Lesson 3 완료
 *   - Lesson 5  : Lesson 4 완료
 *   - Lesson 6  : Lesson 4 AND Lesson 5 완료
 *   - Lesson 7  : Lesson 6 완료
 *   - Lesson 8  : Lesson 3 AND Lesson 6 완료
 *   - Lesson 9  : Lesson 7 AND Lesson 8 완료
 *   - Lesson 10 : Lesson 1 ~ Lesson 9 모두 완료
 *
 * allLessons 배열에 prerequisites 필드가 있으면 그것을 우선 사용한다.
 * 없으면 위 규칙을 하드코딩된 기본값으로 적용한다.
 */
export function checkAndUnlockNextLessons(
  completedSlug: string,
  allLessons: LessonMeta[],
): string[] {
  const state = getLearningState();
  const newlyUnlocked: string[] = [];

  for (const lesson of allLessons) {
    // 이미 잠금 해제 이상인 레슨은 건너뜀
    const current = state.lessons[lesson.slug] ?? defaultLessonProgress(lesson.slug);
    if (current.status !== 'locked') continue;

    const prereqs = getPrerequisites(lesson, allLessons);
    if (prereqs.length === 0) continue; // 선수 없는 레슨은 이미 unlock 상태여야 함

    // 방금 완료된 레슨이 이 레슨의 선수 목록에 없으면 스킵
    if (!prereqs.includes(completedSlug)) continue;

    // 모든 선수 레슨이 completed 인지 확인
    const allPrereqsDone = prereqs.every((prereqSlug) => {
      const p = state.lessons[prereqSlug] ?? defaultLessonProgress(prereqSlug);
      return p.status === 'completed';
    });

    if (allPrereqsDone) {
      state.lessons[lesson.slug] = {
        ...(state.lessons[lesson.slug] ?? defaultLessonProgress(lesson.slug)),
        status: 'unlocked',
      };
      newlyUnlocked.push(lesson.slug);
    }
  }

  if (newlyUnlocked.length > 0) {
    saveLearningState(state);
  }

  return newlyUnlocked;
}

// ─────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────

/**
 * PHASE7_LEARNING_PLAN.md에 정의된 기본 prerequisites 매핑
 * (LessonMeta.prerequisites가 없는 경우 폴백)
 */
const DEFAULT_PREREQUISITES: Record<string, string[]> = {
  'lesson-01-what-is-yakjaebi': [],
  'lesson-02-prescription-components': ['lesson-01-what-is-yakjaebi'],
  'lesson-03-drug-amount-basics': ['lesson-02-prescription-components'],
  'lesson-04-dispensing-fees': ['lesson-03-drug-amount-basics'],
  'lesson-05-surcharge-rules': ['lesson-04-dispensing-fees'],
  'lesson-06-copayment': ['lesson-04-dispensing-fees', 'lesson-05-surcharge-rules'],
  'lesson-07-insurance-types': ['lesson-06-copayment'],
  'lesson-08-rounding-precision': ['lesson-03-drug-amount-basics', 'lesson-06-copayment'],
  'lesson-09-special-cases': ['lesson-07-insurance-types', 'lesson-08-rounding-precision'],
  'lesson-10-integrated-practice': [
    'lesson-01-what-is-yakjaebi',
    'lesson-02-prescription-components',
    'lesson-03-drug-amount-basics',
    'lesson-04-dispensing-fees',
    'lesson-05-surcharge-rules',
    'lesson-06-copayment',
    'lesson-07-insurance-types',
    'lesson-08-rounding-precision',
    'lesson-09-special-cases',
  ],
};

/**
 * LessonMeta에 prerequisites 필드가 있으면 그것을 사용하고,
 * 없으면 DEFAULT_PREREQUISITES에서 번호 기반 slug로 폴백한다.
 */
function getPrerequisites(lesson: LessonMeta, allLessons: LessonMeta[]): string[] {
  // LessonMeta에 prerequisites가 명시된 경우
  if (lesson.prerequisites && lesson.prerequisites.length >= 0) {
    return lesson.prerequisites;
  }

  // 하드코딩 기본값 조회
  if (DEFAULT_PREREQUISITES[lesson.slug] !== undefined) {
    return DEFAULT_PREREQUISITES[lesson.slug];
  }

  // 순수 선형 폴백: 이전 번호 레슨이 선수
  const sorted = [...allLessons].sort((a, b) => a.number - b.number);
  const idx = sorted.findIndex((l) => l.slug === lesson.slug);
  if (idx <= 0) return [];
  return [sorted[idx - 1].slug];
}

// ─────────────────────────────────────────────
// 초기화 헬퍼: Lesson 1 unlock + 전체 상태 설정
// ─────────────────────────────────────────────

/**
 * 전체 레슨 목록을 받아 초기 상태를 설정한다.
 * - 선수 레슨이 없는 레슨(Lesson 1)은 'unlocked'
 * - 나머지는 'locked' (기존 기록이 있으면 유지)
 */
export function initializeLearningState(allLessons: LessonMeta[]): void {
  const state = getLearningState();
  let changed = false;

  for (const lesson of allLessons) {
    if (state.lessons[lesson.slug]) continue; // 이미 기록 있으면 건드리지 않음

    const prereqs = getPrerequisites(lesson, allLessons);
    const initialStatus = prereqs.length === 0 ? 'unlocked' : 'locked';
    state.lessons[lesson.slug] = {
      ...defaultLessonProgress(lesson.slug),
      status: initialStatus,
    };
    changed = true;
  }

  if (changed) {
    saveLearningState(state);
  }
}
