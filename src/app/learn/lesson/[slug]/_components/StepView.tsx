'use client';

/**
 * StepView.tsx (Polish Edition)
 * 단계별 학습 모드 — 레슨을 H2 기준으로 분할한 스텝을 한 번에 하나씩 보여준다.
 * URL: ?step=N (1-based, default: 1)
 *
 * 추가된 기능:
 *  - 페이드+슬라이드 애니메이션 (CSS keyframes, no deps)
 *  - 클릭 가능한 도트 인디케이터
 *  - 스텝 타입 감지 & 뱃지
 *  - 단계별 예상 읽기 시간
 *  - 격려 메시지 플로팅 배너 (3s 자동 닫힘)
 *  - 마지막 스텝 "레슨 완료" 특별 스타일
 *  - F키 모드 전환 단축키
 *  - localStorage 마지막 스텝 복원
 *  - 모바일 최적화
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, X, PartyPopper } from 'lucide-react';
import { InlineCalculator } from '@/components/learning/InlineCalculator';
import { KnowledgeCheck } from '@/components/learning/KnowledgeCheck';
import { Button } from '@/components/ui/Button';
import type { LessonStep } from '@/lib/learning/lesson-splitter';
import type { LessonSegment } from '@/lib/learning/markdown-renderer';
import {
  markLessonCompleted,
  checkAndUnlockNextLessons,
  areAllKCsPassed,
} from '@/lib/learning/progress';
import { LESSONS } from '@/content/lessons/index';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type StepType = 'goal' | 'concept' | 'practice' | 'quiz' | 'wrap' | 'default';

// ─── 격려 메시지 ──────────────────────────────────────────────────────────────

interface MilestoneMsg {
  emoji: string;
  message: string;
  color: string; // bg 클래스
}

const ENCOURAGE: Record<number, MilestoneMsg> = {
  25: { emoji: '🌱', message: '잘하고 있어요! 계속 가봐요.', color: 'bg-success-100 border-success-500/30 text-success-700' },
  50: { emoji: '💪', message: '절반 왔어요! 이 속도라면 충분해요.', color: 'bg-info-100 border-info-100 text-info-500' },
  75: { emoji: '✨', message: '거의 다 왔어요! 조금만 더!', color: 'bg-warning-100 border-warning-500/30 text-warning-700' },
  100: { emoji: '🎉', message: '레슨 완료! 정말 수고했어요!', color: 'bg-success-100 border-success-500/30 text-success-700' },
};

function getMilestoneMessage(percent: number): MilestoneMsg | null {
  const milestones = [100, 75, 50, 25] as const;
  for (const m of milestones) {
    if (percent >= m - 2) return ENCOURAGE[m];
  }
  return null;
}

// ─── 스텝 타입 감지 ──────────────────────────────────────────────────────────

function detectStepType(step: LessonStep): StepType {
  const titleLower = step.title.toLowerCase();
  const hasHtml = step.segments.some((s) => s.type === 'html');
  const rawText = step.segments
    .filter((s) => s.type === 'html')
    .map((s) => (s as { type: 'html'; content: string }).content)
    .join(' ')
    .toLowerCase();

  if (step.segments.some((s) => s.type === 'marker' && (s as { type: 'marker'; marker: { kind: string } }).marker.kind === 'knowledge_check'))
    return 'quiz';
  if (step.segments.some((s) => s.type === 'marker' && (s as { type: 'marker'; marker: { kind: string } }).marker.kind === 'calculator'))
    return 'practice';

  if (titleLower.includes('목표') || rawText.includes('🎯') || rawText.includes('목표')) return 'goal';
  if (titleLower.includes('배운') || titleLower.includes('마무리') || titleLower.includes('정리') || rawText.includes('다음 단계'))
    return 'wrap';
  if (titleLower.includes('왜') || titleLower.includes('무엇') || titleLower.includes('개념') || rawText.includes('왜냐하면'))
    return 'concept';
  if (titleLower.includes('계산') || titleLower.includes('실습') || titleLower.includes('어떻게'))
    return 'practice';

  return 'default';
}

const STEP_TYPE_META: Record<StepType, { icon: string; label: string; badge: string }> = {
  goal:     { icon: '🎯', label: '목표',   badge: 'bg-primary-50 text-primary-700 border border-primary-200' },
  concept:  { icon: '💡', label: '개념',   badge: 'bg-warning-100 text-warning-700 border border-warning-500/30' },
  practice: { icon: '🔧', label: '실습',   badge: 'bg-info-100 text-info-500 border border-info-100' },
  quiz:     { icon: '📝', label: '퀴즈',   badge: 'bg-error-50 text-error-500 border border-error-500/20' },
  wrap:     { icon: '🎓', label: '마무리', badge: 'bg-success-100 text-success-700 border border-success-500/30' },
  default:  { icon: '📖', label: '학습',   badge: 'bg-neutral-100 text-text-secondary border border-border-light' },
};

// ─── 읽기 시간 추정 ──────────────────────────────────────────────────────────

/** 한국어 평균 읽기 속도: 약 200 어절/분 */
function estimateReadingTime(step: LessonStep): number {
  const text = step.segments
    .filter((s) => s.type === 'html')
    .map((s) => (s as { type: 'html'; content: string }).content.replace(/<[^>]+>/g, ''))
    .join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ─── localStorage 헬퍼 ───────────────────────────────────────────────────────

function getLastStep(slug: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`pharmaedu_step_${slug}`);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function saveLastStep(slug: string, step: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`pharmaedu_step_${slug}`, String(step));
  } catch { /* ignore */ }
}

