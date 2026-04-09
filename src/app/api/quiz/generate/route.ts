/**
 * GET /api/quiz/generate
 * Query params:
 *   - difficulty: 1|2|3 (default: 1)
 *   - type: calc-copay|calc-total|calc-drug-amount (optional)
 *   - source: template|legacy (default: legacy)
 * Returns: DynamicQuestion JSON
 *
 * 동적 계산 문제 1건 생성 후 JSON 반환
 * 서버 사이드에서 SupabaseCalcRepository + calc-engine 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { SupabaseCalcRepository } from '@/lib/calc-engine';
import { generateQuestion } from '@/lib/quiz/dynamic-generator';
import { generateFromTemplate } from '@/lib/quiz/template-generator';

export const dynamic = 'force-dynamic';

type QuizType =
  | 'calc-copay'
  | 'calc-total'
  | 'calc-drug-amount'
  | 'multi-step'
  | 'error-spot'
  | 'fill-blank';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // ── 파라미터 파싱 ────────────────────────────────────────────────────────
    const rawDifficulty = searchParams.get('difficulty') ?? '1';
    const typeParam = searchParams.get('type') ?? undefined;
    // 기본값: template (DB 시나리오 기반). legacy 는 fallback 용.
    const sourceParam = searchParams.get('source') ?? 'template';

    const difficulty = parseInt(rawDifficulty, 10);
    if (![1, 2, 3].includes(difficulty)) {
      return NextResponse.json(
        { error: 'difficulty는 1, 2, 3 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    const validTypes: QuizType[] = [
      'calc-copay',
      'calc-total',
      'calc-drug-amount',
      'multi-step',
      'error-spot',
      'fill-blank',
    ];
    if (typeParam && !validTypes.includes(typeParam as QuizType)) {
      return NextResponse.json(
        { error: `type은 ${validTypes.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const validSources = ['template', 'legacy'];
    if (!validSources.includes(sourceParam)) {
      return NextResponse.json(
        { error: `source는 ${validSources.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    // ── Supabase + Repository 초기화 ─────────────────────────────────────────
    const supabase = await createServerSupabase();
    const repo = new SupabaseCalcRepository(supabase);
    const typedDifficulty = difficulty as 1 | 2 | 3;
    const typedType = typeParam as QuizType | undefined;

    // ── 문제 생성: template 경로 (실패 시 legacy로 폴백) ────────────────────
    if (sourceParam === 'template') {
      try {
        const question = await generateFromTemplate(
          typedDifficulty,
          repo,
          supabase,
          typedType
        );
        return NextResponse.json(question);
      } catch (err) {
        // 템플릿 미시드 등으로 실패 시 legacy 경로로 폴백
        console.warn(
          '[quiz/generate] template path failed, falling back to legacy:',
          err
        );
        // fall through
      }
    }

    // ── 문제 생성: legacy 경로 (기본) ────────────────────────────────────────
    const question = await generateQuestion(
      typedDifficulty,
      repo,
      typedType,
      supabase
    );

    return NextResponse.json(question);
  } catch (err) {
    console.error('[/api/quiz/generate] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
