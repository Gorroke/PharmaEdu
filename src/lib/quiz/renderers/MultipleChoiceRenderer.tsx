'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import type { QuestionRenderer } from './types';

/**
 * multiple_choice + true_false 공용 렌더러.
 * 선택지 버튼 그리드만 렌더 — 계산기 토글, 힌트, 해설 카드는 QuizPlayer (셸) 책임.
 *
 * 키보드 1~4 입력은 상위 QuizPlayer의 useEffect가 onChange 를 호출하지 않고
 * 직접 setUserAnswer 하므로, 렌더러는 onChange만 노출하면 충분.
 */
export const MultipleChoiceRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  onChange,
}) => {
  if (!question.choices) return null;

  return (
    <div className="space-y-2.5 pt-1" role="radiogroup" aria-label="선택지">
      {question.choices.map((choice, idx) => {
        const isSelected = userAnswer === String(idx);
        const isCorrectChoice =
          isAnswered && String(idx) === question.correct_answer;
        const isWrongSelected = isAnswered && isSelected && !isCorrectChoice;

        return (
          <button
            key={idx}
            onClick={() => {
              if (isAnswered) return;
              onChange(String(idx));
            }}
            disabled={isAnswered}
            aria-checked={isSelected}
            role="radio"
            className={[
              // 모바일 터치 타깃 최소 44px (py-3 = 12px*2 + text ≈ 44px)
              'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
              'active:scale-[0.99]',
              isCorrectChoice
                ? 'bg-success-100 border-success-500 text-success-500 font-medium'
                : isWrongSelected
                ? 'bg-error-100 border-error-500 text-error-500'
                : isSelected && !isAnswered
                ? 'bg-primary-50 border-primary-500 text-primary-600 font-medium'
                : 'bg-bg-surface border-border-light text-text-primary hover:bg-neutral-50 hover:border-neutral-300',
              isAnswered ? 'cursor-default' : 'cursor-pointer',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="font-mono text-text-muted mr-2 select-none">
              {String.fromCharCode(9312 + idx)}
            </span>
            {choice}
            {isCorrectChoice && (
              <CheckCircle className="inline w-4 h-4 ml-2 text-success-500" />
            )}
            {isWrongSelected && (
              <XCircle className="inline w-4 h-4 ml-2 text-error-500" />
            )}
          </button>
        );
      })}
    </div>
  );
};
