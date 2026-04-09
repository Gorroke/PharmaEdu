'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Home, BookOpen, Shuffle, Flame } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { QuizQuestion } from '@/lib/quiz/types';
import { DIFFICULTY_LABEL, DIFFICULTY_VARIANT } from '@/lib/quiz/types';
import { getTodayRecord, saveDailyRecord, calculateStats, getDailyRecords } from '@/lib/daily/storage';
import { getTodayKST } from '@/lib/daily/date';
import type { DailyStats } from '@/lib/daily/types';
import { addWrongAnswer, markResolved, getWrongAnswers } from '@/lib/quiz/wrong-notes';

interface DailyPlayerProps {
  question: QuizQuestion;
}

type Phase = 'blocked' | 'playing' | 'result';

export function DailyPlayer({ question }: DailyPlayerProps) {
  const [phase, setPhase] = useState<Phase>('playing');
  const [userAnswer, setUserAnswer] = useState('');
  const [numericInput, setNumericInput] = useState('');
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [stats, setStats] = useState<DailyStats | null>(null);

  const isMultipleChoice =
    question.question_type === 'multiple_choice' || question.question_type === 'true_false';
  const canSubmit = isMultipleChoice ? userAnswer !== '' : numericInput.trim() !== '';
  const isAnswered = answerState !== 'idle';

  // 마운트 시 오늘 이미 풀었는지 확인 (localStorage는 SSR에서 접근 불가, effect 내 처리)
  useEffect(() => {
    const todayRec = getTodayRecord();
    if (todayRec) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('blocked');
    }
  }, []);

  const handleChoiceSelect = useCallback(
    (idx: number) => {
      if (isAnswered) return;
      setUserAnswer(String(idx));
    },
    [isAnswered]
  );

  const handleCheckAnswer = useCallback(() => {
    // 이미 채점된 상태면 재호출 무시 (중복 기록 방지)
    if (isAnswered) return;
    const answer = isMultipleChoice ? userAnswer : numericInput.trim();
    if (!answer) return;

    const isCorrect = answer === question.correct_answer;
    setAnswerState(isCorrect ? 'correct' : 'incorrect');

    // localStorage 저장
    saveDailyRecord({
      date: getTodayKST(),
      questionId: question.id,
      correct: isCorrect,
      answeredAt: Date.now(),
    });

    // 저장 후 stats 재계산
    const records = getDailyRecords();
    setStats(calculateStats(records));

    // ── 오답 노트 연동 (P1-G) ─────────────────────────────────
    // DailyPlayer는 정적 QuizQuestion(number id)만 사용하므로 안전.
    if (typeof question.id === 'number') {
      if (!isCorrect) {
        const existing = getWrongAnswers().find((e) => e.questionId === question.id);
        addWrongAnswer({
          questionId: question.id,
          question: question.question,
          correctAnswer: question.correct_answer,
          userAnswer: answer,
          explanation: question.explanation ?? '',
          chapter: question.chapter,
          difficulty: question.difficulty,
          timestamp: Date.now(),
          attempts: existing ? existing.attempts + 1 : 1,
          resolved: false,
        });
      } else {
        const existing = getWrongAnswers().find((e) => e.questionId === question.id);
        if (existing && !existing.resolved) {
          markResolved(question.id);
        }
      }
    }
  }, [isMultipleChoice, userAnswer, numericInput, question, isAnswered]);

  const handleShowResult = useCallback(() => {
    setPhase('result');
  }, []);

  // ── 이미 오늘 풀었음 ──
  if (phase === 'blocked') {
    const todayRec = getTodayRecord();
    return (
      <div className="space-y-6 py-8 text-center">
        <div className="flex justify-center">
          {todayRec?.correct ? (
            <CheckCircle className="w-16 h-16 text-success-500" />
          ) : (
            <XCircle className="w-16 h-16 text-error-500" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-text-primary">오늘은 이미 풀었어요!</h2>
        <p className="text-text-secondary text-sm">
          {todayRec?.correct
            ? '정답을 맞혔습니다. 내일 새 문제가 나옵니다.'
            : '오답이었습니다. 내일 다시 도전해보세요!'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/learn/${question.chapter.toLowerCase()}`}>
            <Button variant="secondary">
              <BookOpen className="w-4 h-4" />
              {question.chapter} 학습하기
            </Button>
          </Link>
          <Link href="/quiz">
            <Button variant="secondary">
              <Shuffle className="w-4 h-4" />
              다른 퀴즈 풀기
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <Home className="w-4 h-4" />
              홈으로
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (phase === 'result') {
    const isCorrect = answerState === 'correct';
    const streak = stats?.currentStreak ?? 0;

    return (
      <div className="space-y-6 py-4">
        <Card variant="elevated" className="text-center space-y-4">
          <div className="flex justify-center">
            {isCorrect ? (
              <CheckCircle className="w-16 h-16 text-success-500" />
            ) : (
              <XCircle className="w-16 h-16 text-error-500" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-text-primary">
            {isCorrect ? '정답입니다!' : '오답입니다.'}
          </h2>

          {/* 스트릭 배지 */}
          {streak > 0 && (
            <div className="flex items-center justify-center gap-2">
              <Flame className="w-5 h-5 text-warning-500" aria-label="스트릭 불꽃" />
              <span className="text-xl font-bold text-warning-500">{streak}일 연속!</span>
            </div>
          )}

          {/* 해설 */}
          <div
            className={[
              'text-left px-4 py-3 rounded-lg border-l-4',
              isCorrect
                ? 'bg-success-100 border-l-success-500'
                : 'bg-error-100 border-l-error-500',
            ].join(' ')}
          >
            <p className="text-sm text-text-secondary leading-relaxed">
              {question.explanation}
            </p>
          </div>

          {/* 통계 미니 */}
          {stats && (
            <p className="text-xs text-text-muted">
              총 {stats.totalSolved}문제 풀이 · 정답률{' '}
              {stats.totalSolved > 0
                ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
                : 0}
              %
            </p>
          )}

          {/* 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href={`/learn/${question.chapter.toLowerCase()}`}>
              <Button variant="secondary">
                <BookOpen className="w-4 h-4" />
                {question.chapter} 학습하기
              </Button>
            </Link>
            <Link href="/quiz">
              <Button variant="secondary">
                <Shuffle className="w-4 h-4" />
                다른 퀴즈 풀기
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">
                <Home className="w-4 h-4" />
                홈으로
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ── 문제 풀기 화면 ──
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">오늘의 1문제</span>
        <Link href="/daily">
          <Button variant="ghost" size="sm">
            <Home className="w-4 h-4" />
            목록
          </Button>
        </Link>
      </div>

      {/* 문제 카드 */}
      <Card variant="standard" className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning">{question.chapter}</Badge>
          <Badge variant={DIFFICULTY_VARIANT[question.difficulty]}>
            {DIFFICULTY_LABEL[question.difficulty]}
          </Badge>
        </div>

        <p className="text-text-primary font-medium leading-relaxed">{question.question}</p>

        {/* 선택지 */}
        {isMultipleChoice && question.choices ? (
          <div className="space-y-2 pt-1">
            {question.choices.map((choice, idx) => {
              const isSelected = userAnswer === String(idx);
              const isCorrectChoice =
                isAnswered && String(idx) === question.correct_answer;
              const isWrongSelected =
                isAnswered && isSelected && !isCorrectChoice;

              return (
                <button
                  key={idx}
                  onClick={() => handleChoiceSelect(idx)}
                  disabled={isAnswered}
                  className={[
                    'w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    isCorrectChoice
                      ? 'bg-success-100 border-success-500 text-success-500 font-medium'
                      : isWrongSelected
                      ? 'bg-error-100 border-error-500 text-error-500'
                      : isSelected && !isAnswered
                      ? 'bg-primary-50 border-primary-500 text-primary-600 font-medium'
                      : 'bg-bg-surface border-border-light text-text-primary hover:bg-neutral-50',
                    isAnswered ? 'cursor-default' : 'cursor-pointer',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="font-mono text-text-muted mr-2">
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
        ) : (
          /* 숫자 입력 */
          <div className="pt-1 space-y-2">
            <label className="text-sm text-text-secondary" htmlFor="daily-numeric-answer">
              답을 숫자로 입력하세요 (단위 없이 숫자만)
            </label>
            <input
              id="daily-numeric-answer"
              type="text"
              inputMode="numeric"
              value={numericInput}
              onChange={(e) => setNumericInput(e.target.value)}
              disabled={isAnswered}
              placeholder="예: 5700"
              className={[
                'w-full px-4 py-3 min-h-[44px] rounded-lg border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                'disabled:bg-neutral-50 disabled:cursor-default',
                isAnswered && numericInput === question.correct_answer
                  ? 'border-success-500 bg-success-100'
                  : isAnswered
                  ? 'border-error-500 bg-error-100'
                  : 'border-border-light bg-bg-surface',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            {isAnswered && numericInput !== question.correct_answer && (
              <p className="text-sm text-success-500 font-medium">
                정답: {question.correct_answer}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 해설 (답 확인 후) */}
      {isAnswered && (
        <Card
          variant="standard"
          className={
            answerState === 'correct'
              ? 'border-l-4 border-l-success-500 bg-success-100'
              : 'border-l-4 border-l-error-500 bg-error-100'
          }
        >
          <div className="flex items-start gap-3">
            {answerState === 'correct' ? (
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-error-500 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-text-secondary text-sm leading-relaxed">
              {question.explanation}
            </p>
          </div>
        </Card>
      )}

      {/* 버튼 영역 */}
      <div className="flex justify-end">
        {!isAnswered ? (
          <Button variant="primary" onClick={handleCheckAnswer} disabled={!canSubmit}>
            정답 확인
          </Button>
        ) : (
          <Button variant="primary" onClick={handleShowResult}>
            결과 보기
          </Button>
        )}
      </div>
    </div>
  );
}
