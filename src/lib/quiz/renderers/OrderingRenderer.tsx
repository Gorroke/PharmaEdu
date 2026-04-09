'use client';

import { useMemo } from 'react';
import { ArrowUp, ArrowDown, CheckCircle, XCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

interface OrderItem {
  id: string;
  label: string;
}
interface OrderingPayload {
  items: OrderItem[];
}

function isOrderingPayload(p: unknown): p is OrderingPayload {
  if (!p || typeof p !== 'object') return false;
  const items = (p as { items?: unknown }).items;
  return (
    Array.isArray(items) &&
    items.every(
      (i) =>
        i &&
        typeof i === 'object' &&
        typeof (i as OrderItem).id === 'string' &&
        typeof (i as OrderItem).label === 'string',
    )
  );
}

export const OrderingRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  isCorrect,
  onChange,
}) => {
  const payload = question.payload;

  const order = useMemo(() => {
    if (!isOrderingPayload(payload)) return [] as string[];
    if (userAnswer.trim()) {
      const ids = userAnswer.split(',').map((s) => s.trim()).filter(Boolean);
      // 기본 무결성 — payload에 존재하는 id만, 누락분은 뒤에 추가
      const valid = ids.filter((id) => payload.items.some((it) => it.id === id));
      const missing = payload.items
        .map((it) => it.id)
        .filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
    return payload.items.map((it) => it.id);
  }, [userAnswer, payload]);

  if (!isOrderingPayload(payload)) {
    return (
      <div className="p-4 rounded-lg bg-error-100 text-error-500 text-sm">
        순서 데이터 형식이 올바르지 않습니다.
      </div>
    );
  }

  const labelMap = new Map(payload.items.map((it) => [it.id, it.label]));
  const correctOrder = question.correct_answer
    .split(',')
    .map((s) => s.trim());

  const move = (idx: number, dir: -1 | 1) => {
    if (isAnswered) return;
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.join(','));
  };

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-text-muted">
        화살표 버튼으로 항목 순서를 정렬해주세요.
      </p>
      <ol className="space-y-2">
        {order.map((id, idx) => {
          const isWrongPos =
            isAnswered && correctOrder[idx] !== undefined && correctOrder[idx] !== id;
          const isRightPos = isAnswered && correctOrder[idx] === id;
          return (
            <li
              key={id}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all',
                isRightPos
                  ? 'bg-success-100 border-success-500 text-success-500'
                  : isWrongPos
                  ? 'bg-error-100 border-error-500 text-error-500'
                  : 'bg-bg-surface border-border-light text-text-primary',
              ].join(' ')}
            >
              <span className="font-mono text-text-muted w-6 select-none">
                {idx + 1}.
              </span>
              <span className="flex-1">{labelMap.get(id) ?? id}</span>
              {isAnswered ? (
                isRightPos ? (
                  <CheckCircle className="w-4 h-4 text-success-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-error-500" />
                )
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label="위로"
                    className="p-2 rounded-lg border border-border-light hover:bg-neutral-50 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === order.length - 1}
                    aria-label="아래로"
                    className="p-2 rounded-lg border border-border-light hover:bg-neutral-50 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              )}
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
          {isCorrect ? '정답입니다!' : '오답 — 정렬 순서를 확인하세요.'}
        </div>
      )}
    </div>
  );
};
