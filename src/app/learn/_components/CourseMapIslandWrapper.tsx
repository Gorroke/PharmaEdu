'use client';

import { useEffect, useState } from 'react';
import { CourseMap, type LessonMeta, type LessonProgress } from '@/components/learning/CourseMap';
import { getLearningState, initializeLearningState } from '@/lib/learning/progress';
import type { LessonMeta as FullLessonMeta } from '@/content/lessons/index';

interface CourseMapIslandWrapperProps {
  lessons: FullLessonMeta[];
}

/**
 * CourseMap에 필요한 progress 데이터를 localStorage에서 읽어 주입하는 클라이언트 래퍼.
 * SSR에서는 모든 레슨을 locked 상태로 렌더링하고, 클라이언트에서 실제 상태로 업데이트한다.
 */
export function CourseMapIslandWrapper({ lessons }: CourseMapIslandWrapperProps) {
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [currentLessonSlug, setCurrentLessonSlug] = useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // 초기화: 처음 방문한 경우 Lesson 1 unlock
    initializeLearningState(lessons);

    const state = getLearningState();

    // LearningState.lessons → CourseMap이 사용하는 Record<string, LessonProgress> 변환
    const mapped: Record<string, LessonProgress> = {};
    for (const [slug, lp] of Object.entries(state.lessons)) {
      mapped[slug] = { status: lp.status };
    }

    // SSR-safe hydration: localStorage는 클라이언트에서만 접근 가능
    setProgress(mapped);
    setCurrentLessonSlug(state.currentLesson ?? undefined);
    setHydrated(true);
  }, [lessons]);

  // LessonMeta 타입 변환 (CourseMap용 — subtitle/objectives 없음)
  const mapLessons: LessonMeta[] = lessons.map((l) => ({
    slug: l.slug,
    number: l.number,
    title: l.title,
    track: l.track,
    estimatedMinutes: l.estimatedMinutes,
  }));

  if (!hydrated) {
    // SSR / 하이드레이션 전: 스켈레톤
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 lg:p-8 h-56 flex items-center justify-center">
        <span className="text-sm text-text-muted animate-pulse">로드맵 로딩 중...</span>
      </div>
    );
  }

  return (
    <CourseMap
      lessons={mapLessons}
      progress={progress}
      currentLessonSlug={currentLessonSlug}
    />
  );
}
