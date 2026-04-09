import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, BookOpen, LayoutList } from 'lucide-react';
import {
  LESSONS,
  getLessonBySlug,
  getNextLesson,
  getPrevLesson,
} from '@/content/lessons/index';
import { loadLessonMarkdown } from '@/lib/content/loader';
import { parseLessonMarkdown } from '@/lib/learning/markdown-renderer';
import { splitLessonIntoSteps } from '@/lib/learning/lesson-splitter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LessonProgressIsland } from './_components/LessonProgressIsland';
import { ModeToggle } from './_components/ModeToggle';
import { FullView } from './_components/FullView';
import { StepView } from './_components/StepView';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string; step?: string }>;
}

// 트랙 → Badge variant 매핑
const TRACK_BADGE = {
  '기초': 'success' as const,
  '중급': 'info' as const,
  '심화': 'warning' as const,
};

export async function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) return { title: '레슨을 찾을 수 없습니다 — 팜에듀' };
  return {
    title: `Lesson ${lesson.number}: ${lesson.title} — 팜에듀`,
    description: lesson.subtitle,
  };
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { mode } = await searchParams;
  const lesson = getLessonBySlug(slug);

  if (!lesson) notFound();

  const markdown = await loadLessonMarkdown(slug);
  if (!markdown) notFound();

  const segments = await parseLessonMarkdown(markdown);
  const steps = splitLessonIntoSteps(segments);

  // mode: 'step' (기본값) | 'full'
  const viewMode = mode === 'full' ? 'full' : 'step';

  const prevLesson = getPrevLesson(slug);
  const nextLesson = getNextLesson(slug);

  return (
    <div className="max-w-3xl mx-auto">
      {/* 진도 추적 클라이언트 아일랜드 */}
      <LessonProgressIsland slug={slug} />

      {/* 목록으로 돌아가기 */}
      <div className="mb-4">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <LayoutList className="w-4 h-4" aria-hidden="true" />
          커리큘럼 목록
        </Link>
      </div>

      {/* 레슨 메타 헤더 */}
      <Card variant="standard" className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-mono font-bold text-text-muted tracking-wider">
            Lesson {lesson.number}
          </span>
          <Badge variant={TRACK_BADGE[lesson.track]}>{lesson.track}</Badge>
          <span className="text-text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            약 {lesson.estimatedMinutes}분
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-text-primary leading-snug">
          {lesson.title}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">{lesson.subtitle}</p>

        {/* 학습 목표 */}
        {lesson.objectives.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-light">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary-500" aria-hidden="true" />
              <span className="text-sm font-semibold text-text-primary">학습 목표</span>
            </div>
            <ul className="space-y-1">
              {lesson.objectives.map((obj, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 모드 전환 토글 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-text-muted">
          {viewMode === 'step'
            ? `총 ${steps.length}단계`
            : '전체 보기 중'}
        </span>
        <ModeToggle currentMode={viewMode} />
      </div>

      {/* 레슨 본문 — 모드별 렌더링 */}
      {viewMode === 'step' ? (
        <StepView steps={steps} />
      ) : (
        <FullView segments={segments} lessonSlug={slug} />
      )}

      {/* 이전/다음 레슨 네비게이션 */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        {prevLesson ? (
          <Link href={`/learn/lesson/${prevLesson.slug}`} className="group block">
            <Button
              variant="secondary"
              size="md"
              className="w-full h-auto py-3 px-4 flex-col items-start gap-1 text-left"
            >
              <span className="flex items-center gap-1 text-xs text-text-muted font-normal">
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                이전 레슨
              </span>
              <span className="text-sm font-semibold text-text-primary leading-snug group-hover:text-primary-600 transition-colors">
                Lesson {prevLesson.number}. {prevLesson.title}
              </span>
            </Button>
          </Link>
        ) : (
          <div />
        )}

        {nextLesson ? (
          <Link href={`/learn/lesson/${nextLesson.slug}`} className="group block ml-auto w-full">
            <Button
              variant="secondary"
              size="md"
              className="w-full h-auto py-3 px-4 flex-col items-end gap-1 text-right"
            >
              <span className="flex items-center gap-1 text-xs text-text-muted font-normal">
                다음 레슨
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-text-primary leading-snug group-hover:text-primary-600 transition-colors">
                Lesson {nextLesson.number}. {nextLesson.title}
              </span>
            </Button>
          </Link>
        ) : (
          <div className="flex flex-col items-end gap-1 bg-success-100 rounded-xl border border-success-500/20 p-4 text-right ml-auto w-full">
            <span className="text-xs text-success-500">마지막 레슨</span>
            <span className="text-sm font-semibold text-success-500">전체 커리큘럼 완료!</span>
          </div>
        )}
      </div>

      {/* 원본 명세서 참조 링크 */}
      <div className="mt-6 p-4 bg-info-100 rounded-xl border border-info-100 text-sm text-text-primary">
        <strong className="text-info-500">원본 명세서:</strong>{' '}
        <Link
          href="/learn"
          className="text-primary-600 hover:text-primary-700 underline underline-offset-2 ml-1"
        >
          챕터 목록에서 기술 명세 원문 보기 →
        </Link>
      </div>
    </div>
  );
}
