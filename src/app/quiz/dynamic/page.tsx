'use client';

/**
 * /quiz/dynamic
 * 동적 계산 문제 연습 페이지
 * - API에서 문제 생성 (/api/quiz/generate)
 * - 숫자 입력 → 정답 확인 (±1원 허용)
 * - 단계별 해설 표시
 * - 세션 점수 추적
 */

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, ChevronRight, RefreshCw, Home, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { DynamicQuestion, DynamicDrug } from '@/lib/quiz/dynamic-generator';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Difficulty = 1 | 2 | 3;
type AnswerState = 'idle' | 'correct' | 'incorrect';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: '쉬움', 2: '보통', 3: '어려움' };
const DIFFICULTY_BADGE: Record<Difficulty, 'success' | 'warning' | 'error'> = {
  1: 'success',
  2: 'warning',
  3: 'error',
};
const TYPE_LABEL: Record<DynamicQuestion['type'], string> = {
  'calc-copay': '본인부담금 계산',
  'calc-total': '요양급여비용 총액',
  'calc-drug-amount': '약품금액 계산',
  'multi-step': '단계별 계산',
  'error-spot': '오류 찾기',
  'fill-blank': '빈칸 채우기',
};

// ─── 서브 컴포넌트: 약품 테이블 ──────────────────────────────────────────────

