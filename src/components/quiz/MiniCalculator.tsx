'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Calculator, X, Delete } from 'lucide-react';

// ── 계산기 로직 헬퍼 ────────────────────────────────────────────

type Operator = '+' | '-' | '×' | '÷' | null;

interface CalcState {
  display: string;       // 현재 표시값
  expression: string;   // 식 표시 (예: "123 + ")
  previousValue: number | null;
  operator: Operator;
  justEvaluated: boolean;     // = 직후 새 숫자 입력 시 완전 초기화
  waitingForOperand: boolean; // 연산자 입력 직후 다음 숫자로 디스플레이 교체
}

const INITIAL_STATE: CalcState = {
  display: '0',
  expression: '',
  previousValue: null,
  operator: null,
  justEvaluated: false,
  waitingForOperand: false,
};

function evaluate(a: number, op: Operator, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    default:  return null;
  }
}

/** 부동소수점 표시 정리 (최대 10자리) */
function formatResult(n: number): string {
  if (!isFinite(n)) return 'Error';
  // 반올림 오차 제거
  const fixed = parseFloat(n.toPrecision(10));
  return String(fixed);
}

// ── Props ────────────────────────────────────────────────────────

interface MiniCalculatorProps {
  /** 계산 결과를 답안 입력란에 복사할 때 호출 */
  onUseResult?: (value: string) => void;
  /** 계산기 닫기 콜백 (있으면 헤더에 닫기 버튼 표시) */
  onClose?: () => void;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────

export function MiniCalculator({ onUseResult, onClose }: MiniCalculatorProps) {
  const [calc, setCalc] = useState<CalcState>(INITIAL_STATE);
  // 키보드 이벤트를 계산기가 포커스 영역 안에 있을 때만 받기 위한 ref
  const rootRef = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  // ── 숫자 입력 ──────────────────────────────────────────────────
  const inputDigit = useCallback((digit: string) => {
    setCalc((prev) => {
      // = 직후에 숫자를 누르면 새 계산 시작 (체인 완전 초기화)
      if (prev.justEvaluated) {
        return {
          ...INITIAL_STATE,
          display: digit === '.' ? '0.' : digit,
          expression: '',
        };
      }
      // 연산자 직후에 숫자를 누르면 새 피연산자 입력 (체인은 유지)
      if (prev.waitingForOperand) {
        return {
          ...prev,
          display: digit === '.' ? '0.' : digit,
          waitingForOperand: false,
        };
      }
      // 소수점 중복 방지
      if (digit === '.' && prev.display.includes('.')) return prev;
      // 최대 12자리 제한
      if (prev.display.replace('.', '').replace('-', '').length >= 12 && digit !== '.') return prev;

      const newDisplay =
        prev.display === '0' && digit !== '.'
          ? digit
          : prev.display + digit;

      return { ...prev, display: newDisplay };
    });
  }, []);

  // ── 연산자 선택 ────────────────────────────────────────────────
  const inputOperator = useCallback((op: Operator) => {
    setCalc((prev) => {
      const current = parseFloat(prev.display);

      // 연산자를 연달아 누르면 마지막 연산자만 갱신 (피연산자 입력 전)
      if (prev.waitingForOperand && prev.previousValue !== null) {
        return {
          ...prev,
          expression: `${formatResult(prev.previousValue)} ${op} `,
          operator: op,
        };
      }

      // 이전 연산자가 있고 justEvaluated가 아닌 경우 → 연쇄 계산
      if (prev.operator && !prev.justEvaluated && prev.previousValue !== null) {
        const result = evaluate(prev.previousValue, prev.operator, current);
        if (result === null) {
          return { ...INITIAL_STATE, display: 'Error', expression: '' };
        }
        const resultStr = formatResult(result);
        return {
          display: resultStr,
          expression: `${resultStr} ${op} `,
          previousValue: result,
          operator: op,
          justEvaluated: false,
          waitingForOperand: true,
        };
      }

      return {
        ...prev,
        expression: `${prev.display} ${op} `,
        previousValue: current,
        operator: op,
        justEvaluated: false,
        waitingForOperand: true,
      };
    });
  }, []);

  // ── 등호 ───────────────────────────────────────────────────────
  const inputEquals = useCallback(() => {
    setCalc((prev) => {
      if (!prev.operator || prev.previousValue === null) return prev;
      const current = parseFloat(prev.display);
      const result = evaluate(prev.previousValue, prev.operator, current);
      if (result === null) {
        return { ...INITIAL_STATE, display: 'Error', expression: '' };
      }
      const resultStr = formatResult(result);
      return {
        display: resultStr,
        expression: `${prev.expression}${prev.display} =`,
        previousValue: null,
        operator: null,
        justEvaluated: true,
        waitingForOperand: false,
      };
    });
  }, []);

  // ── AC (전체 초기화) ───────────────────────────────────────────
  const handleAC = useCallback(() => {
    setCalc(INITIAL_STATE);
  }, []);

  // ── 백스페이스 ─────────────────────────────────────────────────
  const handleBackspace = useCallback(() => {
    setCalc((prev) => {
      if (prev.justEvaluated) return INITIAL_STATE;
      if (prev.display.length <= 1 || prev.display === 'Error') {
        return { ...prev, display: '0' };
      }
      return { ...prev, display: prev.display.slice(0, -1) };
    });
  }, []);

  // ── "이 결과 사용" ─────────────────────────────────────────────
  const handleUseResult = useCallback(() => {
    if (onUseResult && calc.display !== 'Error') {
      onUseResult(calc.display);
    }
  }, [onUseResult, calc.display]);

  // ── 키보드 이벤트 ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasFocus) return;

    const handler = (e: KeyboardEvent) => {
      // 퀴즈 전체 키보드 핸들러와 충돌 방지: 계산기 포커스 중에만 처리
      const digits = '0123456789';
      if (digits.includes(e.key)) {
        e.stopPropagation();
        inputDigit(e.key);
      } else if (e.key === '.') {
        e.stopPropagation();
        inputDigit('.');
      } else if (e.key === '+') {
        e.stopPropagation();
        inputOperator('+');
      } else if (e.key === '-') {
        e.stopPropagation();
        inputOperator('-');
      } else if (e.key === '*') {
        e.stopPropagation();
        inputOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        inputOperator('÷');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        inputEquals();
      } else if (e.key === 'Backspace') {
        e.stopPropagation();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        handleAC();
      }
    };

    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [hasFocus, inputDigit, inputOperator, inputEquals, handleBackspace, handleAC]);

