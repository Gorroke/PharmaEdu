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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LessonProgressIsland } from './_components/LessonProgressIsland';
import { InlineCalculator } from '@/components/learning/InlineCalculator';
import { KnowledgeCheck } from '@/components/learning/KnowledgeCheck';

interface PageProps {
  params: Promise<{ slug: string }>;
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

export default async function LessonPage({ params }: PageProps) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);

  if (!lesson) notFound();

  const markdown = await loadLessonMarkdown(slug);
  if (!markdown) notFound();

  const segments = await parseLessonMarkdown(markdown);

  const prevLesson = getPrevLesson(slug);
  const nextLesson = getNextLesson(slug);

  // prose 스타일 클래스 (기존 챕터 뷰어와 동일 스타일 재사용)
  const proseClass = [
    'bg-bg-surface rounded-xl border border-border-light p-6 lg:p-8',
    '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-text-primary',
    '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-text-primary [&_h2]:border-b [&_h2]:border-border-light [&_h2]:pb-2',
    '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-text-primary',
    '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-text-secondary',
    '[&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-text-secondary',
    '[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1',
    '[&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1',
    '[&_li]:text-text-secondary [&_li]:leading-relaxed',
    '[&_blockquote]:border-l-4 [&_blockquote]:border-primary-300 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:text-text-muted [&_blockquote]:italic',
    '[&_code]:bg-neutral-100 [&_code]:text-error-500 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
    '[&_pre]:bg-neutral-700 [&_pre]:text-neutral-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-sm',
    '[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:rounded-none',
    '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm',
    '[&_th]:border [&_th]:border-border-medium [&_th]:p-2.5 [&_th]:bg-bg-panel [&_th]:font-semibold [&_th]:text-left [&_th]:text-text-secondary',
    '[&_td]:border [&_td]:border-border-medium [&_td]:p-2.5 [&_td]:text-text-secondary',
    '[&_tr:hover_td]:bg-primary-50',
    '[&_a]:text-primary-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary-700',
    '[&_hr]:border-border-light [&_hr]:my-6',
    '[&_strong]:font-semibold [&_strong]:text-text-primary',
    '[&_details]:my-4 [&_details]:border [&_details]:border-border-light [&_details]:rounded-lg [&_details]:p-4',
    '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-text-primary',
  ].join(' ');

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

      {/* 레슨 본문 — 세그먼트별 렌더링 */}
      <div className={proseClass}>
        {segments.map((seg, i) => {
          if (seg.type === 'html') {
            return (
              <div
                key={i}
                dangerouslySetInnerHTML={{ __html: seg.content }}
              />
            );
          }

          // 마커 처리
          const { marker } = seg;
          if (marker.kind === 'calculator') {
            return (
              <InlineCalculator key={i} preset={marker.preset} />
            );
          }

          if (marker.kind === 'knowledge_check') {
            return (
              <KnowledgeCheck key={i} checkId={marker.checkId} />
            );
          }

          if (marker.kind === 'course_progress') {
            // COURSE_PROGRESS는 LessonProgressIsland가 처리하므로 여기선 시각적으로 미표시
            return null;
          }

          return null;
        })}
      </div>

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
