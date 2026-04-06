import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LearnContent } from '../_components/LearnContent';
import type { Difficulty } from '@/content/chapters/index';

/** Difficulty -> Badge variant 매핑 */
const DIFFICULTY_BADGE: Record<Difficulty, 'success' | 'info' | 'warning' | 'error'> = {
  '입문': 'success',
  '기초': 'info',
  '중급': 'warning',
  '심화': 'error',
};

export const metadata = {
  title: '원본 명세서 챕터 목록 — 팜에듀',
  description: '약제비 계산 로직 기술 명세서 CH00~CH12 전체 목록',
};

export default function ChaptersPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* 뒤로가기 */}
      <div className="mb-4">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          학습 홈으로
        </Link>
      </div>

      {/* 페이지 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6 text-primary-500" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-text-primary">원본 명세서 챕터 목록</h1>
        </div>
        <p className="text-text-secondary leading-relaxed">
          건강보험 약제비 계산 로직을 13개 챕터로 정리한 기술 명세서입니다.
          레슨 콘텐츠의 원본 자료로, 구현 참고나 심화 학습에 활용하세요.
        </p>

        {/* 난이도 범례 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(['입문', '기초', '중급', '심화'] as const).map((d) => (
            <Badge key={d} variant={DIFFICULTY_BADGE[d]}>
              {d}
            </Badge>
          ))}
        </div>
      </div>

      {/* 검색 + 필터 + 챕터 목록 */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-10 bg-bg-surface border border-border-light rounded-lg animate-pulse" />
            <div className="flex gap-2">
              {['전체', '입문', '기초', '중급', '심화'].map((l) => (
                <div
                  key={l}
                  className="h-7 w-12 bg-bg-surface border border-border-light rounded-full animate-pulse"
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 bg-bg-surface border border-border-light rounded-xl animate-pulse"
                />
              ))}
            </div>
          </div>
        }
      >
        <LearnContent />
      </Suspense>

      {/* 하단 안내 */}
      <div className="mt-10 p-5 bg-info-100 rounded-xl border border-info-100 text-sm text-text-primary">
        <strong className="text-info-500">학습 순서 안내:</strong>{' '}
        기술 명세서보다 학습용 레슨을 먼저 읽으시려면{' '}
        <Link href="/learn" className="text-primary-600 hover:underline">
          레슨 커리큘럼 →
        </Link>
        을 이용하세요.
      </div>
    </div>
  );
}
