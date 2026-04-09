import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutList, Clock } from 'lucide-react';
import {
  CHAPTERS,
  getChapterBySlug,
  getPrevChapter,
  getNextChapter,
} from '@/content/chapters/index';
import type { Difficulty } from '@/content/chapters/index';
import { loadChapterMarkdown } from '@/lib/content/loader';
import { markdownToHtml } from '@/lib/content/parser';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChapterVisitMarker } from '../_components/ProgressTracker';
import { ChapterQuizLinkServer } from '@/components/learn/ChapterQuizLinkServer';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Difficulty -> Badge variant 매핑 */
const DIFFICULTY_BADGE: Record<Difficulty, 'success' | 'info' | 'warning' | 'error'> = {
  '입문': 'success',
  '기초': 'info',
  '중급': 'warning',
  '심화': 'error',
};

export async function generateStaticParams() {
  return CHAPTERS.map((ch) => ({ slug: ch.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const chapter = getChapterBySlug(slug);
  if (!chapter) return { title: '챕터를 찾을 수 없습니다 — 팜에듀' };
  return {
    title: `${chapter.number} ${chapter.title} — 팜에듀`,
    description: chapter.description,
  };
}

export default async function ChapterPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  // Next.js 16 (Turbopack)에서 동적 라우트 파라미터의 한글이 URL 디코딩되지 않는 경우가 있어 명시적으로 처리
  const slug = decodeURIComponent(rawSlug);
  const chapter = getChapterBySlug(slug);

  if (!chapter) notFound();

  const markdown = await loadChapterMarkdown(slug);
  if (!markdown) notFound();

  const htmlContent = await markdownToHtml(markdown);
  const prevChapter = getPrevChapter(chapter.order);
  const nextChapter = getNextChapter(chapter.order);

  // slug 앞부분(ch00, ch01 …)을 대문자 챕터 번호(CH00, CH01 …)로 변환
  // 예) 'ch01-약품금액' → split('-')[0] → 'ch01' → toUpperCase() → 'CH01'
  const chapterNumber = slug.split('-')[0].toUpperCase();

  return (
    <div className="max-w-3xl mx-auto">
      {/* 방문 기록 클라이언트 마커 */}
      <ChapterVisitMarker slug={slug} />

      {/* 목록으로 돌아가기 링크 */}
      <div className="mb-4">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <LayoutList className="w-4 h-4" aria-hidden="true" />
          목록으로
        </Link>
      </div>

      {/* 챕터 메타 헤더 */}
      <Card variant="standard" className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-mono font-bold text-text-muted tracking-wider">
            {chapter.number}
          </span>
          <Badge variant={DIFFICULTY_BADGE[chapter.difficulty]}>
            {chapter.difficulty}
          </Badge>
          <span className="text-text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            예상 학습 시간: {chapter.estimatedMinutes}분
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-text-primary leading-snug">
          {chapter.title}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">{chapter.description}</p>
      </Card>

      {/* 마크다운 콘텐츠 */}
      <div
        className={[
          'bg-bg-surface rounded-xl border border-border-light p-6 lg:p-8',
          // 마크다운 prose 스타일링 — 디자인 시스템 토큰 사용
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
        ].join(' ')}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* 챕터 퀴즈 연결 */}
      <ChapterQuizLinkServer chapterNumber={chapterNumber} />

      {/* 이전/다음 챕터 네비게이션 */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        {prevChapter ? (
          <Link href={`/learn/${prevChapter.slug}`} className="group block">
            <Button
              variant="secondary"
              size="md"
              className="w-full h-auto py-3 px-4 flex-col items-start gap-1 text-left"
            >
              <span className="flex items-center gap-1 text-xs text-text-muted font-normal">
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                이전 챕터
              </span>
              <span className="text-sm font-semibold text-text-primary leading-snug group-hover:text-primary-600 transition-colors">
                {prevChapter.number} {prevChapter.title}
              </span>
            </Button>
          </Link>
        ) : (
          <div />
        )}

        {nextChapter ? (
          <Link href={`/learn/${nextChapter.slug}`} className="group block ml-auto w-full">
            <Button
              variant="secondary"
              size="md"
              className="w-full h-auto py-3 px-4 flex-col items-end gap-1 text-right"
            >
              <span className="flex items-center gap-1 text-xs text-text-muted font-normal">
                다음 챕터
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-text-primary leading-snug group-hover:text-primary-600 transition-colors">
                {nextChapter.number} {nextChapter.title}
              </span>
            </Button>
          </Link>
        ) : (
          <div className="flex flex-col items-end gap-1 bg-success-100 rounded-xl border border-success-500/20 p-4 text-right">
            <span className="text-xs text-success-500">마지막 챕터</span>
            <span className="text-sm font-semibold text-success-500">학습 완료!</span>
          </div>
        )}
      </div>
    </div>
  );
}
