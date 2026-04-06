// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — Lesson Markdown Renderer
// 인터랙티브 마커를 처리하는 서버/클라이언트 공용 유틸리티
// ─────────────────────────────────────────────

import { marked } from 'marked';

// marked 옵션 (GFM 활성화)
marked.setOptions({
  gfm: true,
  breaks: false,
});

// ─────────────────────────────────────────────
// 마커 타입 정의
// ─────────────────────────────────────────────

export type MarkerType =
  | { kind: 'calculator'; preset: string }
  | { kind: 'knowledge_check'; checkId: string }
  | { kind: 'course_progress'; step: number };

export type LessonSegment =
  | { type: 'html'; content: string }
  | { type: 'marker'; marker: MarkerType };

// ─────────────────────────────────────────────
// 마커 정규식
// ─────────────────────────────────────────────

const MARKER_REGEX =
  /<!--\s*(INLINE_CALCULATOR|KNOWLEDGE_CHECK|COURSE_PROGRESS):([^>]+?)-->/g;

/**
 * 마커 속성 문자열을 key=value 맵으로 파싱한다.
 * 예: "preset=simple-basic" → { preset: "simple-basic" }
 */
function parseAttrs(attrStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = attrStr.trim().split(/\s+/);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

/**
 * 마커 문자열을 MarkerType 객체로 파싱한다.
 */
function parseMarker(kind: string, attrStr: string): MarkerType | null {
  const attrs = parseAttrs(attrStr);
  switch (kind) {
    case 'INLINE_CALCULATOR':
      return { kind: 'calculator', preset: attrs['preset'] ?? '' };
    case 'KNOWLEDGE_CHECK':
      return { kind: 'knowledge_check', checkId: attrs['id'] ?? '' };
    case 'COURSE_PROGRESS': {
      const step = parseInt(attrs['step'] ?? '0', 10);
      return { kind: 'course_progress', step: isNaN(step) ? 0 : step };
    }
    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// 메인: 마크다운 → LessonSegment 배열
// ─────────────────────────────────────────────

/**
 * 레슨 마크다운을 파싱해 HTML 청크와 인터랙티브 마커를 교대로 담은
 * LessonSegment 배열을 반환한다 (서버 전용 함수).
 *
 * 사용 예:
 *   const segments = await parseLessonMarkdown(rawMarkdown);
 *   // → [{ type: 'html', content: '<p>...' }, { type: 'marker', marker: { kind: 'calculator', preset: 'simple-basic' } }, ...]
 */
export async function parseLessonMarkdown(
  markdown: string,
): Promise<LessonSegment[]> {
  const segments: LessonSegment[] = [];

  let lastIndex = 0;
  MARKER_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKER_REGEX.exec(markdown)) !== null) {
    const [fullMatch, kind, attrStr] = match;
    const matchStart = match.index;

    // 마커 이전 마크다운 → HTML 변환
    if (matchStart > lastIndex) {
      const mdChunk = markdown.slice(lastIndex, matchStart);
      const html = await marked.parse(mdChunk);
      if (html.trim()) {
        segments.push({ type: 'html', content: html });
      }
    }

    // 마커 처리
    const marker = parseMarker(kind, attrStr);
    if (marker) {
      segments.push({ type: 'marker', marker });
    }

    lastIndex = matchStart + fullMatch.length;
  }

  // 남은 마크다운 처리
  if (lastIndex < markdown.length) {
    const remaining = markdown.slice(lastIndex);
    const html = await marked.parse(remaining);
    if (html.trim()) {
      segments.push({ type: 'html', content: html });
    }
  }

  return segments;
}

// ─────────────────────────────────────────────
// 단순 HTML 변환 (마커 제거 버전 — fallback용)
// ─────────────────────────────────────────────

/**
 * 마커를 모두 제거하고 순수 HTML만 반환한다.
 * 인터랙티브 기능 없이 정적으로 렌더링할 때 사용.
 */
export async function lessonMarkdownToHtml(markdown: string): Promise<string> {
  const stripped = markdown.replace(MARKER_REGEX, '');
  return marked.parse(stripped) as Promise<string>;
}
