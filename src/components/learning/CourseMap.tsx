'use client';

import Link from 'next/link';
import { Lock, CheckCircle2, CircleDashed, BookOpen } from 'lucide-react';
import { useState } from 'react';

// ─────────────────────────────────────────────
// TypeScript 타입 정의 (외부 컴포넌트에서도 사용 가능)
// ─────────────────────────────────────────────

export interface LessonMeta {
  slug: string;
  number: number;
  title: string;
  track: '기초' | '중급' | '심화';
  estimatedMinutes: number;
}

export type LessonProgressStatus = 'locked' | 'unlocked' | 'in-progress' | 'completed';

export type LessonProgress = {
  status: LessonProgressStatus;
};

export interface CourseMapProps {
  lessons: LessonMeta[];
  progress: Record<string, LessonProgress>; // from localStorage
  currentLessonSlug?: string;
}

// ─────────────────────────────────────────────
// 트랙 설정
// ─────────────────────────────────────────────

type TrackKey = '기초' | '중급' | '심화';

interface TrackConfig {
  label: string;
  range: string;
  headerClass: string;
  badgeClass: string;
}

const TRACK_CONFIG: Record<TrackKey, TrackConfig> = {
  기초: {
    label: '기초 트랙',
    range: 'Lesson 1~3',
    headerClass: 'text-neutral-500 bg-neutral-100',
    badgeClass: 'bg-neutral-100 text-neutral-500',
  },
  중급: {
    label: '중급 트랙',
    range: 'Lesson 4~7',
    headerClass: 'text-primary-600 bg-primary-100',
    badgeClass: 'bg-primary-100 text-primary-600',
  },
  심화: {
    label: '심화 트랙',
    range: 'Lesson 8~10',
    headerClass: 'text-warning-600 bg-warning-100',
    badgeClass: 'bg-warning-100 text-warning-600',
  },
};

// ─────────────────────────────────────────────
// 노드 스타일 헬퍼
// ─────────────────────────────────────────────

function getNodeStyle(status: LessonProgressStatus) {
  switch (status) {
    case 'completed':
      return {
        circle: 'w-12 h-12 bg-[#13DEB9] text-white ring-4 ring-[#13DEB9]/20',
        icon: <CheckCircle2 className="w-6 h-6" aria-hidden="true" />,
        cursor: 'cursor-pointer',
        pulse: false,
      };
    case 'in-progress':
      return {
        circle:
          'w-14 h-14 bg-primary-500 text-white ring-4 ring-primary-500/30',
        icon: <BookOpen className="w-6 h-6" aria-hidden="true" />,
        cursor: 'cursor-pointer',
        pulse: true,
      };
    case 'unlocked':
      return {
        circle: 'w-12 h-12 bg-primary-500 text-white',
        icon: null,
        cursor: 'cursor-pointer',
        pulse: false,
      };
    case 'locked':
    default:
      return {
        circle: 'w-12 h-12 bg-neutral-200 text-neutral-400 cursor-not-allowed',
        icon: <Lock className="w-5 h-5" aria-hidden="true" />,
        cursor: 'cursor-not-allowed',
        pulse: false,
      };
  }
}

// ─────────────────────────────────────────────
// 연결선 컴포넌트 (가로 / 세로)
// ─────────────────────────────────────────────

interface ConnectorProps {
  fromStatus: LessonProgressStatus;
  toStatus: LessonProgressStatus;
  vertical?: boolean;
}

function Connector({ fromStatus, toStatus, vertical = false }: ConnectorProps) {
  const fromDone = fromStatus === 'completed';
  const toStarted = toStatus === 'in-progress' || toStatus === 'completed';

  let classes: string;

  if (fromDone && toStarted) {
    classes = 'bg-[#13DEB9]';
  } else if (fromDone) {
    // 완료 → 미시작: success-500 에서 neutral-200 그라데이션
    classes = vertical
      ? 'bg-gradient-to-b from-[#13DEB9] to-[#EAEFF4]'
      : 'bg-gradient-to-r from-[#13DEB9] to-[#EAEFF4]';
  } else {
    classes = 'bg-neutral-200';
  }

  if (vertical) {
    return <div className={`w-1 h-6 mx-auto rounded-full ${classes}`} />;
  }
  return <div className={`flex-1 h-1 rounded-full ${classes}`} />;
}

