import fs from 'fs';
import path from 'path';

const CHAPTERS_DIR = path.join(process.cwd(), 'src', 'content', 'chapters');
const LESSONS_DIR = path.join(process.cwd(), 'src', 'content', 'lessons');

/**
 * 챕터 슬러그로 마크다운 원문을 읽어 반환한다 (서버 전용)
 */
export async function loadChapterMarkdown(slug: string): Promise<string | null> {
  const filePath = path.join(CHAPTERS_DIR, `${slug}.md`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * 챕터 파일이 실제로 존재하는지 확인
 */
export function chapterExists(slug: string): boolean {
  const filePath = path.join(CHAPTERS_DIR, `${slug}.md`);
  return fs.existsSync(filePath);
}

/**
 * 레슨 슬러그로 마크다운 원문을 읽어 반환한다 (서버 전용)
 */
export async function loadLessonMarkdown(slug: string): Promise<string | null> {
  const filePath = path.join(LESSONS_DIR, `${slug}.md`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * 레슨 파일이 실제로 존재하는지 확인
 */
export function lessonExists(slug: string): boolean {
  const filePath = path.join(LESSONS_DIR, `${slug}.md`);
  return fs.existsSync(filePath);
}
