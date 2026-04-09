'use client';

// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — /learn 공통 레이아웃
// 레슨·챕터 모든 경로에 통합 사이드바 적용
// ─────────────────────────────────────────────

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LearningSidebar } from '@/components/learning/LearningSidebar';

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-page">
      {/* 모바일 헤더 */}
      <div className="lg:hidden flex items-center gap-3 px-4 py-2 bg-bg-surface border-b border-border-light sticky top-0 z-30 shadow-sm">
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors text-text-primary"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
        <span className="font-semibold text-sm text-text-primary">팜에듀 — 학습</span>
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
            'lg:sticky lg:top-0 lg:translate-x-0 lg:flex-shrink-0 lg:h-screen',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          ].join(' ')}
          style={{ boxShadow: 'var(--shadow-sidebar)' }}
        >
          <LearningSidebar onNavigate={() => setSidebarOpen(false)} />
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