  // ── 키패드 레이아웃 정의 ───────────────────────────────────────
  // 4열 × 5행
  // [ AC ] [ ⌫ ] [ ÷ ] [ × ]
  // [  7 ] [  8 ] [  9 ] [ - ]
  // [  4 ] [  5 ] [  6 ] [ + ]
  // [  1 ] [  2 ] [  3 ] [   ]
  // [  0      ] [  . ] [ = ]

  type KeyDef =
    | { label: string; action: () => void; variant: 'number' | 'operator' | 'action' | 'equals'; wide?: boolean }

  const keys: KeyDef[] = [
    { label: 'AC',  action: handleAC,                       variant: 'action' },
    { label: '⌫',  action: handleBackspace,                 variant: 'action' },
    { label: '÷',  action: () => inputOperator('÷'),        variant: 'operator' },
    { label: '×',  action: () => inputOperator('×'),        variant: 'operator' },
    { label: '7',  action: () => inputDigit('7'),            variant: 'number' },
    { label: '8',  action: () => inputDigit('8'),            variant: 'number' },
    { label: '9',  action: () => inputDigit('9'),            variant: 'number' },
    { label: '-',  action: () => inputOperator('-'),         variant: 'operator' },
    { label: '4',  action: () => inputDigit('4'),            variant: 'number' },
    { label: '5',  action: () => inputDigit('5'),            variant: 'number' },
    { label: '6',  action: () => inputDigit('6'),            variant: 'number' },
    { label: '+',  action: () => inputOperator('+'),         variant: 'operator' },
    { label: '1',  action: () => inputDigit('1'),            variant: 'number' },
    { label: '2',  action: () => inputDigit('2'),            variant: 'number' },
    { label: '3',  action: () => inputDigit('3'),            variant: 'number' },
    // 마지막 행: 0(넓게), ., =
    { label: '0',  action: () => inputDigit('0'),            variant: 'number', wide: true },
    { label: '.',  action: () => inputDigit('.'),            variant: 'number' },
    { label: '=',  action: inputEquals,                     variant: 'equals' },
  ];

  // ── 키 스타일 (PharmaEdu 디자인 토큰: primary 블루 + slate + white) ─────
  // h-12: 모바일 터치 타깃 최소 44px 충족
  const keyBase =
    'flex items-center justify-center rounded-lg text-base font-semibold select-none ' +
    'transition-all duration-100 active:scale-95 cursor-pointer h-12 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';

