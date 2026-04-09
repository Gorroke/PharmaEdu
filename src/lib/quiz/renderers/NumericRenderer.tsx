'use client';

import type { QuestionRenderer } from './types';

/**
 * 숫자 입력 렌더러.
 * 입력창 + (오답 시) 정답 노출만 담당.
 * 계산기 토글/위젯, 라벨 우측의 계산기 버튼 등은 QuizPlayer 셸 책임이며,
 * MiniCalculator 의 onUseResult 는 onChange 로 흘려보낼 수 있음.
 */
export const NumericRenderer: QuestionRenderer = ({
  question,
  userAnswer,
  isAnswered,
  onChange,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          id="numeric-answer"
          type="text"
          inputMode="numeric"
          value={userAnswer}
          onChange={(e) => onChange(e.target.value)}
          disabled={isAnswered}
          placeholder="예: 5700"
          className={[
            'flex-1 px-4 py-3 rounded-xl border text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            'disabled:bg-neutral-50 disabled:cursor-default',
            isAnswered && userAnswer.trim() === question.correct_answer.trim()
              ? 'border-success-500 bg-success-100'
              : isAnswered
              ? 'border-error-500 bg-error-100'
              : 'border-border-light bg-bg-surface',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
      {isAnswered && userAnswer.trim() !== question.correct_answer.trim() && (
        <p className="text-sm text-success-500 font-medium">
          정답: {question.correct_answer}
        </p>
      )}
    </div>
  );
};
