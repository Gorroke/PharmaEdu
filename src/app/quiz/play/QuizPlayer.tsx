'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Home, Calculator, Lightbulb, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { QuizQuestion } from '@/lib/quiz/types';
import { DIFFICULTY_LABEL, DIFFICULTY_VARIANT } from '@/lib/quiz/types';
import { saveQuizHistory } from '@/lib/quiz/history';
import { addWrongAnswer, markResolved, getWrongAnswers } from '@/lib/quiz/wrong-notes';
import { MiniCalculator } from '@/components/quiz/MiniCalculator';
import { QUESTION_RENDERERS } from '@/lib/quiz/renderers';
import { evaluateAnswer } from '@/lib/quiz/evaluator';

interface QuizPlayerProps {
  questions: QuizQuestion[];
  title: string;
  /** 히스토리 저장용 카테고리 식별자 */
  category?: string;
}

type AnswerState = 'idle' | 'correct' | 'incorrect';

export function QuizPlayer({ questions, title, category = 'random' }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  /**
   * 통합 사용자 답변 상태 (P1-E 리팩터).
   * 직렬화 문자열로 보관 — multiple_choice/true_false 는 인덱스 문자열,
   * numeric 은 raw 입력, 그 외 신규 타입은 JSON/CSV 직렬화 형태.
   */
  const [userAnswer, setUserAnswer] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  /** 카드 전환 애니메이션 트리거 */
  const [cardKey, setCardKey] = useState(0);
  const historySaved = useRef(false);
  /** 계산기 표시 여부 (numeric 문제에서만 사용) */
  const [showCalc, setShowCalc] = useState(false);
  /** 공개된 힌트 개수 (P0-D) */
  const [revealedHints, setRevealedHints] = useState(0);
  /** 용어집 popover 열림 (P0-D) */
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const glossaryRef = useRef<HTMLDivElement>(null);

  const question = questions[currentIndex];
  const total = questions.length;
  // 진행 바: 현재 문제까지 (답을 제출한 순간 +1)
  const progressPct = total > 0
    ? ((currentIndex + (answerState !== 'idle' ? 1 : 0)) / total) * 100
    : 0;

  // ── 키보드 네비게이션 ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 숫자 입력창 포커스 중이면 무시
      if ((e.target as HTMLElement).id === 'numeric-answer') return;

      const isMultipleChoice =
        question?.question_type === 'multiple_choice' ||
        question?.question_type === 'true_false';

      if (isMultipleChoice && answerState === 'idle') {
        // 1~4 키로 선택지 선택
        if (['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (question.choices && idx < question.choices.length) {
            setUserAnswer(String(idx));
          }
          return;
        }
      }

      // Enter: 정답 확인 또는 다음 문제
      if (e.key === 'Enter') {
        e.preventDefault();
        if (answerState === 'idle') {
          const canSubmit = isMultipleChoice
            ? userAnswer !== ''
            : userAnswer.trim() !== '';
          if (canSubmit) handleCheckAnswer();
        } else {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, answerState, userAnswer]);

  // ── 문제 변경 시 힌트/용어집 상태 리셋 (P0-D) ────────────
  useEffect(() => {
    setRevealedHints(0);
    setGlossaryOpen(false);
  }, [question?.id]);

  // ── 용어집 click-outside 처리 (P0-D) ──────────────────────
  useEffect(() => {
    if (!glossaryOpen) return;
    const handler = (e: MouseEvent) => {
      if (glossaryRef.current && !glossaryRef.current.contains(e.target as Node)) {
        setGlossaryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [glossaryOpen]);

  // ── 히스토리 저장 (완료 시 1회) ────────────────────────────
  useEffect(() => {
    if (isFinished && !historySaved.current) {
      historySaved.current = true;
      saveQuizHistory({
        category,
        categoryLabel: title,
        score,
        total,
        timestamp: Date.now(),
      });
    }
  }, [isFinished, category, title, score, total]);

  /** 렌더러가 호출하는 통합 onChange — 채점 후엔 무시 */
  const handleAnswerChange = useCallback((value: string) => {
    if (answerState !== 'idle') return;
    setUserAnswer(value);
  }, [answerState]);

  const handleCheckAnswer = useCallback(() => {
    if (!question) return;
    // 이미 채점된 상태면 재호출 무시 (중복 기록 방지)
    if (answerState !== 'idle') return;
    const answer =
      question.question_type === 'numeric' ? userAnswer.trim() : userAnswer;
    if (!answer) return;
    const isCorrect = evaluateAnswer(answer, question);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setScore((s) => s + 1);

    // ── 오답 노트 연동 (P1-G) ─────────────────────────────────
    // 동적 문제(string id)는 wrong-notes에 기록하지 않음. QuizPlayer는 정적 문제만 사용하므로 number id 보장.
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
        // 정답 시: 기존 오답 항목이 있으면 해결 처리
        const existing = getWrongAnswers().find((e) => e.questionId === question.id);
        if (existing && !existing.resolved) {
          markResolved(question.id);
        }
      }
    }
  }, [question, userAnswer, answerState]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= total) {
      setIsFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setUserAnswer('');
      setAnswerState('idle');
      setShowCalc(false); // 다음 문제에서 계산기 초기 접힘
      setCardKey((k) => k + 1); // 카드 페이드-인 트리거
    }
  }, [currentIndex, total]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setUserAnswer('');
    setAnswerState('idle');
    setScore(0);
    setIsFinished(false);
    setShowCalc(false);
    setCardKey(0);
    historySaved.current = false;
  }, []);

  // ── 빈 문제 상태 ──────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-text-secondary text-lg">불러올 문제가 없습니다.</p>
        <p className="text-text-muted text-sm">
          Supabase SQL Editor에서 seed_quiz.sql을 실행해주세요.
        </p>
        <Link href="/quiz">
          <Button variant="primary">퀴즈 홈으로</Button>
        </Link>
      </div>
    );
  }

  // ── 최종 결과 화면 ────────────────────────────────────────
  if (isFinished) {
    const pct = Math.round((score / total) * 100);
    const resultVariant = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'error';
    const resultMsg =
      pct >= 80 ? '훌륭합니다!' : pct >= 50 ? '잘 했어요. 더 연습해보세요!' : '다시 한 번 도전해보세요!';

    return (
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <Card variant="elevated" className="text-center space-y-4">
          <div className="flex justify-center">
            {pct >= 80 ? (
              <CheckCircle className="w-16 h-16 text-success-500" />
            ) : (
              <XCircle className="w-16 h-16 text-error-500" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-text-primary">퀴즈 완료!</h2>
          <div className="py-4">
            <p className="text-5xl font-extrabold text-primary-500">
              {score} / {total}
            </p>
            <p className="text-text-secondary mt-1">{pct}% 정답률</p>
          </div>
          <Badge variant={resultVariant} className="text-sm px-3 py-1 h-auto">
            {resultMsg}
          </Badge>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="primary" onClick={handleRestart}>
              <RotateCcw className="w-4 h-4" />
              다시 풀기
            </Button>
            <Link href="/quiz">
              <Button variant="secondary">
                <Home className="w-4 h-4" />
                퀴즈 홈
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ── 문제 화면 ─────────────────────────────────────────────
  const isAnswered = answerState !== 'idle';
  const isCorrect = answerState === 'correct' ? true : answerState === 'incorrect' ? false : null;
  const isMultipleChoice =
    question.question_type === 'multiple_choice' ||
    question.question_type === 'true_false';
  const isNumeric = question.question_type === 'numeric';
  const canSubmit = isMultipleChoice ? userAnswer !== '' : userAnswer.trim() !== '';
  // 팩토리에서 렌더러 조회 — 등록되지 않은 신규 타입은 P1-F가 채울 예정
  const Renderer = QUESTION_RENDERERS[question.question_type];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 제목 + 진행 바 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span className="font-medium">{title}</span>
          <span>
            {currentIndex + 1} / {total}
          </span>
        </div>
        <div
          className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 — key 변경 시 fade-in 재생 */}
      <div
        key={cardKey}
        className="animate-fadeIn"
        style={{ animation: 'fadeIn 0.25s ease-out' }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>

        <Card variant="standard" className="space-y-4">
          {/* 메타 정보 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="primary">{question.chapter}</Badge>
            <Badge variant={DIFFICULTY_VARIANT[question.difficulty]}>
              {DIFFICULTY_LABEL[question.difficulty]}
            </Badge>
            {question.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>

          {/* 참고 약품 chips (P0-D) */}
          {question.drug_refs && question.drug_refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
              <span className="font-medium">참고 약품:</span>
              {question.drug_refs.map((d) => (
                <span
                  key={d.code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 border border-border-light"
                >
                  <span className="font-mono text-text-secondary">[{d.code}]</span>
                  <span className="text-text-primary">{d.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* 문제 텍스트 */}
          <p className="text-text-primary font-medium leading-relaxed">
            {question.question}
          </p>

          {/* 힌트 / 용어집 컨트롤 영역 (P0-D) */}
          {!isAnswered &&
            ((question.hints && question.hints.length > 0) ||
              (question.code_glossary && question.code_glossary.length > 0)) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {question.hints && question.hints.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedHints((n) =>
                        Math.min(n + 1, question.hints!.length)
                      )
                    }
                    disabled={revealedHints >= question.hints.length}
                    aria-label={`힌트 보기 (${Math.min(
                      revealedHints + 1,
                      question.hints.length
                    )} / ${question.hints.length})`}
                    className={[
                      'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold',
                      'transition-all duration-150 border',
                      revealedHints >= question.hints.length
                        ? 'bg-neutral-100 border-neutral-200 text-text-muted cursor-not-allowed'
                        : 'bg-warning-100 border-warning-500 text-warning-500 hover:brightness-95',
                    ].join(' ')}
                  >
                    <Lightbulb className="w-3 h-3" />
                    {revealedHints >= question.hints.length
                      ? `힌트 모두 공개 (${question.hints.length}/${question.hints.length})`
                      : `힌트 보기 (${revealedHints + 1}/${question.hints.length})`}
                  </button>
                )}

                {question.code_glossary && question.code_glossary.length > 0 && (
                  <div className="relative" ref={glossaryRef}>
                    <button
                      type="button"
                      onClick={() => setGlossaryOpen((v) => !v)}
                      aria-expanded={glossaryOpen}
                      aria-label="용어 보기"
                      className={[
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold',
                        'transition-all duration-150 border',
                        glossaryOpen
                          ? 'bg-primary-500 border-primary-600 text-white shadow-sm'
                          : 'bg-neutral-100 border-neutral-300 text-text-secondary hover:bg-neutral-200',
                      ].join(' ')}
                    >
                      <BookOpen className="w-3 h-3" />
                      용어 보기
                    </button>
                    {glossaryOpen && (
                      <div
                        role="dialog"
                        className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 max-w-[90vw] z-50 bg-bg-surface border border-border-medium rounded-lg shadow-sm p-3 space-y-2"
                      >
                        {question.code_glossary.map((g) => (
                          <div
                            key={g.code}
                            className="text-xs border-b border-border-light last:border-b-0 pb-2 last:pb-0"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono font-bold text-text-primary">
                                {g.code}
                              </span>
                              <span className="text-text-secondary">{g.name}</span>
                            </div>
                            {g.note && (
                              <p className="text-text-muted mt-0.5 leading-relaxed">
                                {g.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* 공개된 힌트 패널 (P0-D) */}
          {!isAnswered && revealedHints > 0 && question.hints && (
            <div
              className="rounded-lg shadow-sm border border-warning-500/40 bg-warning-100/60 p-3 space-y-1.5"
              style={{ animation: 'fadeIn 0.2s ease-out' }}
            >
              {question.hints.slice(0, revealedHints).map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-text-primary">
                  <Lightbulb className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <span className="font-semibold mr-1">힌트 {i + 1}.</span>
                    {h}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 객관식 — 계산기 토글 (선택지 아래로 이동: P1-7) */}

          {/* 선택지 또는 입력창 — P1-E: 팩토리 렌더러로 위임 */}
          {isMultipleChoice && question.choices ? (
            <>
            {Renderer && (
              <Renderer
                question={question}
                userAnswer={userAnswer}
                isAnswered={isAnswered}
                isCorrect={isCorrect}
                onChange={handleAnswerChange}
                onSubmit={handleCheckAnswer}
              />
            )}

            {/* 객관식 계산기 토글 — 선택지 아래 (P1-7) */}
            {!isAnswered && (
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowCalc((v) => !v)}
                  className={[
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold',
                    'transition-all duration-150 border',
                    showCalc
                      ? 'bg-primary-500 border-primary-600 text-white hover:bg-primary-600 shadow-sm'
                      : 'bg-neutral-100 border-neutral-300 text-text-secondary hover:bg-neutral-200',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-expanded={showCalc}
                  aria-label={showCalc ? '계산기 숨기기' : '계산기 표시'}
                >
                  <Calculator className="w-3 h-3" />
                  {showCalc ? '계산기 닫기' : '계산기'}
                </button>
              </div>
            )}

            {/* 객관식 계산기 위젯 — P2 모바일 drawer / PC 인라인 */}
            {showCalc && !isAnswered && (
              <>
                {/* 모바일 dim 오버레이 */}
                <div
                  className="sm:hidden fixed inset-0 bg-neutral-900/40 z-[55]"
                  onClick={() => setShowCalc(false)}
                />
                {/* 모바일 bottom drawer */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-bg-surface rounded-t-2xl shadow-lg"
                  style={{
                    paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
                    animation: 'slideUp 0.2s ease-out',
                  }}
                >
                  <div className="w-8 h-1 bg-neutral-300 rounded-full mx-auto mt-3 mb-1" />
                  <div className="px-4">
                    <MiniCalculator onClose={() => setShowCalc(false)} />
                  </div>
                </div>
                {/* PC 인라인 (sm 이상) */}
                <div
                  className="hidden sm:flex justify-end"
                  style={{ animation: 'fadeIn 0.15s ease-out' }}
                >
                  <div className="w-64 flex-shrink-0">
                    <MiniCalculator onClose={() => setShowCalc(false)} />
                  </div>
                </div>
              </>
            )}
            </>
          ) : isNumeric ? (
            /* 숫자 입력 — 셸은 라벨/계산기 토글/위젯만 담당, 입력창은 NumericRenderer */
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary" htmlFor="numeric-answer">
                  답을 숫자로 입력하세요 (단위 없이 숫자만)
                </label>
                {/* 계산기 토글 버튼 (P0-2 통일 스타일) */}
                <button
                  type="button"
                  onClick={() => setShowCalc((v) => !v)}
                  className={[
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold',
                    'transition-all duration-150 border',
                    showCalc
                      ? 'bg-primary-500 border-primary-600 text-white hover:bg-primary-600 shadow-sm'
                      : 'bg-neutral-100 border-neutral-300 text-text-secondary hover:bg-neutral-200',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-expanded={showCalc}
                  aria-label={showCalc ? '계산기 숨기기' : '계산기 표시'}
                >
                  <Calculator className="w-3 h-3" />
                  {showCalc ? '계산기 닫기' : '계산기'}
                </button>
              </div>

              {/* 답안 입력창 — P1-E: NumericRenderer로 위임 */}
              {Renderer && (
                <Renderer
                  question={question}
                  userAnswer={userAnswer}
                  isAnswered={isAnswered}
                  isCorrect={isCorrect}
                  onChange={handleAnswerChange}
                  onSubmit={handleCheckAnswer}
                />
              )}

              {/* 계산기 위젯 — P2 모바일 drawer / PC 인라인 */}
              {showCalc && !isAnswered && (
                <>
                  {/* 모바일 dim 오버레이 */}
                  <div
                    className="sm:hidden fixed inset-0 bg-neutral-900/40 z-[55]"
                    onClick={() => setShowCalc(false)}
                  />
                  {/* 모바일 bottom drawer */}
                  <div
                    className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-bg-surface rounded-t-2xl shadow-lg"
                    style={{
                      paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
                      animation: 'slideUp 0.2s ease-out',
                    }}
                  >
                    <div className="w-8 h-1 bg-neutral-300 rounded-full mx-auto mt-3 mb-1" />
                    <div className="px-4">
                      <MiniCalculator
                        onUseResult={(val) => handleAnswerChange(val)}
                        onClose={() => setShowCalc(false)}
                      />
                    </div>
                  </div>
                  {/* PC 인라인 (sm 이상) */}
                  <div
                    className="hidden sm:block sm:w-64 sm:flex-shrink-0"
                    style={{ animation: 'fadeIn 0.15s ease-out' }}
                  >
                    <MiniCalculator
                      onUseResult={(val) => handleAnswerChange(val)}
                      onClose={() => setShowCalc(false)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            /* 신규 타입 (matching/ordering/fill_blank/error_spot/multi_step) — 렌더러에 전적 위임 */
            <div className="pt-1">
              {Renderer ? (
                <Renderer
                  question={question}
                  userAnswer={userAnswer}
                  isAnswered={isAnswered}
                  isCorrect={isCorrect}
                  onChange={handleAnswerChange}
                  onSubmit={handleCheckAnswer}
                />
              ) : (
                <p className="text-sm text-text-muted">
                  지원되지 않는 문제 유형입니다: {question.question_type}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* 해설 카드 (정답 확인 후 표시) */}
        {isAnswered && (
          <div
            className="mt-4"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
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
                <div className="space-y-1">
                  <p
                    className={`font-semibold text-sm ${
                      answerState === 'correct' ? 'text-success-500' : 'text-error-500'
                    }`}
                  >
                    {answerState === 'correct' ? '정답입니다!' : '오답입니다.'}
                  </p>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {question.explanation}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-between items-center">
        <Link href="/quiz">
          <Button variant="ghost" size="sm">
            <Home className="w-4 h-4" />
            홈
          </Button>
        </Link>

        {/* 키보드 힌트 (데스크탑만) */}
        {!isAnswered && (
          <span className="hidden sm:block text-xs text-text-muted">
            {isMultipleChoice ? '숫자키(1~4) 선택 · Enter 확인' : 'Enter 확인'}
          </span>
        )}

        {!isAnswered ? (
          <Button
            variant="primary"
            onClick={handleCheckAnswer}
            disabled={!canSubmit}
          >
            정답 확인
          </Button>
        ) : (
          <Button variant="primary" onClick={handleNext}>
            {currentIndex + 1 >= total ? '결과 보기' : '다음 문제'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
