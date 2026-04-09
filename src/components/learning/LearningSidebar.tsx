'use client';

// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — 통합 학습 사이드바 (리디자인)
// 레슨(10개) + 참조 챕터(13개) — 통일된 단일 목록 스타일
// ─────────────────────────────────────────────

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { LESSONS } from '@/content/lessons/index';
import { CHAPTERS } from '@/content/chapters/index';
import { useLearningProgress } from '@/lib/learning/useLearningProgress';

interface LearningSidebarProps {
  onNavigate?: () => void;
}

// ── 트랙별 그룹핑 (레슨 섹션 내 서브 레이블용) ──
const TRACK_ORDER = ['기초', '중급', '심화'] as const;
type Track = (typeof TRACK_ORDER)[number];

// ── 섹션 헤더 컴포넌트 ──
function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-3 py-2 mt-1">
      {label}
    </h3>
  );
}

// ── 트랙 레이블 (레슨 내 서브그룹) ──
function TrackLabel({ track }: { track: Track }) {
  const colors: Record<Track, string> = {
    기초: 'text-emerald-400',
    중급: 'text-amber-400',
    심화: 'text-rose-400',
  };
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 mt-2 ${colors[track]}`}
      aria-hidden="true"
    >
      {track}
    </div>
  );
}

// ── 구분선 컴포넌트 ──
function Divider() {
  return <div className="mx-3 my-3 border-t border-white/10" role="separator" />;
}

export function LearningSidebar({ onNavigate }: LearningSidebarProps) {
  const pathname = usePathname();
  const { getLessonProgress, isLoading } = useLearningProgress();
  const [chaptersExpanded, setChaptersExpanded] = useState(true);

  // 현재 활성 슬러그
  const lessonSlug = pathname.match(/^\/learn\/lesson\/(.+)$/)?.[1];
  const chapterSlug = pathname.match(/^\/learn\/(ch\w+)(?:\/.*)?$/)?.[1];

  // 트랙별 레슨 그룹핑
  const lessonsByTrack = TRACK_ORDER.map((track) => ({
    track,
    lessons: LESSONS.filter((l) => l.track === track),
  })).filter((g) => g.lessons.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 사이드바 헤더 ── */}
      <div className="px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <Link
          href="/learn"
          className="flex items-center gap-2 text-white hover:text-secondary-500 transition-colors"
          onClick={onNavigate}
          aria-label="학습 모듈 홈으로 이동"
        >
          <BookOpen className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span className="font-bold text-base">학습 모듈</span>
        </Link>
      </div>

      {/* ── 스크롤 영역 (레슨 + 챕터 통합) ── */}
      <div className="flex-1 overflow-y-auto py-1">

        {/* ── 레슨 섹션 ── */}
        <SectionHeader label="단계별 레슨" />

        <nav aria-label="레슨 목록">
          {lessonsByTrack.map(({ track, lessons }) => (
            <div key={track}>
              <TrackLabel track={track} />
              {lessons.map((lesson) => {
                const href = `/learn/lesson/${lesson.slug}`;
                const isActive = lessonSlug === lesson.slug;
                const progress = isLoading ? null : getLessonProgress(lesson.slug);
                const isLocked = progress?.status === 'locked';
                const isCompleted = progress?.status === 'completed';

                return (
                  <Link
                    key={lesson.slug}
                    href={isLocked ? '#' : href}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                      } else {
                        onNavigate?.();
                      }
                    }}
                    data-active={isActive}
                    className={[
                      'flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary-500 text-white'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10',
                      isLocked ? 'opacity-50 cursor-not-allowed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={isLocked}
                  >
                    {/* 레슨 번호 */}
                    <span
                      className={[
                        'font-mono text-xs flex-shrink-0 w-6 text-right',
                        isActive ? 'text-white/70' : 'text-neutral-500',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {String(lesson.number).padStart(2, '0')}
                    </span>

                    {/* 제목 */}
                    <span className="flex-1 truncate leading-snug">{lesson.title}</span>

                    {/* 상태 아이콘 */}
                    {isCompleted && (
                      <CheckCircle2
                        className={[
                          'w-3.5 h-3.5 flex-shrink-0',
                          isActive ? 'text-white/70' : 'text-emerald-400',
                        ].join(' ')}
                        aria-label="완료"
                      />
                    )}
                    {isLocked && (
                      <Lock
                        className="w-3.5 h-3.5 flex-shrink-0 text-neutral-500"
                        aria-label="잠김"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── 섹션 구분선 ── */}
        <Divider />

        {/* ── 챕터 섹션 (Collapsible) ── */}
        <button
          type="button"
          onClick={() => setChaptersExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-3 py-2 hover:text-white transition-colors"
          aria-expanded={chaptersExpanded}
          aria-controls="chapter-nav"
        >
          <span>원본 명세서</span>
          {chaptersExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>

        {chaptersExpanded && (
          <nav id="chapter-nav" aria-label="챕터 목록">
            {CHAPTERS.map((chapter) => {
              const href = `/learn/${chapter.slug}`;
              const isActive = chapterSlug === chapter.slug;

              return (
                <Link
                  key={chapter.slug}
                  href={href}
                  onClick={onNavigate}
                  data-active={isActive}
                  className={[
                    'flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* 챕터 번호 */}
                  <span
                    className={[
                      'font-mono text-xs flex-shrink-0 w-6 text-right',
                      isActive ? 'text-white/70' : 'text-neutral-500',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {chapter.number.replace('CH', '')}
                  </span>

                  {/* 제목 */}
                  <span className="flex-1 truncate leading-snug">{chapter.title}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* 하단 여백 */}
        <div className="h-4" />
      </div>
    </div>
  );
}
