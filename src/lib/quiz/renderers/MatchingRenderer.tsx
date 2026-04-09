'use client';

import { useState, useMemo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

interface MatchItem {
  id: string;
  label: string;
}
interface MatchingPayload {
  left: MatchItem[];
  right: MatchItem[];
}

function isMatchingPayload(p: unknown): p is MatchingPayload {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  if (!Array.isArray(obj.left) || !Array.isArray(obj.right)) return false;
  return obj.left.every(
    (i) =>
      i &&
      typeof i === 'object' &&
      typeof (i as MatchItem).id === 'string' &&
      typeof (i as MatchItem).label === 'string',
  );
}

function parseMapping(s: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(s || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

// 페어 색상 팔레트 — 짝지어진 항목 시각화용
const PAIR_COLORS = [
  'bg-primary-50 border-primary-500 text-primary-600',
  'bg-success-100 border-success-500 text-success-500',
  'bg-warning-100 border-warning-500 text-warning-500',
  'bg-secondary-50 border-secondary-500 text-secondary-600',
  'bg-error-100 border-error-500 text-error-500',
  'bg-neutral-100 border-neutral-500 text-neutral-700',
];

export const MatchingRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  isCorrect,
  onChange,
}) => {
  const payload = question.payload;
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  const mapping = useMemo(() => parseMapping(userAnswer), [userAnswer]);
  const correctMap = useMemo(
    () => parseMapping(question.correct_answer),
    [question.correct_answer],
  );

  if (!isMatchingPayload(payload)) {
    return (
      <div className="p-4 rounded-lg bg-error-100 text-error-500 text-sm">
        매칭 데이터 형식이 올바르지 않습니다.
      </div>
    );
  }

  // leftId → 색상 인덱스 (짝지어진 순서대로)
  const leftColorIdx: Record<string, number> = {};
  payload.left.forEach((l, i) => {
    if (mapping[l.id]) leftColorIdx[l.id] = i % PAIR_COLORS.length;
  });
  const rightColorIdx: Record<string, number> = {};
  for (const [lId, rId] of Object.entries(mapping)) {
    if (leftColorIdx[lId] !== undefined) rightColorIdx[rId] = leftColorIdx[lId];
  }

  const handleLeftClick = (id: string) => {
    if (isAnswered) return;
    setActiveLeft((prev) => (prev === id ? null : id));
  };

  const handleRightClick = (rId: string) => {
    if (isAnswered) return;
    if (!activeLeft) {
      // 우측 → 좌측 매핑 해제
      const next = { ...mapping };
      for (const [k, v] of Object.entries(next)) {
        if (v === rId) delete next[k];
      }
      onChange(JSON.stringify(next));
      return;
    }
    const next = { ...mapping };
    // 같은 우측이 다른 좌측과 짝이라면 제거
    for (const [k, v] of Object.entries(next)) {
      if (v === rId) delete next[k];
    }
    next[activeLeft] = rId;
    onChange(JSON.stringify(next));
    setActiveLeft(null);
  };

  const leftClass = (id: string) => {
    const paired = mapping[id];
    if (isAnswered && paired) {
      const ok = correctMap[id] === paired;
      return ok
        ? 'bg-success-100 border-success-500 text-success-500'
        : 'bg-error-100 border-error-500 text-error-500';
    }
    if (paired !== undefined) {
      return PAIR_COLORS[leftColorIdx[id] ?? 0];
    }
    if (activeLeft === id) {
      return 'bg-primary-100 border-primary-500 text-primary-600 ring-2 ring-primary-500';
    }
    return 'bg-bg-surface border-border-light text-text-primary hover:bg-neutral-50';
  };

  const rightClass = (id: string) => {
    const paired = id in rightColorIdx;
    if (isAnswered && paired) {
      // 어떤 left가 이 right로 갔는지
      const lId = Object.entries(mapping).find(([, v]) => v === id)?.[0];
      const ok = lId && correctMap[lId] === id;
      return ok
        ? 'bg-success-100 border-success-500 text-success-500'
        : 'bg-error-100 border-error-500 text-error-500';
    }
    if (paired) return PAIR_COLORS[rightColorIdx[id] ?? 0];
    return 'bg-bg-surface border-border-light text-text-primary hover:bg-neutral-50';
  };

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-text-muted">
        왼쪽 항목을 클릭한 뒤 오른쪽 항목을 클릭해 짝을 지어주세요.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          {payload.left.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeftClick(l.id)}
              disabled={isAnswered}
              className={[
                'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                isAnswered ? 'cursor-default' : 'cursor-pointer',
                leftClass(l.id),
              ].join(' ')}
            >
              {l.label}
              {mapping[l.id] && (
                <span className="ml-2 text-xs opacity-70">
                  → {payload.right.find((r) => r.id === mapping[l.id])?.label}
                </span>
              )}
              {isAnswered && mapping[l.id] && (
                correctMap[l.id] === mapping[l.id] ? (
                  <CheckCircle className="inline w-4 h-4 ml-2 text-success-500" />
                ) : (
                  <XCircle className="inline w-4 h-4 ml-2 text-error-500" />
                )
              )}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {payload.right.map((r) => (
            <button
              key={r.id}
              onClick={() => handleRightClick(r.id)}
              disabled={isAnswered}
              className={[
                'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                isAnswered ? 'cursor-default' : 'cursor-pointer',
                rightClass(r.id),
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {isCorrect !== null && (
        <div
          className={`text-xs font-medium ${
            isCorrect ? 'text-success-500' : 'text-error-500'
          }`}
        >
          {isCorrect ? '정답입니다!' : '오답 — 정답 매핑을 확인하세요.'}
        </div>
      )}
    </div>
  );
};