function DrugTable({ drugs }: { drugs: DynamicDrug[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-light">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 border-b border-border-light">
            <th className="px-3 py-2 text-left text-text-secondary font-medium">약품</th>
            <th className="px-3 py-2 text-right text-text-secondary font-medium">단가(원)</th>
            <th className="px-3 py-2 text-right text-text-secondary font-medium">1회 투약량</th>
            <th className="px-3 py-2 text-right text-text-secondary font-medium">1일 횟수</th>
            <th className="px-3 py-2 text-right text-text-secondary font-medium">투여일수</th>
          </tr>
        </thead>
        <tbody>
          {drugs.map((d, i) => (
            <tr key={i} className="border-b border-border-light last:border-0 hover:bg-neutral-50">
              <td className="px-3 py-2 text-text-primary font-mono text-xs">약품{i + 1}</td>
              <td className="px-3 py-2 text-right text-text-primary">{d.price.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-text-secondary">{d.dose}</td>
              <td className="px-3 py-2 text-right text-text-secondary">{d.dnum}</td>
              <td className="px-3 py-2 text-right text-text-primary font-medium">{d.dday}일</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 서브 컴포넌트: 해설 ──────────────────────────────────────────────────────

function ExplanationBlock({ explanation }: { explanation: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg border border-border-light p-4">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
        계산 해설
      </p>
      <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
        {explanation}
      </pre>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function DynamicQuizPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [question, setQuestion] = useState<DynamicQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [numericInput, setNumericInput] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('idle');

  // 세션 점수
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── 문제 생성 ────────────────────────────────────────────────────────────────
  const fetchQuestion = useCallback(
    async (diff: Difficulty) => {
      setLoading(true);
      setError(null);
      setQuestion(null);
      setNumericInput('');
      setAnswerState('idle');

      try {
        const res = await fetch(`/api/quiz/generate?difficulty=${diff}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data: DynamicQuestion = await res.json();
        setQuestion(data);
        // 포커스 이동 (약간 지연)
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch (e) {
        setError(e instanceof Error ? e.message : '문제 생성에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── 정답 확인 ────────────────────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!question || answerState !== 'idle') return;
    const userVal = parseInt(numericInput.replace(/,/g, ''), 10);
    if (isNaN(userVal)) return;

    // ±1원 허용 (소수점 반올림 차이)
    const isCorrect = Math.abs(userVal - question.correctAnswer) <= 1;
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    setSessionTotal((t) => t + 1);
    if (isCorrect) setSessionCorrect((c) => c + 1);
  }, [question, answerState, numericInput]);

  // ── 다음 문제 ────────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    fetchQuestion(difficulty);
  }, [fetchQuestion, difficulty]);

  // ── 난이도 변경 ──────────────────────────────────────────────────────────────
  const handleDifficultyChange = useCallback(
    (diff: Difficulty) => {
      setDifficulty(diff);
      setQuestion(null);
      setNumericInput('');
      setAnswerState('idle');
      setError(null);
    },
    []
  );

  // ── 세션 리셋 ────────────────────────────────────────────────────────────────
  const handleResetSession = useCallback(() => {
    setSessionCorrect(0);
    setSessionTotal(0);
    setQuestion(null);
    setNumericInput('');
    setAnswerState('idle');
    setError(null);
  }, []);

  const isAnswered = answerState !== 'idle';
  const canSubmit = numericInput.trim() !== '' && !isNaN(parseInt(numericInput.replace(/,/g, ''), 10));
  const accuracyPct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* 헤더 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">동적 계산 문제</h1>
          <Link href="/quiz">
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4" />
              퀴즈 홈
            </Button>
          </Link>
        </div>
        <p className="text-sm text-text-secondary">
          calc-engine이 실시간으로 생성하는 무한 계산 문제입니다.
        </p>
      </div>

      {/* 세션 점수 */}
      {sessionTotal > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-100">
          <span className="text-sm text-text-secondary">세션 점수:</span>
          <span className="font-bold text-primary-600">
            {sessionCorrect} / {sessionTotal}
          </span>
          {accuracyPct !== null && (
            <Badge variant={accuracyPct >= 80 ? 'success' : accuracyPct >= 50 ? 'warning' : 'error'}>
              {accuracyPct}%
            </Badge>
          )}
          <button
            onClick={handleResetSession}
            className="ml-auto text-xs text-text-muted hover:text-text-secondary underline"
          >
            초기화
          </button>
        </div>
      )}

      {/* 난이도 선택 + 생성 버튼 */}
      <Card variant="standard" className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">난이도 선택</p>
          <div className="flex gap-2">
            {([1, 2, 3] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => handleDifficultyChange(d)}
                className={[
                  'flex-1 py-2.5 min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-all duration-150',
                  difficulty === d
                    ? d === 1
                      ? 'bg-success-100 border-success-500 text-success-500'
                      : d === 2
                      ? 'bg-warning-100 border-warning-500 text-warning-500'
                      : 'bg-error-100 border-error-500 text-error-500'
                    : 'bg-bg-surface border-border-light text-text-secondary hover:bg-neutral-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => fetchQuestion(difficulty)}
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              문제 생성 중...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {question ? '새 문제 생성' : '문제 생성하기'}
            </>
          )}
        </Button>
      </Card>

      {/* 오류 표시 */}
      {error && (
        <div className="p-4 bg-error-100 border border-error-500 rounded-lg text-error-500 text-sm">
          {error}
        </div>
      )}

      {/* 문제 카드 */}
      {question && !loading && (
        <div
          key={question.id}
          style={{ animation: 'fadeIn 0.25s ease-out' }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <Card variant="standard" className="space-y-5">
            {/* 메타 배지 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={DIFFICULTY_BADGE[question.difficulty]}>
                {DIFFICULTY_LABEL[question.difficulty]}
              </Badge>
              <Badge variant="primary">
                {TYPE_LABEL[question.type]}
              </Badge>
              <Badge variant="neutral">건강보험 C10</Badge>
            </div>

            {/* 시나리오 설명 */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-secondary">환자 정보</p>
              <p className="text-text-primary">
                나이: <strong>{question.given.age}세</strong>
                {question.given.age < 6 && (
                  <Badge variant="error" className="ml-2">6세 미만</Badge>
                )}
                {question.given.age >= 65 && (
                  <Badge variant="warning" className="ml-2">65세 이상</Badge>
                )}
              </p>
            </div>

            {/* 약품 테이블 */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-secondary">처방 약품 목록</p>
              <DrugTable drugs={question.given.drugs} />
            </div>

            {/* 문제 */}
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
              <p className="text-text-primary font-medium leading-relaxed">
                {/* 마지막 두 줄만 표시 (question 유형별 질문 부분) */}
                {question.prompt.split('\n').slice(-3).join('\n').trim()}
              </p>
            </div>

            {/* 답 입력 */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary" htmlFor="dyn-answer">
                계산 결과를 원(₩) 단위 정수로 입력하세요
              </label>
              <div className="flex gap-2">
                <input
                  id="dyn-answer"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={numericInput}
                  onChange={(e) => setNumericInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!isAnswered && canSubmit) handleCheck();
                      else if (isAnswered) handleNext();
                    }
                  }}
                  disabled={isAnswered}
                  placeholder="예: 5700"
                  className={[
                    'flex-1 px-4 py-3 rounded-xl border text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500',
                    'disabled:bg-neutral-50 disabled:cursor-default',
                    isAnswered && answerState === 'correct'
                      ? 'border-success-500 bg-success-100'
                      : isAnswered
                      ? 'border-error-500 bg-error-100'
                      : 'border-border-light bg-bg-surface',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                {!isAnswered && (
                  <Button
                    variant="primary"
                    onClick={handleCheck}
                    disabled={!canSubmit}
                  >
                    확인
                  </Button>
                )}
              </div>
            </div>

            {/* 정답/오답 피드백 */}
            {isAnswered && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
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
                    <div className="space-y-1 flex-1">
                      <p
                        className={`font-semibold text-sm ${
                          answerState === 'correct' ? 'text-success-500' : 'text-error-500'
                        }`}
                      >
                        {answerState === 'correct' ? '정답입니다!' : '오답입니다.'}
                      </p>
                      {answerState === 'incorrect' && (
                        <p className="text-sm text-text-secondary">
                          정답:{' '}
                          <strong className="text-success-500">
                            {question.correctAnswer.toLocaleString()}원
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 단계별 해설 */}
                <div className="mt-3">
                  <ExplanationBlock explanation={question.explanation} />
                </div>

                {/* 다음 문제 버튼 */}
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" onClick={handleNext}>
                    다음 문제
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 아직 문제 없을 때 안내 */}
      {!question && !loading && !error && (
        <div className="text-center py-12 text-text-muted text-sm">
          난이도를 선택하고 <strong>문제 생성하기</strong>를 눌러주세요.
        </div>
      )}
    </div>
  );
}