// ─── prose 스타일 (스텝 모드용 — 더 넉넉한 타이포그래피) ────────────────────

const STEP_PROSE_CLASS = [
  'bg-bg-surface rounded-xl border border-border-light p-6 lg:p-10',
  '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-text-primary',
  '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-4 [&_h2]:text-text-primary [&_h2]:border-b-2 [&_h2]:border-primary-200 [&_h2]:pb-3',
  '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-text-primary',
  '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-text-secondary',
  // 본문 17px, line-height 1.9
  '[&_p]:my-5 [&_p]:leading-[1.9] [&_p]:text-text-secondary [&_p]:text-[17px]',
  '[&_ul]:my-5 [&_ul]:pl-7 [&_ul]:list-disc [&_ul]:space-y-2.5',
  '[&_ol]:my-5 [&_ol]:pl-7 [&_ol]:list-decimal [&_ol]:space-y-2.5',
  '[&_li]:text-text-secondary [&_li]:leading-[1.9] [&_li]:text-[17px]',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-primary-400 [&_blockquote]:pl-5 [&_blockquote]:my-6 [&_blockquote]:text-text-muted [&_blockquote]:italic [&_blockquote]:bg-primary-50/40 [&_blockquote]:py-3 [&_blockquote]:rounded-r-lg',
  '[&_code]:bg-neutral-100 [&_code]:text-error-500 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
  '[&_pre]:bg-neutral-700 [&_pre]:text-neutral-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-sm',
  '[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:rounded-none',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-5 [&_table]:text-sm',
  '[&_th]:border [&_th]:border-border-medium [&_th]:p-3 [&_th]:bg-bg-panel [&_th]:font-semibold [&_th]:text-left [&_th]:text-text-secondary',
  '[&_td]:border [&_td]:border-border-medium [&_td]:p-3 [&_td]:text-text-secondary',
  '[&_tr:hover_td]:bg-primary-50',
  '[&_a]:text-primary-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary-700',
  '[&_hr]:border-border-light [&_hr]:my-7',
  '[&_strong]:font-semibold [&_strong]:text-text-primary',
  '[&_details]:my-4 [&_details]:border [&_details]:border-border-light [&_details]:rounded-lg [&_details]:p-4',
  '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-text-primary',
].join(' ');

// ─── 세그먼트 렌더러 ─────────────────────────────────────────────────────────

