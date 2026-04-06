'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { getLearningState, initializeLearningState } from '@/lib/learning/progress';
import type { LessonMeta } from '@/content/lessons/index';

interface LearnHeroIslandProps {
  lessons: LessonMeta[];
}

export function LearnHeroIsland({ lessons }: LearnHeroIslandProps) {
  const [hydrated, setHydrated] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const totalCount = lessons.length;

  useEffect(() => {
    initializeLearningState(lessons);
    const state = getLearningState();
    const done = Object.values(state.lessons).filter((l) => l.status === 'completed').length;
    // SSR-safe hydration: localStorage는 클라이언트에서만 접근 가능
    setCompletedCount(done);
    setCurrentSlug(state.currentLesson);
    setHydrated(true);
  }, [lessons]);

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // CTA 버튼 대상 결정
  const ctaSlug = currentSlug ?? lessons[0]?.slug;
  const ctaLesson = ctaSlug ? lessons.find((l) => l.slug === ctaSlug) : lessons[0];
  const isAllDone = completedCount === totalCount && totalCount > 0;

  const ctaText = isAllDone
    ? '복습하기'
    : currentSlug
      ? `Lesson ${ctaLesson?.number ?? ''} 계속하기`
      : '학습 시작하기';

  const ctaHref = `/learn/lesson/${ctaSlug ?? lessons[0]?.slug ?? ''}`;

  return (
    <section
      aria-label="학습 현황"
      className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 p-6 lg:py-10 lg:px-8 text-white"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* 왼쪽: 제목 + CTA */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-7 h-7 text-yellow-300 flex-shrink-0" aria-hidden="true" />
            <h1 className="text-2xl font-bold">나의 학습 현황</h1>
          </div>
          <p className="text-base opacity-80 mb-4">약제비 계산 마스터 과정</p>

          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary-50 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            {ctaText} →
          </Link>
        </div>

        {/* 오른쪽: 스탯 카드 3개 */}
        <div className="grid grid-cols-3 gap-3 lg:w-72">
          {/* 진도율 */}
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold leading-none">
              {hydrated ? `${progressPct}%` : '—'}
            </p>
            <p className="text-xs opacity-70 mt-1">전체 진도</p>
          </div>

          {/* 완료 레슨 */}
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold leading-none">
              {hydrated ? `${completedCount}/${totalCount}` : `—/${totalCount}`}
            </p>
            <p className="text-xs opacity-70 mt-1">완료 레슨</p>
          </div>

          {/* 남은 예상 시간 */}
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold leading-none">
              {hydrated
                ? (() => {
                    const state = getLearningState();
                    const remaining = lessons
                      .filter((l) => {
                        const s = state.lessons[l.slug]?.status;
                        return s !== 'completed';
                      })
                      .reduce((acc, l) => acc + l.estimatedMinutes, 0);
                    return remaining > 0 ? `${remaining}분` : '완료!';
                  })()
                : '—'}
            </p>
            <p className="text-xs opacity-70 mt-1">예상 잔여</p>
          </div>
        </div>
      </div>
    </section>
  );
}
