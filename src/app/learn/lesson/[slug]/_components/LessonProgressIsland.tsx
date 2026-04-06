'use client';

import { useEffect } from 'react';
import { markLessonVisited } from '@/lib/learning/progress';

interface LessonProgressIslandProps {
  slug: string;
}

/**
 * 레슨 페이지에 마운트하면 자동으로 해당 레슨을 'in-progress' 상태로 기록한다.
 * localStorage 기반이므로 클라이언트 전용.
 */
export function LessonProgressIsland({ slug }: LessonProgressIslandProps) {
  useEffect(() => {
    markLessonVisited(slug);
  }, [slug]);

  return null;
}