function SegmentRenderer({
  segment,
  idx,
  lessonSlug,
  onKCPass,
}: {
  segment: LessonSegment;
  idx: number;
  lessonSlug?: string;
  onKCPass?: () => void;
}) {
  if (segment.type === 'html') {
    return (
      <div
        key={idx}
        dangerouslySetInnerHTML={{ __html: segment.content }}
      />
    );
  }
  const { marker } = segment;
  if (marker.kind === 'calculator') {
    return <InlineCalculator key={idx} preset={marker.preset} />;
  }
  if (marker.kind === 'knowledge_check') {
    return (
      <KnowledgeCheck
        key={idx}
        checkId={marker.checkId}
        lessonSlug={lessonSlug}
        onPass={onKCPass}
      />
    );
  }
  return null;
}

// ─── 격려 플로팅 배너 ────────────────────────────────────────────────────────

function EncourageBanner({
  msg,
  onClose,
}: {
  msg: MilestoneMsg;
  onClose: () => void;
}) {
  // 3초 후 자동 닫힘
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={[
        'fixed top-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-lg',
        'animate-slide-down',
        msg.color,
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="text-xl" aria-hidden="true">{msg.emoji}</span>
      <span className="font-semibold text-sm">{msg.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── 도트 인디케이터 ─────────────────────────────────────────────────────────

function StepDots({
  total,
  current,
  completedSteps,
  onSelect,
}: {
  total: number;
  current: number;
  completedSteps: Set<number>;
  onSelect: (step: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 현재 도트로 스크롤
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeDot = container.querySelector('[data-current="true"]') as HTMLElement | null;
    if (activeDot) {
      activeDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [current]);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
      aria-label="단계 목록"
      role="tablist"
    >
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const isDone = completedSteps.has(stepNum);
        const isCurrent = stepNum === current;

        return (
          <button
            key={stepNum}
            type="button"
            role="tab"
            data-current={isCurrent}
            aria-selected={isCurrent}
            aria-label={`${stepNum}단계${isDone ? ' (완료)' : isCurrent ? ' (현재)' : ''}`}
            onClick={() => onSelect(stepNum)}
            className={[
              'flex-shrink-0 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              isCurrent
                ? 'w-6 h-6 bg-primary-500 ring-2 ring-primary-300 ring-offset-1'
                : isDone
                ? 'w-3 h-3 bg-primary-400 hover:bg-primary-500'
                : 'w-2.5 h-2.5 bg-neutral-300 hover:bg-neutral-400',
              // 숫자 표시는 현재 스텝에만
              isCurrent ? 'text-white text-[10px] font-bold flex items-center justify-center' : '',
            ].join(' ')}
          >
            {isCurrent ? stepNum : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── 진행률 영역 ─────────────────────────────────────────────────────────────

function ProgressArea({
  current,
  total,
  completedSteps,
  onDotClick,
}: {
  current: number;
  total: number;
  completedSteps: Set<number>;
  onDotClick: (step: number) => void;
}) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="mb-6">
      {/* 단계 표시 + 퍼센트 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-text-primary">
          {current} / {total} 단계
        </span>
        <span className="text-xs font-medium text-text-muted">{percent}%</span>
      </div>

      {/* 프로그레스 바 */}
      <div
        className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mb-3"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`진행률 ${percent}%`}
      >
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 클릭 가능한 도트 인디케이터 */}
      <StepDots
        total={total}
        current={current}
        completedSteps={completedSteps}
        onSelect={onDotClick}
      />
    </div>
  );
}

// ─── 스텝 헤더 (타입 뱃지 + 읽기 시간) ─────────────────────────────────────

function StepHeader({ step }: { step: LessonStep }) {
  const type = detectStepType(step);
  const meta = STEP_TYPE_META[type];
  const minutes = estimateReadingTime(step);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* 타입 뱃지 */}
      <span
        className={[
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
          meta.badge,
        ].join(' ')}
      >
        <span aria-hidden="true">{meta.icon}</span>
        {meta.label}
      </span>

      {/* 읽기 시간 */}
      <span className="text-xs text-text-muted">
        약 {minutes}분 소요
      </span>
    </div>
  );
}

// ─── 완료 카드 ───────────────────────────────────────────────────────────────

function CompletionCard() {
  return (
    <div className="mt-6 rounded-2xl border border-success-500/30 bg-success-100 p-6 text-center animate-fade-in">
      <PartyPopper className="w-10 h-10 text-success-500 mx-auto mb-3" aria-hidden="true" />
      <h3 className="text-lg font-bold text-success-700 mb-1">레슨 완료!</h3>
      <p className="text-sm text-success-600">
        이 레슨의 모든 단계를 학습했습니다. 정말 수고했어요!
      </p>
    </div>
  );
}

// ─── 키보드 힌트 ─────────────────────────────────────────────────────────────

function KeyHint() {
  return (
    <p className="mt-3 text-center text-xs text-text-muted select-none">
      <kbd className="font-mono bg-neutral-100 border border-border-light rounded px-1 py-0.5">←</kbd>
      {' '}/{' '}
      <kbd className="font-mono bg-neutral-100 border border-border-light rounded px-1 py-0.5">→</kbd>
      {' '}키로 이동
      <span className="mx-2 text-border-medium">|</span>
      <kbd className="font-mono bg-neutral-100 border border-border-light rounded px-1 py-0.5">F</kbd>
      {' '}전체보기
    </p>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface StepViewProps {
  steps: LessonStep[];
}

export function StepView({ steps }: StepViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // pathname에서 slug 추출 (/learn/lesson/[slug])
  const slug = pathname.split('/').pop() ?? 'unknown';

  const total = steps.length;

  // 이 lesson 의 전체 인라인 KC checkId 목록 (segments 에서 추출)
  const allKcIds = useMemo(() => {
    const ids: string[] = [];
    for (const step of steps) {
      for (const seg of step.segments) {
        if (seg.type === 'marker' && seg.marker.kind === 'knowledge_check') {
          if (seg.marker.checkId) ids.push(seg.marker.checkId);
        }
      }
    }
    return ids;
  }, [steps]);

  // URL에서 현재 step 읽기 (1-based, default: 1)
  const stepParam = searchParams.get('step');
  const rawStep = stepParam ? parseInt(stepParam, 10) : 1;
  const currentStep = isNaN(rawStep) || rawStep < 1 ? 1 : rawStep > total ? total : rawStep;

  // 완료된 스텝 추적
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (let i = 1; i < currentStep; i++) s.add(i);
    return s;
  });

  // localStorage에서 마지막 스텝 복원 (최초 1회, step 파라미터 없을 때만)
  const [restoredStep, setRestoredStep] = useState(false);
  useEffect(() => {
    if (restoredStep) return;
    setRestoredStep(true);
    if (!stepParam) {
      const saved = getLastStep(slug);
      if (saved && saved > 1 && saved <= total) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', String(saved));
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마지막 스텝 저장
  useEffect(() => {
    saveLastStep(slug, currentStep);
  }, [slug, currentStep]);

  // 페이드+슬라이드 애니메이션
  const [visible, setVisible] = useState(true);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      const dir = currentStep > prevStepRef.current ? 'right' : 'left';
      setSlideDir(dir);
      setVisible(false);
      const t = setTimeout(() => {
        setVisible(true);
        prevStepRef.current = currentStep;
      }, 220);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  // 격려 배너
  const [banner, setBanner] = useState<MilestoneMsg | null>(null);
  const shownMilestonesRef = useRef<Set<number>>(new Set());

  function showBannerIfMilestone(doneStep: number) {
    const percent = Math.round((doneStep / total) * 100);
    const msg = getMilestoneMessage(percent);
    if (msg) {
      // 같은 마일스톤을 중복으로 보여주지 않음
      const key = Math.round(percent / 25) * 25;
      if (!shownMilestonesRef.current.has(key)) {
        shownMilestonesRef.current.add(key);
        setBanner(msg);
      }
    }
  }

  // 완료 카드 표시 여부
  const [showCompletion, setShowCompletion] = useState(false);

  /**
   * KC 통과 콜백 — 사용자가 마지막 step 에 한 번이라도 도달한 적이 있고 (completedSteps 에 total 포함)
   * 모든 KC 가 통과된 시점에 lesson completed 처리.
   * showCompletion 을 사용하지 않는 이유: goPrev() 가 showCompletion 을 false 로 리셋해서
   * 사용자가 뒤로 가서 KC 를 푸는 경우를 놓치기 때문. completedSteps 는 reset 되지 않음.
   */
  const handleKCPass = useCallback(() => {
    if (!completedSteps.has(total)) return;
    try {
      if (areAllKCsPassed(slug, allKcIds)) {
        markLessonCompleted(slug);
        checkAndUnlockNextLessons(slug, LESSONS);
      }
    } catch {
      // localStorage 실패 무시
    }
  }, [completedSteps, total, slug, allKcIds]);

  function navigateTo(step: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(step));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const goNext = useCallback(() => {
    setCompletedSteps((prev) => {
      const next = new Set(prev).add(currentStep);
      return next;
    });
    if (currentStep < total) {
      showBannerIfMilestone(currentStep);
      navigateTo(currentStep + 1);
    } else {
      // 마지막 스텝 도달 — lesson completed 처리 시도
      showBannerIfMilestone(currentStep);
      setShowCompletion(true);
      try {
        // 모든 인라인 KC 가 통과되었거나 KC 가 없는 경우에만 completed 처리.
        // KC 가 남아있으면 readPercent=100 만 마크하고 quizPassed 는 사용자가 KC 를 더 풀 때 마크됨.
        if (areAllKCsPassed(slug, allKcIds)) {
          markLessonCompleted(slug);
          checkAndUnlockNextLessons(slug, LESSONS);
        }
      } catch {
        // localStorage 실패 무시
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, total, slug, allKcIds]);

  const goPrev = useCallback(() => {
    if (currentStep > 1) {
      setShowCompletion(false);
      navigateTo(currentStep - 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // 키보드 단축키 (← → F)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'f' || e.key === 'F') {
        // F키: 전체보기 모드 전환
        const params = new URLSearchParams(searchParams.toString());
        params.set('mode', 'full');
        params.delete('step');
        router.push(`${pathname}?${params.toString()}`);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, pathname, router, searchParams]);

  const step = steps[currentStep - 1];
  if (!step) {
    return (
      <div className="py-12 text-center text-text-muted text-sm">
        스텝을 불러올 수 없습니다.
      </div>
    );
  }

  const isLast = currentStep === total;
  const isFirst = currentStep === 1;
  const isStepDone = completedSteps.has(currentStep);

  // 다음 스텝 제목 (툴팁용)
  const nextStepTitle = !isLast ? steps[currentStep]?.title : null;

  // 콘텐츠 애니메이션 클래스
  const contentAnimClass = visible
    ? 'animate-step-in'
    : slideDir === 'right'
    ? 'animate-step-out-left'
    : 'animate-step-out-right';

  return (
    <>
      {/* CSS 키프레임 — 글로벌 없이 인라인 style 태그로 주입 */}
      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes stepOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-18px); }
        }
        @keyframes stepOutRight {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(18px); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-step-in         { animation: stepIn 0.22s ease-out both; }
        .animate-step-out-left   { animation: stepOutLeft 0.18s ease-in both; }
        .animate-step-out-right  { animation: stepOutRight 0.18s ease-in both; }
        .animate-slide-down      { animation: slideDown 0.25s ease-out both; }
        .animate-fade-in         { animation: fadeIn 0.3s ease-out both; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>

      {/* 격려 플로팅 배너 */}
      {banner && (
        <EncourageBanner msg={banner} onClose={() => setBanner(null)} />
      )}

      <div>
        {/* 진행률 영역 */}
        <ProgressArea
          current={currentStep}
          total={total}
          completedSteps={completedSteps}
          onDotClick={(s) => {
            setShowCompletion(false);
            navigateTo(s);
          }}
        />

        {/* 스텝 타입 헤더 */}
        <StepHeader step={step} />

        {/* 콘텐츠 영역 — 페이드+슬라이드 */}
        <div className={contentAnimClass}>
          <div className={STEP_PROSE_CLASS}>
            {step.segments.map((seg, i) => (
              <SegmentRenderer
                key={i}
                segment={seg}
                idx={i}
                lessonSlug={slug}
                onKCPass={handleKCPass}
              />
            ))}
          </div>
        </div>

        {/* 완료 카드 */}
        {showCompletion && isLast && <CompletionCard />}

        {/* 네비게이션 하단 바 */}
        <div className="mt-6 rounded-xl border border-border-light bg-bg-surface p-4">
          {/* 완료 배지 (현재 스텝 완료, 마지막 아닐 때) */}
          {isStepDone && !isLast && (
            <div className="mb-3 flex items-center gap-2 text-sm text-success-600 font-medium">
              <CheckCircle2 className="w-4 h-4 aria-hidden" />
              {currentStep}단계 완료!
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* 이전 버튼 */}
            <Button
              variant="secondary"
              size="md"
              onClick={goPrev}
              disabled={isFirst}
              className="flex items-center gap-1.5 min-w-0 sm:min-w-[80px]"
              aria-label="이전 단계"
            >
              <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">이전</span>
            </Button>

            {/* 스텝 점프 드롭다운 */}
            <StepJumpMenu
              steps={steps}
              current={currentStep}
              completedSteps={completedSteps}
              onSelect={(s) => {
                setShowCompletion(false);
                navigateTo(s);
              }}
            />

            {/* 다음 / 완료 버튼 */}
            {isLast ? (
              <Button
                variant="primary"
                size="md"
                onClick={goNext}
                className={[
                  'flex items-center gap-1.5 transition-all duration-300 min-w-0 sm:min-w-[120px]',
                  showCompletion
                    ? 'bg-success-500 hover:bg-success-600 border-success-500'
                    : '',
                ].join(' ')}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>레슨 완료</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={goNext}
                title={nextStepTitle ? `다음: ${nextStepTitle}` : undefined}
                className="flex items-center gap-1.5 min-w-0 sm:min-w-[80px]"
                aria-label={nextStepTitle ? `다음 단계: ${nextStepTitle}` : '다음 단계'}
              >
                <span className="hidden sm:inline">다음</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* 키보드 힌트 — 모바일에서는 숨김 */}
          <div className="hidden sm:block">
            <KeyHint />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 스텝 점프 드롭다운 ──────────────────────────────────────────────────────

function StepJumpMenu({
  steps,
  current,
  completedSteps,
  onSelect,
}: {
  steps: LessonStep[];
  current: number;
  completedSteps: Set<number>;
  onSelect: (step: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'text-xs text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          open ? 'bg-neutral-100 text-text-primary' : '',
        ].join(' ')}
        aria-label="단계 목록 열기"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {current} / {steps.length} 단계 ▾
      </button>

      {open && (
        <div
          className={[
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
            'w-64 bg-bg-surface border border-border-light rounded-xl shadow-lg',
            'overflow-hidden animate-fade-in',
          ].join(' ')}
          role="menu"
        >
          <div className="p-1 max-h-64 overflow-y-auto">
            {steps.map((step) => {
              const stepNum = step.index + 1;
              const isDone = completedSteps.has(stepNum);
              const isCurrent = stepNum === current;
              const type = detectStepType(step);
              const meta = STEP_TYPE_META[type];

              return (
                <button
                  key={stepNum}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(stepNum);
                    setOpen(false);
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg transition-colors',
                    isCurrent
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-text-secondary hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {/* 완료/현재 아이콘 */}
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-success-500" aria-hidden="true" />
                    ) : (
                      <span
                        className={[
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold',
                          isCurrent
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-border-medium text-text-muted',
                        ].join(' ')}
                      >
                        {stepNum}
                      </span>
                    )}
                  </span>

                  <span className="truncate flex-1">{step.title}</span>

                  {/* 타입 아이콘 */}
                  <span className="flex-shrink-0 text-sm" aria-hidden="true">
                    {meta.icon}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
