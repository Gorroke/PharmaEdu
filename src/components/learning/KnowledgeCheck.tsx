'use client';

import { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getKCQuestions } from './knowledge-check-data';
import type { KCQuestion } from './knowledge-check-data';
import { markKCPassed } from '@/lib/learning/progress';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface KnowledgeCheckProps {
  checkId: string;
  /**
   * 소속 lesson slug. 제공되면 이 KC 통과 시 해당 lesson 의 quizPassed 를 기록하고
   * 후속 lesson unlock 체크를 트리거한다.
   */
  lessonSlug?: string;
  /** legacy 콜백 — wiring 호환용. 내부 progress 처리와 별개로 호출됨. */
  onPass?: () => void;
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect';

interface QuestionState {
  selectedIndex: number | null;
  answerState: AnswerState;
}

// ─────────────────────────────────────────────
// Single Question Card
// ─────────────────────────────────────────────

interface QuestionCardProps {
  question: KCQuestion;
  qIndex: number;
  state: QuestionState;
  submitted: boolean;
  onSelect: (idx: number) => void;
}

function QuestionCard({ question, qIndex, state, submitted, onSelect }: QuestionCardProps) {
  const { selectedIndex, answerState } = state;

  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      {/* Question text */}
      <p className="mb-4 text-sm font-medium text-text-primary whitespace-pre-line">
        <span className="mr-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex-shrink-0">
          {qIndex + 1}
        </span>
        {question.question}
      </p>

      {/* Choices */}
      <div className="flex flex-col gap-2">
        {question.choices.map((choice, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = idx === question.correctIndex;

          let choiceClass =
            'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 ';

          if (!submitted) {
            choiceClass += isSelected
              ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
              : 'border-border-light bg-white text-text-primary hover:border-primary-300 hover:bg-primary-50/50';
          } else {
            if (isCorrect) {
              choiceClass +=
                'border-green-400 bg-green-50 text-green-800 font-medium cursor-default';
            } else if (isSelected && !isCorrect) {
              choiceClass +=
                'border-red-400 bg-red-50 text-red-700 cursor-default';
            } else {
              choiceClass += 'border-border-light bg-white text-text-muted cursor-default opacity-60';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={submitted}
              onClick={() => !submitted && onSelect(idx)}
              className={choiceClass}
              aria-pressed={isSelected}
            >
              {/* Circle indicator */}
              <span
                className={[
                  'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                  submitted && isCorrect
                    ? 'border-green-500 bg-green-500'
                    : submitted && isSelected && !isCorrect
                    ? 'border-red-500 bg-red-500'
                    : isSelected
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-border-medium bg-white',
                ].join(' ')}
              >
                {submitted && isCorrect && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                )}
                {submitted && isSelected && !isCorrect && (
                  <XCircle className="w-3.5 h-3.5 text-white" />
                )}
                {!submitted && isSelected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation — shown after submission */}
      {submitted && (
        <div
          className={[
            'mt-4 rounded-lg px-4 py-3 text-sm',
            answerState === 'correct'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800',
          ].join(' ')}
        >
          <span className="font-semibold mr-1">
            {answerState === 'correct' ? '정답입니다!' : '오답입니다.'}
          </span>
          {question.explanation}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function KnowledgeCheck({ checkId, lessonSlug, onPass }: KnowledgeCheckProps) {
  const questions = getKCQuestions(checkId);

  const initialStates = (): QuestionState[] =>
    (questions ?? []).map(() => ({ selectedIndex: null, answerState: 'unanswered' }));

  const [qStates, setQStates] = useState<QuestionState[]>(initialStates);
  const [submitted, setSubmitted] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  // ── Not found ──
  if (!questions || questions.length === 0) {
    return (
      <Card variant="outlined" className="border-border-medium my-6">
        <p className="text-sm text-text-muted text-center py-2">
          지식 체크 질문을 찾을 수 없습니다. (id: {checkId})
        </p>
      </Card>
    );
  }

  // ── Handlers ──
  const handleSelect = (qIdx: number, choiceIdx: number) => {
    setQStates((prev) =>
      prev.map((s, i) => (i === qIdx ? { ...s, selectedIndex: choiceIdx } : s))
    );
  };

  const handleSubmit = () => {
    const updated = qStates.map((s, i) => {
      if (s.selectedIndex === null) return s;
      const correct = s.selectedIndex === questions[i].correctIndex;
      return { ...s, answerState: (correct ? 'correct' : 'incorrect') as AnswerState };
    });
    setQStates(updated);
    setSubmitted(true);

    const passed = updated.every((s) => s.answerState === 'correct');
    if (passed) {
      setAllPassed(true);
      // 학습 진도 기록 — 이 KC 의 checkId 를 lesson 의 passedKCs 에 추가 (중복 제거).
      // lesson 전체 completed 처리는 StepView 의 마지막 step 도달 시 별도 분기에서 수행.
      if (lessonSlug && checkId) {
        try {
          markKCPassed(lessonSlug, checkId);
        } catch {
          // localStorage 접근 실패 시 silently 무시 (학습 흐름 막지 않음)
        }
      }
      onPass?.();
    }
  };

  const handleRetry = () => {
    setQStates(initialStates());
    setSubmitted(false);
    setAllPassed(false);
  };

  const allAnswered = qStates.every((s) => s.selectedIndex !== null);
  const anyWrong = submitted && qStates.some((s) => s.answerState === 'incorrect');

  // ── Render ──
  return (
    <Card
      variant="outlined"
      className="my-6 border-primary-200 bg-primary-50/30 p-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-primary-100 bg-primary-50">
        <HelpCircle className="w-5 h-5 text-primary-500 flex-shrink-0" />
        <span className="font-semibold text-primary-700 text-base">지식 체크 ✍️</span>
        <span className="ml-auto text-xs text-primary-500">
          {questions.length}문항
        </span>
      </div>

      {/* Success banner */}
      {allPassed && (
        <div className="flex items-center gap-2 px-5 py-3 bg-green-50 border-b border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-green-700 font-semibold text-sm">
            잘 이해하셨어요! 🎉 모두 정답입니다.
          </span>
        </div>
      )}

      {/* Questions */}
      <div className="px-5 py-5 flex flex-col gap-4">
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            qIndex={idx}
            state={qStates[idx]}
            submitted={submitted}
            onSelect={(choiceIdx) => handleSelect(idx, choiceIdx)}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 pb-5 gap-3">
        {anyWrong && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            다시 풀기
          </Button>
        )}
        {!submitted && (
          <Button
            variant="primary"
            size="sm"
            disabled={!allAnswered}
            onClick={handleSubmit}
            className="ml-auto"
          >
            제출하기
          </Button>
        )}
        {submitted && !anyWrong && !allPassed && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRetry}
            className="ml-auto gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            다시 풀기
          </Button>
        )}
      </div>
    </Card>
  );
}