// ─────────────────────────────────────────────
// 레슨 노드 컴포넌트
// ─────────────────────────────────────────────

interface LessonNodeProps {
  lesson: LessonMeta;
  status: LessonProgressStatus;
  isCurrent: boolean;
  onLockedClick: () => void;
}

function LessonNode({ lesson, status, isCurrent: _isCurrent, onLockedClick }: LessonNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const style = getNodeStyle(status);
  const isClickable = status === 'unlocked' || status === 'completed' || status === 'in-progress';

  const nodeEl = (
    <div
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-label={`Lesson ${lesson.number}: ${lesson.title}${status === 'locked' ? ' (잠김)' : ''}`}
      className={[
        'relative flex items-center justify-center rounded-full font-bold text-sm select-none',
        'transition-transform duration-200',
        isClickable ? 'hover:scale-110 focus-visible:scale-110' : '',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        style.circle,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={status === 'locked' ? onLockedClick : undefined}
      onKeyDown={
        status === 'locked'
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') onLockedClick(); }
          : undefined
      }
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {/* pulse ring (in-progress) */}
      {style.pulse && (
        <span
          className="absolute inset-0 rounded-full bg-primary-500/40 animate-ping"
          aria-hidden="true"
        />
      )}

      {/* 아이콘 또는 번호 */}
      {style.icon ?? (
        <span className="relative z-10 font-extrabold">{lesson.number}</span>
      )}

      {/* 호버 툴팁 */}
      {showTooltip && (
        <div
          className={[
            'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
            'bg-neutral-600 text-white text-xs rounded-lg px-3 py-2',
            'whitespace-nowrap shadow-lg z-50 pointer-events-none',
            'after:content-[""] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2',
            'after:border-4 after:border-transparent after:border-t-neutral-600',
          ].join(' ')}
          role="tooltip"
        >
          <p className="font-semibold">{lesson.title}</p>
          <p className="opacity-70 mt-0.5">약 {lesson.estimatedMinutes}분</p>
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/learn/lesson/${lesson.slug}`} className="outline-none block">
        {nodeEl}
      </Link>
    );
  }

  return nodeEl;
}

// ─────────────────────────────────────────────
// Toast 간이 구현 (외부 Toast 없는 경우 대비)
// ─────────────────────────────────────────────

interface ToastState {
  visible: boolean;
  message: string;
}

// ─────────────────────────────────────────────
// 트랙 섹션 컴포넌트
// ─────────────────────────────────────────────

interface TrackSectionProps {
  track: TrackKey;
  lessons: LessonMeta[];
  progress: Record<string, LessonProgress>;
  currentLessonSlug?: string;
  onLockedClick: () => void;
}

function TrackSection({
  track,
  lessons,
  progress,
  currentLessonSlug,
  onLockedClick,
}: TrackSectionProps) {
  const config = TRACK_CONFIG[track];
  const trackLessons = lessons
    .filter((l) => l.track === track)
    .sort((a, b) => a.number - b.number);

  return (
    <div className="flex-1 min-w-0">
      {/* 트랙 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className={[
            'inline-flex items-center px-3 py-1 rounded-full',
            'text-xs font-semibold uppercase tracking-wider',
            config.headerClass,
          ].join(' ')}
        >
          {config.label}
        </span>
        <span className="text-xs text-neutral-400">{config.range}</span>
      </div>

      {/* 데스크탑: 가로 배치 (flex-row) / 모바일: 세로 배치 (flex-col) */}
      <div className="flex flex-col sm:flex-row items-center gap-0">
        {trackLessons.map((lesson, idx) => {
          const status = progress[lesson.slug]?.status ?? 'locked';
          const nextLesson = trackLessons[idx + 1];
          const nextStatus = nextLesson
            ? (progress[nextLesson.slug]?.status ?? 'locked')
            : null;

          return (
            <div
              key={lesson.slug}
              className="flex flex-col sm:flex-row items-center gap-0 w-full sm:w-auto"
            >
              {/* 노드 + 라벨 */}
              <div className="flex flex-col items-center gap-2">
                <LessonNode
                  lesson={lesson}
                  status={status}
                  isCurrent={lesson.slug === currentLessonSlug}
                  onLockedClick={onLockedClick}
                />
                {/* 노드 하단 텍스트 */}
                <div className="text-center max-w-[80px] sm:max-w-[72px]">
                  <p className="text-xs text-neutral-400 leading-none mb-0.5">
                    Lesson {lesson.number}
                  </p>
                  <p className="text-xs font-medium text-neutral-600 leading-snug line-clamp-2">
                    {lesson.title}
                  </p>
                </div>
              </div>

              {/* 연결선: 마지막 노드 제외 */}
              {nextStatus !== null && (
                <>
                  {/* 세로 연결선 (모바일) */}
                  <div className="sm:hidden my-1">
                    <Connector fromStatus={status} toStatus={nextStatus} vertical />
                  </div>
                  {/* 가로 연결선 (태블릿 이상) */}
                  <div className="hidden sm:block w-8 flex-shrink-0">
                    <Connector fromStatus={status} toStatus={nextStatus} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 CourseMap 컴포넌트
// ─────────────────────────────────────────────

export function CourseMap({ lessons, progress, currentLessonSlug }: CourseMapProps) {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });

  function showLockedToast() {
    setToast({ visible: true, message: '선수 레슨을 완료하세요' });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  }

  const tracks: TrackKey[] = ['기초', '중급', '심화'];

  return (
    <section
      aria-label="코스 맵"
      className="relative bg-white rounded-2xl shadow-sm p-6 lg:p-8"
    >
      {/* 섹션 제목 */}
      <h2 className="text-lg font-bold text-neutral-600 mb-6">커리큘럼 로드맵</h2>

      {/* 3트랙 레이아웃: 모바일 세로 스택 / 데스크탑 가로 3열 */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6">
        {tracks.map((track, trackIdx) => (
          <div key={track} className="flex flex-col lg:flex-row items-stretch gap-0">
            <TrackSection
              track={track}
              lessons={lessons}
              progress={progress}
              currentLessonSlug={currentLessonSlug}
              onLockedClick={showLockedToast}
            />

            {/* 트랙 구분선: 마지막 트랙 제외 */}
            {trackIdx < tracks.length - 1 && (
              <>
                {/* 모바일/태블릿: 가로 구분선 */}
                <div className="lg:hidden my-4 border-t border-dashed border-neutral-200" />
                {/* 데스크탑: 세로 구분선 */}
                <div className="hidden lg:block w-px self-stretch bg-neutral-200 mx-4 my-4" />
              </>
            )}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="mt-8 pt-6 border-t border-neutral-100 flex flex-wrap gap-4">
        <LegendItem color="bg-[#13DEB9]" label="완료" />
        <LegendItem color="bg-primary-500" label="진행 중 / 시작 가능" pulse />
        <LegendItem color="bg-neutral-200" label="잠김" />
      </div>

      {/* 잠금 클릭 Toast */}
      {toast.visible && (
        <div
          role="alert"
          aria-live="polite"
          className={[
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-warning-500 text-white text-sm font-medium',
            'px-5 py-3 rounded-xl shadow-lg',
            'flex items-center gap-2',
            'animate-fade-in-up',
          ].join(' ')}
        >
          <Lock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {toast.message}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// 범례 아이템
// ─────────────────────────────────────────────

function LegendItem({
  color,
  label,
  pulse = false,
}: {
  color: string;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span className={`relative w-3 h-3 rounded-full ${color} flex-shrink-0`}>
        {pulse && (
          <span
            className={`absolute inset-0 rounded-full ${color} animate-ping opacity-50`}
            aria-hidden="true"
          />
        )}
      </span>
      {label}
    </div>
  );
}
