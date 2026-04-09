'use client';

import { useMemo, type KeyboardEvent } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

interface BlankSpec {
  id: string;
  placeholder?: string;
}
interface FillBlankPayload {
  template: string;
  blanks: BlankSpec[];
}

function isFillBlankPayload(p: unknown): p is FillBlankPayload {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  if (typeof obj.template !== 'string') return false;
  if (!Array.isArray(obj.blanks)) return false;
  return obj.blanks.every(
    (b) => b && typeof b === 'object' && typeof (b as BlankSpec).id === 'string',
  );
}

function parseValues(s: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(s || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v;
        else if (typeof v === 'number') out[k] = String(v);
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export const FillBlankRenderer: QuestionRenderer = ({
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

  if (!isFillBlankPayload(payload)) {
    return (
      <div className="p-4 rounded-lg bg-error-100 text-error-500 text-sm">
        빈칸 데이터 형식이 올바르지 않습니다.
      </div>
    );
  }

  const updateBlank = (id: string, val: string) => {
    if (isAnswered) return;
    const next = { ...values, [id]: val };
    onChange(JSON.stringify(next));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAnswered) {
      e.preventDefault();
      onSubmit();
    }
  };

  // 템플릿을 {{id}} 마커로 split → JSX 토큰 배열
  const tokens: { kind: 'text' | 'blank'; value: string }[] = [];
  const re = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(payload.template)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ kind: 'text', value: payload.template.slice(lastIdx, m.index) });
    }
    tokens.push({ kind: 'blank', value: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < payload.template.length) {
    tokens.push({ kind: 'text', value: payload.template.slice(lastIdx) });
  }

  const inputClass = (id: string) => {
    const userVal = (values[id] ?? '').trim().toLowerCase();
    const corVal = (correct[id] ?? '').trim().toLowerCase();
    if (isAnswered) {
      return userVal === corVal && userVal !== ''
        ? 'border-success-500 bg-success-100 text-success-500'
        : 'border-error-500 bg-error-100 text-error-500';
    }
    return 'border-border-medium bg-bg-surface text-text-primary focus:border-primary-500';
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="text-sm leading-loose text-text-primary flex flex-wrap items-center gap-y-2">
        {tokens.map((tok, i) => {
          if (tok.kind === 'text') {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {tok.value}
              </span>
            );
          }
          const spec = payload.blanks.find((b) => b.id === tok.value);
          return (
            <input
              key={i}
              type="text"
              value={values[tok.value] ?? ''}
              onChange={(e) => updateBlank(tok.value, e.target.value)}
              onKeyDown={handleKey}
              disabled={isAnswered}
              placeholder={spec?.placeholder ?? ''}
              aria-label={`빈칸 ${tok.value}`}
              className={[
                'mx-1 px-3 py-2 min-w-[6rem] rounded-lg border outline-none transition-all text-sm',
                'focus-visible:ring-2 focus-visible:ring-primary-500',
                inputClass(tok.value),
              ].join(' ')}
            />
          );
        })}
      </div>
      {isAnswered && (
        <div className="text-xs text-text-muted space-y-1">
          {payload.blanks.map((b) => {
            const u = (values[b.id] ?? '').trim();
            const c = (correct[b.id] ?? '').trim();
            const ok = u.toLowerCase() === c.toLowerCase() && u !== '';
            return (
              <div key={b.id} className="flex items-center gap-2">
                {ok ? (
                  <CheckCircle className="w-3.5 h-3.5 text-success-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-error-500" />
                )}
                <span className="font-mono">{b.id}</span>:{' '}
                <span className={ok ? 'text-success-500' : 'text-error-500'}>
                  {u || '(빈칸)'}
                </span>
                {!ok && <span className="text-text-muted">→ 정답: {c}</span>}
              </div>
            );
          })}
        </div>
      )}
      {isCorrect !== null && (
        <div
          className={`text-xs font-medium ${
            isCorrect ? 'text-success-500' : 'text-error-500'
          }`}
        >
          {isCorrect ? '정답입니다!' : '오답 — 빈칸을 다시 확인하세요.'}
        </div>
      )}
    </div>
  );
};
