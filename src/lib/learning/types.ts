// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — Learning Progress Types
// ─────────────────────────────────────────────

export type LessonStatus = 'locked' | 'unlocked' | 'in-progress' | 'completed';

export interface LessonProgress {
  slug: string;
  status: LessonStatus;
  readPercent: number;       // 0~100
  quizPassed: boolean;
  /** 통과한 인라인 KnowledgeCheck checkId 목록 (마크다운 마커 단위) */
  passedKCs?: string[];
  visitedAt?: number;        // Unix timestamp (ms)
  completedAt?: number;      // Unix timestamp (ms)
}

export interface LearningState {
  lessons: Record<string, LessonProgress>;
  currentLesson: string | null;
  totalReadMinutes: number;
}

/**
 * 레슨 메타데이터 (unlock 로직에 사용)
 * CourseMap.tsx의 LessonMeta와 호환되며 prerequisites 필드 추가
 */
export interface LessonMeta {
  slug: string;
  number: number;
  title: string;
  track: '기초' | '중급' | '심화';
  estimatedMinutes: number;
  prerequisites: string[];   // slug 목록 (빈 배열이면 선수 레슨 없음)
}
