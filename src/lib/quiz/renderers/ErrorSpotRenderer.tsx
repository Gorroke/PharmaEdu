'use client';

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

interface RawStep {
  id?: string;
  label: string;
  value?: string;
}
interface NormalizedStep {
  id: string;
  label: string;
  value?: string;
}
interface ErrorSpotPayload {
  steps: RawStep[];
}

/** id 필드 없는 옛 시드도 받아내기 위해 label만 검증 */
function isErrorSpotPayload(p: unknown): p is ErrorSpotPayload {
  if (!p || typeof p !== 'object') return false;
  const steps = (p as { steps?: unknown }).steps;
  return (
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as RawStep).label === 'string',
    )
  );
}

/** 시드의 id 누락 시 step{N+1} 자동 부여 */
function normalizeSteps(payload: ErrorSpotPayload): NormalizedStep[] {
  return payload.steps.map((s, i) => ({
    id: typeof s.id === 'string' && s.id.length > 0 ? s.id : `step${i + 1}`,
    label: s.label,
    value: s.value,
  }));
}

/**
 * correct_answer 가 step.id, 0-based 인덱스 ('0','1','2','3'), 또는 1-based 인덱스 어느 형식이든
 * 하나의 step.id 로 정규화. id 매칭이 우선, 다음 0-based, 마지막 1-based.
 */
function resolveCorrectId(raw: string, steps: NormalizedStep[]): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  // 1) step id 매칭
  if (steps.some((s) => s.id === trimmed)) return trimmed;
  // 2) 숫자면 인덱스 시도
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    // 0-based 우선
    if (n >= 0 && n < steps.length) return steps[n].id;
    // 1-based fallback
    if (n >= 1 && n <= steps.length) return steps[n - 1].id;
  }
  return trimmed;
}

export const ErrorSpotRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  isCorrect,
  onChange,
}) => {
  const payload = question.payload;

  if (!isErrorSpotPayload(payload)) {
    return (
      <div className="p-4 rounded-lg bg-error-100 text-error-500 text-sm">
        오류 찾기 데이터 형식이 올바르지 않습니다.
      </div>
    );
  }

  const steps = normalizeSteps(payload);
  const correctId = resolveCorrectId(question.correct_answer, steps);

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-text-muted">
        다음 계산 단계 중 오류가 있는 단계를 클릭하세요.
      </p>
      <ol className="space-y-2">
        {steps.map((step, idx) => {
          const isSelected = userAnswer === step.id;
          const isCorrectStep = isAnswered && step.id === correctId;
          const isWrongSelected = isAnswered && isSelected && !isCorrectStep;

          return (
            <li key={step.id}>
              <button
                onClick={() => {
                  if (isAnswered) return;
                  onChange(step.id);
                }}
                disabled={isAnswered}
                aria-pressed={isSelected}
                className={[
                  'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-start gap-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isCorrectStep
                    ? 'bg-success-100 border-success-500 text-success-500'
                    : isWrongSelected
                    ? 'bg-error-100 border-error-500 text-error-500'
                    : isSelected
                    ? 'bg-primary-50 border-primary-500 text-primary-600 ring-2 ring-error-500'
                    : 'bg-bg-surface border-border-light text-text-primary hover:bg-neutral-50',
                  isAnswered ? 'cursor-default' : 'cursor-pointer',
                ].join(' ')}
              >
                <span className="font-mono text-text-muted select-none">
                  Step {idx + 1}.
                </span>
                <span className="flex-1 whitespace-pre-wrap">{step.label}</span>
                {isCorrectStep && <CheckCircle className="w-4 h-4 text-success-500" />}
                {isWrongSelected && <XCircle className="w-4 h-4 text-error-500" />}
                {!isAnswered && isSelected && (
                  <AlertCircle className="w-4 h-4 text-error-500" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {isCorrect !== null && (
        <div
          className={`text-xs font-medium ${
            isCorrect ? 'text-success-500' : 'text-error-500'
          }`}
        >
          {isCorrect ? '정답입니다!' : '오답 — 다른 단계를 확인하세요.'}
        </div>
      )}
    </div>
  );
};
