import { Suspense } from 'react';
import Link from 'next/link';
import { Clock, BookOpen, Trophy, LayoutList } from 'lucide-react';
import { LESSONS } from '@/content/lessons/index';
import { CHAPTERS } from '@/content/chapters/index';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { LearnHeroIsland } from './_components/LearnHeroIsland';

// 트랙 → Badge variant 매핑
const TRACK_BADGE = {
  '기초': 'success' as const,
  '중급': 'info' as const,
  '심화': 'warning' as const,
};

// 참조용 챕터 링크 (원본 명세서 섹션에 사용)
const REFERENCE_CHAPTERS = CHAPTERS.filter((ch) =>
  ['ch00-기준데이터', 'ch01-약품금액', 'ch02-조제료코드', 'ch05-본인부담금', 'ch07-반올림절사'].includes(ch.slug)
);

export default function LearnPage() {
  return (
    <div className="space-y-10">
      {/* ① 히어로 — 진도 요약 (클라이언트 아일랜드) */}
      <Suspense
        fallback={
          <div className="h-40 bg-primary-600 rounded-2xl animate-pulse" />
        }
      >
        <LearnHeroIsland lessons={LESSONS} />
      </Suspense>

      {/* ② CourseMap — 커리큘럼 로드맵 */}
      <Suspense
        fallback={
          <div className="h-64 bg-bg-surface border border-border-light rounded-2xl animate-pulse" />
        }
      >
        <CourseMapIsland />
      </Suspense>

      {/* ③ 레슨 카드 목록 */}
      <section aria-labelledby="lesson-list-heading">
        <h2
          id="lesson-list-heading"
          className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2"
        >
          <BookOpen className="w-5 h-5 text-primary-500" aria-hidden="true" />
          전체 레슨 목록
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LESSONS.map((lesson) => (
            <Link
              key={lesson.slug}
              href={`/learn/lesson/${lesson.slug}`}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-xl"
            >
              <Card
                variant="elevated"
                className="h-full p-5 hover:border-primary-400 transition-all duration-200 group-hover:-translate-y-0.5"
              >
                {/* 상단: 트랙 배지 + 예상시간 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-text-muted tracking-wider">
                      Lesson {lesson.number}
                    </span>
                    <Badge variant={TRACK_BADGE[lesson.track]}>{lesson.track}</Badge>
                  </div>
                  <span className="text-xs text-text-muted flex items-center gap-0.5">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {lesson.estimatedMinutes}분
                  </span>
                </div>

                {/* 레슨 제목 */}
                <h3 className="text-base font-semibold text-text-primary mb-1.5 group-hover:text-primary-600 transition-colors leading-snug">
                  {lesson.title}
                </h3>

                {/* 부제 */}
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                  {lesson.subtitle}
                </p>

                {/* 호버 CTA */}
                <div className="mt-4 flex items-center text-primary-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  레슨 시작 →
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ④ 원본 명세서 참조 링크 */}
      <section
        aria-labelledby="reference-heading"
        className="p-6 bg-primary-50 border border-primary-100 rounded-xl"
      >
        <h2
          id="reference-heading"
          className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2"
        >
          <LayoutList className="w-5 h-5 text-primary-500" aria-hidden="true" />
          원본 명세서 참조
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          레슨 내용의 기술적 근거가 되는 원문 챕터 명세서입니다.
          심화 학습이나 구현 참조 시 활용하세요.
        </p>

        <ul className="space-y-2">
          {REFERENCE_CHAPTERS.map((ch) => (
            <li key={ch.slug}>
              <Link
                href={`/learn/${ch.slug}`}
                className="text-sm text-primary-600 hover:text-primary-700 hover:underline underline-offset-2 flex items-center gap-2"
              >
                <span className="font-mono text-xs font-bold text-text-muted w-10">
                  {ch.number}
                </span>
                {ch.title}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/learn/chapters"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline underline-offset-2 font-medium"
            >
              전체 챕터 목록 보기 (13개) →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// CourseMap 클라이언트 아일랜드 래퍼
// CourseMap 자체가 'use client'이므로 서버 페이지에서 직접 import 가능
// ─────────────────────────────────────────────

import { CourseMapIslandWrapper } from './_components/CourseMapIslandWrapper';

function CourseMapIsland() {
  return <CourseMapIslandWrapper lessons={LESSONS} />;
}