  const keyVariantClass: Record<KeyDef['variant'], string> = {
    // 숫자: 화이트 카드 + 슬레이트 텍스트 + 부드러운 호버
    number:
      'bg-white border border-border-medium text-text-primary hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700',
    // 연산자: primary 50 톤 + primary 텍스트 (시그니처 블루)
    operator:
      'bg-primary-50 border border-primary-200 text-primary-600 text-base hover:bg-primary-100 hover:border-primary-400 hover:text-primary-700',
    // 보조 동작 (AC/⌫): 뉴트럴 + 미묘한 포인트
    action:
      'bg-neutral-100 border border-neutral-200 text-text-secondary hover:bg-neutral-200 hover:text-text-primary hover:border-neutral-300',
    // 등호: primary 솔리드 강조
    equals:
      'bg-primary-500 text-white text-base hover:bg-primary-600 active:bg-primary-700 border border-primary-600 shadow-sm',
  };

  // ── 렌더 ───────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onFocus={() => setHasFocus(true)}
      onBlur={(e) => {
        // 자식 요소로 포커스가 이동하는 경우는 hasFocus 유지
        if (!rootRef.current?.contains(e.relatedTarget as Node)) {
          setHasFocus(false);
        }
      }}
      className={[
        'rounded-xl border p-3 sm:p-3.5 space-y-2.5 outline-none shadow-sm',
        'bg-bg-surface border-border-medium',
        'w-full max-w-sm mx-auto',
        hasFocus ? 'ring-2 ring-primary-500/30 border-primary-300' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="간단 계산기"
      role="application"
    >
      {/* 헤더 — 타이틀 + 닫기 */}
      <div className="flex items-center justify-between -mt-0.5 -mx-0.5">
        <div className="flex items-center gap-1.5 px-1">
          <Calculator className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-xs font-semibold text-text-secondary">계산기</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-neutral-100 transition-colors"
            aria-label="계산기 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 디스플레이 — 라이트 뉴트럴 배경 (C-1 수정: --color-bg-sidebar 제거) */}
      <div
        className="bg-neutral-100 border border-border-light rounded-lg px-3 py-2.5 space-y-1 shadow-inner"
      >
        {/* 식 표시줄 */}
        <div className="text-right text-xs text-text-muted font-mono min-h-[16px] truncate">
          {calc.expression || '\u00a0'}
        </div>
        {/* 현재값 */}
        <div
          className={[
            'text-right font-mono font-bold tracking-wide',
            calc.display.length > 10 ? 'text-lg' : 'text-2xl',
            calc.display === '0' ? 'text-text-muted' : 'text-text-primary',
          ].join(' ')}
          aria-live="polite"
          aria-atomic="true"
        >
          {calc.display}
        </div>
      </div>

      {/* 키패드 */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        {keys.map((k) =>
          k.wide ? (
            <button
              key={k.label}
              onClick={k.action}
              className={[keyBase, keyVariantClass[k.variant], 'col-span-2'].join(' ')}
              aria-label={k.label}
            >
              {k.label}
            </button>
          ) : (
            <button
              key={k.label}
              onClick={k.action}
              className={[keyBase, keyVariantClass[k.variant]].join(' ')}
              aria-label={k.label}
            >
              {k.label === '⌫' ? <Delete className="w-3.5 h-3.5" /> : k.label}
            </button>
          )
        )}
      </div>

      {/* "이 값 사용하기" 버튼 (P1-5: Error만 비활성, 0 포함 정상 사용 가능) */}
      {onUseResult && (
        <button
          onClick={handleUseResult}
          disabled={calc.display === 'Error'}
          className={[
            'w-full py-2 rounded-lg text-xs font-semibold transition-all duration-150',
            'border',
            calc.display === 'Error'
              ? 'bg-neutral-100 border-neutral-200 text-text-disabled cursor-not-allowed'
              : 'bg-primary-500 text-white border border-primary-600 hover:bg-primary-600 shadow-sm cursor-pointer active:scale-[0.98]',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="계산 결과를 답안 입력란에 사용"
        >
          이 값 사용하기 → {calc.display !== 'Error' ? calc.display : ''}
        </button>
      )}

      {/* 키보드 힌트 (P1-6) */}
      <p className="flex items-center justify-center gap-1 text-xs text-text-muted select-none">
        {hasFocus && (
          <span className="w-1.5 h-1.5 bg-success-500 rounded-full flex-shrink-0" />
        )}
        {hasFocus
          ? '키보드 활성 중 · Esc로 초기화'
          : '클릭하면 키보드 입력 활성화'}
      </p>
    </div>
  );
}
