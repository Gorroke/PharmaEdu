'use client';

/**
 * InlineCalculator.tsx
 * 레슨 콘텐츠에 임베드 가능한 인라인 계산기 위젯
 * 마커: <!-- INLINE_CALCULATOR:preset=... -->
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { CalcResult } from '@/lib/calc-engine';
import type { DrugItem } from '@/lib/calc-engine';

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

interface PresetConfig {
  title: string;
  description: string;
  /** /api/calculate 에 전달할 기본 CalcOptions (약품 1종 단순화) */
  buildOptions: (values: Record<string, string | number>) => object;
  fields: FieldConfig[];
  displayFields: Array<
    'drugAmount' | 'dispensingFee' | 'totalPrice' | 'userPrice' | 'pubPrice' | 'steps' | 'wageList'
  >;
}

// ─── 프리셋 정의 (6종) ───────────────────────────────────────────────────────

const PRESETS: Record<string, PresetConfig> = {
  /** 1. 간단한 약품금액 계산 */
  'simple-basic': {
    title: '간단한 약품금액 계산',
    description: '1회 투약량·단가·일수를 바꿔보세요. 약품금액 = 단가 × 1회량 × 1일횟수 × 투여일수',
    fields: [
      { key: 'price', label: '단가 (원)', type: 'number', min: 1, step: 10 },
      { key: 'dose',  label: '1회 투약량', type: 'number', min: 0.5, step: 0.5 },
      { key: 'dnum',  label: '1일 투여횟수', type: 'number', min: 1, max: 6 },
      { key: 'dday',  label: '총 투여일수', type: 'number', min: 1, max: 365 },
    ],
    buildOptions: (v) => ({
      insuCode: 'C10',
      age: 45,
      dosDate: todayStr(),
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price:  Number(v.price ?? 500),
          dose:   Number(v.dose  ?? 1),
          dNum:   Number(v.dnum  ?? 3),
          dDay:   Number(v.dday  ?? 7),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['drugAmount'],
  },

  /** 2. Lesson 3 — 약품금액 기초 실습 */
  'drug-amount-basic': {
    title: 'Lesson 3 — 약품금액 계산 실습',
    description: '건강보험(C10) 기준으로 약품금액과 본인부담금까지 확인합니다.',
    fields: [
      { key: 'price', label: '단가 (원)', type: 'number', min: 1, step: 10 },
      { key: 'dose',  label: '1회 투약량', type: 'number', min: 0.5, step: 0.5 },
      { key: 'dnum',  label: '1일 투여횟수', type: 'number', min: 1, max: 6 },
      { key: 'dday',  label: '총 투여일수', type: 'number', min: 1, max: 365 },
      { key: 'age',   label: '환자 나이', type: 'number', min: 0, max: 120 },
    ],
    buildOptions: (v) => ({
      insuCode: 'C10',
      age: Number(v.age ?? 45),
      dosDate: todayStr(),
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price:  Number(v.price ?? 500),
          dose:   Number(v.dose  ?? 1),
          dNum:   Number(v.dnum  ?? 3),
          dDay:   Number(v.dday  ?? 7),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['drugAmount', 'dispensingFee', 'totalPrice', 'userPrice', 'pubPrice'],
  },

  /** 3. 조제료(Z코드) 세부 보기 */
  'dispensing-fee-view': {
    title: '조제료 Z코드 세부 내역',
    description: '투여일수와 나이에 따라 Z코드 조제료가 어떻게 구성되는지 확인하세요.',
    fields: [
      { key: 'dday', label: '총 투여일수', type: 'number', min: 1, max: 365 },
      { key: 'age',  label: '환자 나이',   type: 'number', min: 0, max: 120 },
      {
        key: 'isSaturday', label: '토요일 조제', type: 'select',
        options: [{ value: '0', label: '평일' }, { value: '1', label: '토요일' }],
      },
      {
        key: 'isNight', label: '야간 조제', type: 'select',
        options: [{ value: '0', label: '주간' }, { value: '1', label: '야간' }],
      },
    ],
    buildOptions: (v) => ({
      insuCode: 'C10',
      age: Number(v.age ?? 45),
      dosDate: todayStr(),
      isSaturday: v.isSaturday === '1' || v.isSaturday === 1,
      isNight:    v.isNight    === '1' || v.isNight    === 1,
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price: 500,
          dose: 1,
          dNum: 3,
          dDay: Number(v.dday ?? 7),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['dispensingFee', 'wageList', 'steps'],
  },

  /** 4. 나이별 본인부담 비교 슬라이더 */
  'copayment-compare': {
    title: '나이별 본인부담금 비교',
    description: '나이 슬라이더를 움직여 65세 전후 본인부담 차이를 체험하세요.',
    fields: [
      { key: 'age',   label: '환자 나이 (0~100)', type: 'number', min: 0, max: 100 },
      { key: 'price', label: '단가 (원)', type: 'number', min: 1, step: 10 },
      { key: 'dday',  label: '총 투여일수', type: 'number', min: 1, max: 90 },
    ],
    buildOptions: (v) => ({
      insuCode: 'C10',
      age: Number(v.age ?? 70),
      dosDate: todayStr(),
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price: Number(v.price ?? 300),
          dose:  1,
          dNum:  2,
          dDay:  Number(v.dday ?? 3),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['drugAmount', 'dispensingFee', 'totalPrice', 'userPrice', 'pubPrice'],
  },

  /** 5. 보험 유형 선택기 */
  'insurance-compare': {
    title: '보험 유형별 본인부담 비교',
    description: '보험 유형(건강보험·의료급여·산재 등)을 바꿔 본인부담 차이를 비교합니다.',
    fields: [
      {
        key: 'insuCode', label: '보험 유형', type: 'select',
        options: [
          { value: 'C10', label: '건강보험 (C10)' },
          { value: 'D10', label: '의료급여 1종 (D10)' },
          { value: 'D20', label: '의료급여 2종 (D20)' },
          { value: 'E10', label: '산재 (E10)' },
          { value: 'F10', label: '자동차보험 (F10)' },
        ],
      },
      { key: 'age',   label: '환자 나이', type: 'number', min: 0, max: 120 },
      { key: 'price', label: '단가 (원)',  type: 'number', min: 1, step: 10 },
      { key: 'dday',  label: '투여일수',  type: 'number', min: 1, max: 90 },
    ],
    buildOptions: (v) => ({
      insuCode: String(v.insuCode ?? 'C10'),
      age: Number(v.age ?? 45),
      dosDate: todayStr(),
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price: Number(v.price ?? 500),
          dose:  1,
          dNum:  3,
          dDay:  Number(v.dday ?? 7),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['drugAmount', 'dispensingFee', 'totalPrice', 'userPrice', 'pubPrice'],
  },

  /** 6. S01 전체 시나리오 */
  'scenario-s01': {
    title: 'S01 — 일반 건보 3일 전체 계산',
    description: 'C10, 45세, 내복약 2종 3일 처방. 약품금액·조제료·본인부담·청구액 전 단계 확인.',
    fields: [
      { key: 'age',    label: '환자 나이', type: 'number', min: 0, max: 120 },
      { key: 'price1', label: '약품1 단가 (원)', type: 'number', min: 1, step: 10 },
      { key: 'price2', label: '약품2 단가 (원)', type: 'number', min: 1, step: 10 },
      { key: 'dday',   label: '투여일수', type: 'number', min: 1, max: 90 },
    ],
    buildOptions: (v) => ({
      insuCode: 'C10',
      age: Number(v.age ?? 45),
      dosDate: todayStr(),
      drugList: [
        {
          code: '648901070',
          insuPay: 'covered',
          take: 'internal',
          price: Number(v.price1 ?? 500),
          dose: 1, dNum: 3,
          dDay: Number(v.dday ?? 3),
          insuDrug: true,
        } satisfies DrugItem,
        {
          code: '648902080',
          insuPay: 'covered',
          take: 'internal',
          price: Number(v.price2 ?? 300),
          dose: 1, dNum: 3,
          dDay: Number(v.dday ?? 3),
          insuDrug: true,
        } satisfies DrugItem,
      ],
    }),
    displayFields: ['drugAmount', 'dispensingFee', 'totalPrice', 'userPrice', 'pubPrice', 'steps', 'wageList'],
  },
};

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().replace(/-/g, '').substring(0, 8);
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

// ─── 기본값 추출 ─────────────────────────────────────────────────────────────

function getInitialValues(cfg: PresetConfig): Record<string, string | number> {
  const defaults: Record<string, string | number> = {
    price: 500, price1: 500, price2: 300,
    dose: 1, dnum: 3, dday: 7, age: 45,
    insuCode: 'C10', isSaturday: '0', isNight: '0',
  };
  const result: Record<string, string | number> = {};
  for (const f of cfg.fields) {
    if (f.type === 'select' && f.options && f.options.length > 0) {
      result[f.key] = f.options[0].value;
    } else {
      result[f.key] = defaults[f.key] ?? (f.min ?? 1);
    }
  }
  return result;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface InlineCalculatorProps {
  preset: string;
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
}

export function InlineCalculator({
  preset,
  title: titleOverride,
  description: descOverride,
  defaultExpanded = true,
}: InlineCalculatorProps) {
  const cfg = PRESETS[preset];

  // ── 알 수 없는 프리셋 폴백 ─────────────────────────────────────────────────
  if (!cfg) {
    return (
      <div className="my-6 rounded-xl border border-border-light bg-bg-panel p-4 text-sm text-text-muted">
        Calculator not available (unknown preset: <code>{preset}</code>)
      </div>
    );
  }

  return <CalculatorWidget cfg={cfg} titleOverride={titleOverride} descOverride={descOverride} defaultExpanded={defaultExpanded} />;
}

// ─── 실제 위젯 (cfg가 확정된 뒤) ─────────────────────────────────────────────

function CalculatorWidget({
  cfg,
  titleOverride,
  descOverride,
  defaultExpanded,
}: {
  cfg: PresetConfig;
  titleOverride?: string;
  descOverride?: string;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [values, setValues] = useState<Record<string, string | number>>(() => getInitialValues(cfg));
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doCalc = useCallback(async (vals: Record<string, string | number>) => {
    setLoading(true);
    setError(null);
    try {
      const body = cfg.buildOptions(vals);
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as CalcResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? '계산 오류');
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [cfg]);

  // 값 변경 → 300ms 디바운스
  useEffect(() => {
    if (!expanded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doCalc(values);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values, expanded, doCalc]);

  function handleChange(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  function handleReset() {
    const init = getInitialValues(cfg);
    setValues(init);
    setResult(null);
    setError(null);
  }

  const title = titleOverride ?? cfg.title;
  const desc  = descOverride  ?? cfg.description;
  const show  = cfg.displayFields;

  return (
    <div className="my-8">
      <Card variant="outlined" className="!p-0 bg-primary-50 border-border-medium rounded-2xl overflow-hidden">
        {/* ── 헤더 ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left
                     hover:bg-primary-100/60 transition-colors duration-150
                     focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset outline-none"
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🧮</span>
            <span className="text-base font-semibold text-text-primary">{title}</span>
          </span>
          <span
            className={`text-text-muted text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▲
          </span>
        </button>

        {/* ── 본문 ─────────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-border-light">
            {/* 설명 */}
            <p className="px-5 py-3 text-sm text-text-secondary bg-white border-b border-border-light">
              {desc}
            </p>

            {/* 2컬럼: 입력 + 결과 */}
            <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border-light">
              {/* 왼쪽: 입력 필드 */}
              <div className="flex-1 p-5 bg-white space-y-3">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">입력값</p>
                {cfg.fields.map((f) => {
                  const val = String(values[f.key] ?? '');
                  if (f.type === 'select' && f.options) {
                    return (
                      <Select
                        key={f.key}
                        label={f.label}
                        options={f.options}
                        value={val}
                        onChange={(e) => handleChange(f.key, e.target.value)}
                      />
                    );
                  }
                  return (
                    <Input
                      key={f.key}
                      label={f.label}
                      type="number"
                      value={val}
                      min={f.min}
                      max={f.max}
                      step={f.step ?? 1}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                    />
                  );
                })}
              </div>

              {/* 오른쪽: 결과 */}
              <div className="flex-1 p-5 bg-primary-50/60 flex flex-col">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">계산 결과</p>

                {loading && (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-sm text-text-muted animate-pulse">계산 중...</span>
                  </div>
                )}

                {error && !loading && (
                  <div className="rounded-lg bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
                    {error}
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-2">
                    {show.includes('drugAmount') && (
                      <ResultRow label="약품금액 (01항)" value={fmt(result.sumInsuDrug)} highlight />
                    )}
                    {show.includes('dispensingFee') && (
                      <ResultRow label="조제료 (02항)" value={fmt(result.sumWage)} />
                    )}
                    {show.includes('totalPrice') && (
                      <ResultRow label="요양급여비용총액" value={fmt(result.totalPrice)} />
                    )}
                    {show.includes('userPrice') && (
                      <ResultRow label="본인일부부담금" value={fmt(result.userPrice)} accent />
                    )}
                    {show.includes('pubPrice') && (
                      <ResultRow label="청구액 (공단)" value={fmt(result.pubPrice)} />
                    )}

                    {/* Z코드 세부내역 */}
                    {show.includes('wageList') && result.wageList && result.wageList.length > 0 && (
                      <div className="mt-3 rounded-lg border border-border-light bg-white overflow-hidden">
                        <p className="px-3 py-1.5 text-xs font-semibold text-text-muted bg-bg-panel border-b border-border-light">
                          조제료 세부 (Z코드)
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-bg-panel text-text-muted">
                              <th className="text-left px-3 py-1.5 font-medium">코드</th>
                              <th className="text-left px-3 py-1.5 font-medium">항목명</th>
                              <th className="text-right px-3 py-1.5 font-medium">금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.wageList.map((w, i) => (
                              <tr key={i} className="border-t border-border-light">
                                <td className="px-3 py-1.5 font-mono text-primary-600">{w.sugaCd}</td>
                                <td className="px-3 py-1.5 text-text-secondary">{w.name}</td>
                                <td className="px-3 py-1.5 text-right text-text-primary">{fmt(w.sum)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 초기 상태 (결과 없음) */}
                {!result && !loading && !error && (
                  <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
                    값을 입력하면 자동 계산됩니다
                  </div>
                )}
              </div>
            </div>

            {/* 계산 단계 (교육용) */}
            {result && show.includes('steps') && result.steps && result.steps.length > 0 && (
              <div className="border-t border-border-light bg-white px-5 py-4">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                  onClick={() => setShowSteps((v) => !v)}
                >
                  <span>{showSteps ? '▼' : '▶'}</span>
                  계산 단계 {showSteps ? '접기' : '보기'}
                </button>
                {showSteps && (
                  <ol className="mt-3 space-y-2.5">
                    {result.steps.map((step, i) => (
                      <li key={i} className="rounded-lg border border-border-light bg-bg-panel px-4 py-3">
                        <p className="text-xs font-semibold text-text-primary mb-0.5">
                          {i + 1}. {step.title}
                        </p>
                        <p className="text-xs text-text-muted font-mono">{step.formula}</p>
                        <p className="text-sm font-bold text-primary-600 mt-1">
                          {step.result.toLocaleString('ko-KR')} {step.unit}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* 푸터 */}
            <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-border-light">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                초기값으로 리셋
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={loading}
                onClick={() => void doCalc(values)}
              >
                계산하기
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 결과 행 컴포넌트 ─────────────────────────────────────────────────────────

function ResultRow({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={[
      'flex justify-between items-center rounded-lg px-3 py-2',
      highlight ? 'bg-primary-100 border border-primary-200' :
      accent    ? 'bg-warning-50  border border-warning-200' :
                  'bg-white border border-border-light',
    ].join(' ')}>
      <span className={`text-sm ${highlight || accent ? 'font-semibold' : 'font-medium'} text-text-secondary`}>
        {label}
      </span>
      <span className={`text-sm font-bold ${
        highlight ? 'text-primary-700' :
        accent    ? 'text-warning-700' :
                    'text-text-primary'
      }`}>
        {value}
      </span>
    </div>
  );
}
