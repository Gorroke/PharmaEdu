// ─────────────────────────────────────────────
// PharmaEdu Phase 8 — Lesson Splitter
// LessonSegment 배열을 H2 헤딩 기준으로 단계별 스텝으로 분할한다
// ─────────────────────────────────────────────

import type { LessonSegment } from './markdown-renderer';

export interface LessonStep {
  /** 0-based 인덱스 */
  index: number;
  /** H2 헤딩 텍스트 또는 인트로의 경우 "시작" */
  title: string;
  segments: LessonSegment[];
  hasInteractive: boolean;
}

/**
 * HTML 세그먼트에서 첫 번째 H2 헤딩 텍스트를 추출한다.
 * "<h2>..." 패턴을 찾아 태그를 제거하고 순수 텍스트만 반환.
 */
function extractH2Title(html: string): string | null {
  const match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!match) return null;
  // HTML 태그 제거
  return match[1].replace(/<[^>]+>/g, '').trim();
}

/**
 * HTML 세그먼트가 H2 헤딩으로 시작하는지 확인한다.
 */
function startsWithH2(html: string): boolean {
  return /^\s*<h2/i.test(html.trim());
}

/**
 * 세그먼트 배열에 인터랙티브 요소(calculator, knowledge_check)가 있는지 확인한다.
 */
function checkHasInteractive(segments: LessonSegment[]): boolean {
  return segments.some(
    (seg) =>
      seg.type === 'marker' &&
      (seg.marker.kind === 'calculator' || seg.marker.kind === 'knowledge_check')
  );
}

/**
 * LessonSegment 배열을 H2 헤딩 기준으로 LessonStep 배열로 분할한다.
 *
 * 규칙:
 * - 첫 H2 이전의 내용 → "시작" 스텝
 * - 각 H2 + 그 이후 내용 (다음 H2 전까지) → 개별 스텝
 * - course_progress 마커는 그 스텝에 포함되지만 무시됨
 *
 * HTML 세그먼트가 H2를 포함할 때, 해당 세그먼트가 H2로 시작하면 새 스텝으로 분리.
 * H2가 중간에 있으면 앞부분과 뒷부분으로 나눔.
 */
export function splitLessonIntoSteps(segments: LessonSegment[]): LessonStep[] {
  const steps: LessonStep[] = [];
  let currentSegments: LessonSegment[] = [];
  let currentTitle = '시작';

  function flushStep() {
    if (currentSegments.length === 0) return;
    steps.push({
      index: steps.length,
      title: currentTitle,
      segments: currentSegments,
      hasInteractive: checkHasInteractive(currentSegments),
    });
    currentSegments = [];
  }

  for (const seg of segments) {
    if (seg.type === 'marker') {
      // 마커는 현재 스텝에 그냥 추가
      currentSegments.push(seg);
      continue;
    }

    // HTML 세그먼트 처리
    const html = seg.content;

    // H2가 전혀 없으면 현재 스텝에 추가
    if (!/<h2/i.test(html)) {
      currentSegments.push(seg);
      continue;
    }

    // H2가 있는 경우: H2 위치를 기준으로 분할
    // 정규식으로 모든 H2 위치를 찾아 분할
    const h2Regex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
    let lastSplitIndex = 0;
    let h2Match: RegExpExecArray | null;

    // H2 이전 내용이 있으면 현재 스텝에 추가
    // H2부터 새 스텝 시작
    const chunks: Array<{ html: string; isH2Start: boolean; title?: string }> = [];

    h2Regex.lastIndex = 0;
    while ((h2Match = h2Regex.exec(html)) !== null) {
      const before = html.slice(lastSplitIndex, h2Match.index);
      if (before.trim()) {
        chunks.push({ html: before, isH2Start: false });
      }
      // H2부터 새 청크 시작 (이후 내용은 다음 H2 전까지)
      chunks.push({ html: h2Match[0], isH2Start: true, title: extractH2Title(h2Match[0]) ?? '단계' });
      lastSplitIndex = h2Match.index + h2Match[0].length;
    }

    // 마지막 H2 이후 남은 내용
    const trailing = html.slice(lastSplitIndex);

    // chunks를 병합해서 스텝 구성
    // 각 isH2Start=true인 청크가 새 스텝의 시작점
    let pendingHtml = '';
    for (const chunk of chunks) {
      if (chunk.isH2Start) {
        // 이전 pendingHtml이 있으면 현재 스텝에 추가
        if (pendingHtml.trim()) {
          currentSegments.push({ type: 'html', content: pendingHtml });
          pendingHtml = '';
        }
        // 현재 스텝 flush → 새 스텝 시작
        flushStep();
        currentTitle = chunk.title ?? '단계';
        pendingHtml = chunk.html;
      } else {
        pendingHtml += chunk.html;
      }
    }

    // trailing 내용을 pendingHtml에 추가
    pendingHtml += trailing;

    if (pendingHtml.trim()) {
      currentSegments.push({ type: 'html', content: pendingHtml });
    }
  }

  // 마지막 스텝 flush
  flushStep();

  // 인덱스 재정렬 (안전을 위해)
  return steps.map((step, i) => ({ ...step, index: i }));
}
