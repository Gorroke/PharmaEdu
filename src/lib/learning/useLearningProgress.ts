'use client';

// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — useLearningProgress Hook
// SSR-safe React hook for learning progress
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import type { LearningState, LessonProgress, LessonMeta } from './types';
import {
  getLearningState,
  saveLearningState,
  getLessonProgress as getProgressFromStorage,
  markLessonVisited as visitLesson,
  markQuizPassed as passQuiz,
  markLessonCompleted as completeLesson,
  checkAndUnlockNextLessons,
} from './progress';

export function useLearningProgress(allLessons?: LessonMeta[]) {
  // SSR-safe: 초기값은 null (hydration 전)
  const [state, setState] = useState<LearningState | null>(null);

  // 클라이언트 마운트 후 localStorage에서 상태 로드 (SSR-safe hydration)
  useEffect(() => {
    setState(getLearningState());
  }, []);

  /**
   * 로컬 React state와 localStorage를 동시에 업데이트하는 내부 헬퍼
   */
  const syncState = useCallback(() => {
    setState(getLearningState());
  }, []);

  /**
   * LearningState 일부를 직접 업데이트한다 (고급 사용)
   */
  const update = useCallback(
    (partial: Partial<LearningState>) => {
      const current = getLearningState();
      const next: LearningState = { ...current, ...partial };
      saveLearningState(next);
      setState(next);
    },
    [],
  );

  /**
   * 레슨 방문 처리 (status → in-progress, visitedAt 기록, currentLesson 갱신)
   */
  const markVisited = useCallback(
    (slug: string) => {
      visitLesson(slug);
      syncState();
    },
    [syncState],
  );

  /**
   * 퀴즈 통과 처리 + 다음 레슨 자동 unlock
   * allLessons가 제공된 경우 checkAndUnlockNextLessons 실행
   */
  const markQuizPassed = useCallback(
    (slug: string) => {
      passQuiz(slug);
      if (allLessons && allLessons.length > 0) {
        checkAndUnlockNextLessons(slug, allLessons);
      }
      syncState();
    },
    [allLessons, syncState],
  );

  /**
   * 레슨 완료 처리 + 다음 레슨 자동 unlock
   * allLessons가 제공된 경우 checkAndUnlockNextLessons 실행
   */
  const markCompleted = useCallback(
    (slug: string) => {
      completeLesson(slug);
      if (allLessons && allLessons.length > 0) {
        checkAndUnlockNextLessons(slug, allLessons);
      }
      syncState();
    },
    [allLessons, syncState],
  );

  /**
   * 특정 레슨의 진도를 반환한다.
   * state가 아직 null(로딩 중)이면 localStorage에서 직접 읽는다.
   */
  const getLessonProgress = useCallback(
    (slug: string): LessonProgress => {
      if (state) {
        const { lessons } = state;
        return (
          lessons[slug] ?? {
            slug,
            status: 'locked',
            readPercent: 0,
            quizPassed: false,
          }
        );
      }
      return getProgressFromStorage(slug);
    },
    [state],
  );

  return {
    state,
    isLoading: state === null,
    markVisited,
    markQuizPassed,
    markCompleted,
    getLessonProgress,
    update,
  };
}
