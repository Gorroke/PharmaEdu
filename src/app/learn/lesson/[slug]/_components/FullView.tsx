/**
 * FullView.tsx
 * 기존 레슨 본문 전체를 한 번에 렌더링하는 뷰
 * page.tsx에서 추출한 "전체 보기" 모드
 */

import { InlineCalculator } from '@/components/learning/InlineCalculator';
import { KnowledgeCheck } from '@/components/learning/KnowledgeCheck';
import type { LessonSegment } from '@/lib/learning/markdown-renderer';

// prose 스타일 클래스 (page.tsx와 동일)
const PROSE_CLASS = [
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

interface FullViewProps {
  segments: LessonSegment[];
  /** 소속 lesson slug — KnowledgeCheck 진도 기록에 사용 */
  lessonSlug?: string;
}

export function FullView({ segments, lessonSlug }: FullViewProps) {
  return (
    <div className={PROSE_CLASS}>
      {segments.map((seg, i) => {
        if (seg.type === 'html') {
          return (
            <div
              key={i}
              dangerouslySetInnerHTML={{ __html: seg.content }}
            />
          );
        }

        const { marker } = seg;
        if (marker.kind === 'calculator') {
          return <InlineCalculator key={i} preset={marker.preset} />;
        }
        if (marker.kind === 'knowledge_check') {
          return <KnowledgeCheck key={i} checkId={marker.checkId} lessonSlug={lessonSlug} />;
        }
        if (marker.kind === 'course_progress') {
          return null;
        }
        return null;
      })}
    </div>
  );
}
