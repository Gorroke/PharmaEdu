'use client';

import { useMemo, type KeyboardEvent } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

interface MultiStep {
  id: string;
  label: string;
  unit?: string;
}
interface MultiStepPayload {
  steps: MultiStep[];
}

function isMultiStepPayload(p: unknown): p is MultiStepPayload {
  if (!p || typeof p !== 'object') return false;
  const steps = (p as { steps?: unknown }).steps;
  return (
    Array.isArray(steps) &&
    steps.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as MultiStep).id === 'string' &&
        typeof (s as MultiStep).label === 'string',
    )
  );
}

function parseValues(s: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(s || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
        else if (typeof v === 'string' && v.trim() !== '') {
          const n = Number(v);
          if (Number.isFinite(n)) out[k] = n;
        }
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

const TOLERANCE = 1;

export const MultiStepRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  isCorrect,
  onChange,
  onSubmit,
}) => {
  const payload = question.payload;

  const values = useMemo(() => parseValues(userAnswer), [userAnswer]);
  const correct = useMemo(
    () => parseValues(question.correct_answer),
    [question.correct_answer],
  );

  if (!isMultiStepPayload(payload)) {
    return (
      <div className="p-4 rounded-lg bg-error-100 text-error-500 text-sm">
        다단계 데이터 형식이 올바르지 않습니다.
      </div>
    );
  }

  const updateStep = (id: string, raw: string) => {
    if (isAnswered) return;
    const next = { ...values };
    if (raw.trim() === '') delete next[id];
    else {
      const n = Number(raw);
      if (Number.isFinite(n)) next[id] = n;
    }
    onChange(JSON.stringify(next));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAnswered) {
      e.preventDefault();
      onSubmit();
    }
  };

  const stepClass = (id: string) => {
    if (!isAnswered) return 'border-border-medium bg-bg-surface text-text-primary focus:border-primary-500';
    const u = values[id];
    const c = correct[id];
    if (u === undefined || c === undefined) return 'border-error-500 bg-error-100 text-error-500';
    return Math.abs(u - c) <= TOLERANCE
      ? 'border-success-500 bg-success-100 text-success-500'
      : 'border-error-500 bg-error-100 text-error-500';
  };

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-text-muted">
        각 단계의 값을 차례대로 입력하세요. (오차 ±{TOLERANCE} 허용)
      </p>
      <div className="space-y-2.5">
        {payload.steps.map((step, idx) => {
          const u = values[step.id];
          const c = correct[step.id];
          const ok = isAnswered && u !== undefined && c !== undefined && Math.abs(u - c) <= TOLERANCE;
          return (
            <div
              key={step.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
            >
              <label
                htmlFor={`step-${step.id}`}
                className="sm:w-40 text-sm text-text-primary flex items-center gap-2"
              >
                <span className="font-mono text-text-muted text-xs">
                  {idx + 1}.
                </span>
                {step.label}
              </label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  id={`step-${step.id}`}
                  type="number"
                  inputMode="numeric"
                  value={values[step.id] ?? ''}
                  onChange={(e) => updateStep(step.id, e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isAnswered}
                  className={[
                    'flex-1 min-w-0 px-3 py-2.5 rounded-lg border outline-none text-sm transition-all',
                    'focus-visible:ring-2 focus-visible:ring-primary-500',
                    stepClass(step.id),
                  ].join(' ')}
                />
                {step.unit && (
                  <span className="text-sm text-text-muted select-none">
                    {step.unit}
                  </span>
                )}
                {isAnswered && (
                  ok ? (
                    <CheckCircle className="w-4 h-4 text-success-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-error-500" />
                  )
                )}
              </div>
              {isAnswered && !ok && c !== undefined && (
                <span className="text-xs text-text-muted sm:ml-2">
                  정답: {c}
                  {step.unit ?? ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {isCorrect !== null && (
        <div
          className={`text-xs font-medium ${
            isCorrect ? 'text-success-500' : 'text-error-500'
          }`}
        >
          {isCorrect ? '정답입니다!' : '오답 — 단계별 값을 확인하세요.'}
        </div>
      )}
    </div>
  );
};
