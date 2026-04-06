'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, Menu, X, ChevronRight, Clock } from 'lucide-react';
import { CHAPTERS } from '@/content/chapters/index';
import { useVisitedChapters, VisitedDot } from './_components/ProgressTracker';
import { Badge } from '@/components/ui/Badge';
import type { Difficulty } from '@/content/chapters/index';

/** Difficulty -> Badge variant 매핑 */
const DIFFICULTY_BADGE: Record<Difficulty, 'success' | 'info' | 'warning' | 'error'> = {
  '입문': 'success',
  '기초': 'info',
  '중급': 'warning',
  '심화': 'error',
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { visited } = useVisitedChapters();

  // /learn/lesson/[slug] 경로는 별도 레이아웃 사용 — 사이드바 없이 children만 렌더
  if (pathname.startsWith('/learn/lesson')) {
    return <>{children}</>;
  }

  const visitedCount = CHAPTERS.filter((ch) => visited.has(ch.slug)).length;

  return (
    <div className="min-h-screen bg-bg-page">
      {/* 모바일 헤더 */}
      <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-bg-surface border-b border-border-light sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? '챕터 목록 닫기' : '챕터 목록 열기'}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-text-primary"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
        <span className="font-semibold text-sm text-text-primary">팜에듀 — 학습</span>
        {visitedCount > 0 && (
          <span className="ml-auto text-xs text-text-muted">
            {visitedCount}/{CHAPTERS.length} 완료
          </span>
        )}
      </div>

      <div className="flex">
        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* 사이드바 */}
        <aside
          className={[
            'fixed top-0 left-0 h-full w-72 bg-bg-sidebar z-30 overflow-y-auto transition-transform duration-300',
            'flex flex-col',
            'lg:sticky lg:top-0 lg:translate-x-0 lg:flex-shrink-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          ].join(' ')}
          style={{ boxShadow: 'var(--shadow-sidebar)' }}
        >
          {/* 사이드바 헤더 */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <Link
              href="/learn"
              className="flex items-center gap-2 text-white hover:text-secondary-500 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <BookOpen className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-bold text-base">챕터 목록</span>
            </Link>
            {/* 진행률 표시 */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-neutral-400">학습 진행률</span>
                <span className="text-xs text-neutral-300 font-mono">
                  {visitedCount}/{CHAPTERS.length}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${(visitedCount / CHAPTERS.length) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={visitedCount}
                  aria-valuemin={0}
                  aria-valuemax={CHAPTERS.length}
                  aria-label={`학습 진행률 ${visitedCount}/${CHAPTERS.length}`}
                />
              </div>
            </div>
          </div>

          {/* 챕터 네비게이션 */}
          <nav className="flex-1 py-2 overflow-y-auto" aria-label="챕터 목록">
            {CHAPTERS.map((chapter) => {
              const href = `/learn/${chapter.slug}`;
              const isActive = pathname === href;
              const isVisited = visited.has(chapter.slug);

              return (
                <Link
                  key={chapter.slug}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={[
                    'flex items-start gap-3 px-4 py-3 mx-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className={[
                    'flex-shrink-0 w-10 text-xs font-mono pt-0.5',
                    isActive ? 'text-white/80' : 'text-neutral-400',
                  ].join(' ')}>
                    {chapter.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium leading-snug flex-1">
                        {chapter.title}
                      </span>
                      <VisitedDot slug={chapter.slug} visited={visited} />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge
                        variant={DIFFICULTY_BADGE[chapter.difficulty]}
                        className="text-[10px] h-4 px-1.5"
                      >
                        {chapter.difficulty}
                      </Badge>
                      <span className={[
                        'text-xs flex items-center gap-0.5',
                        isActive ? 'text-white/60' : 'text-neutral-500',
                      ].join(' ')}>
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {chapter.estimatedMinutes}분
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-white/60 flex-shrink-0 self-center" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
