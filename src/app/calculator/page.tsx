'use client';

/**
 * /calculator — 조제료 계산기 페이지 (Phase D: 19개 시나리오 + 확장 입력)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Calculator, ChevronDown, ChevronUp,
  FlaskConical, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import type { CalcResult, DrugItem } from '@/lib/calc-engine';
import { SCENARIOS, SCENARIO_GROUPS } from '@/components/calculator/scenarios';

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface DrugRow {
  id: number;
  code: string;
  price: string;
  dose: string;
  dNum: string;
  dDay: string;
  insuPay: string;
  take: string;
  isPowder: string; // "1" | ""
}

// ─── 상수: 드롭다운 옵션 ───────────────────────────────────────────────────

const INSU_PAY_OPTIONS = [
  { value: 'covered',    label: '급여' },
  { value: 'nonCovered', label: '비급여' },
  { value: 'fullSelf',   label: '100%본인' },
  { value: 'partial50',  label: '선별50%' },
  { value: 'partial80',  label: '선별80%' },
  { value: 'partial30',  label: 'D항 선별30%' },
  { value: 'partial90',  label: 'E항 선별90%' },
  { value: 'veteran100', label: 'V항 보훈100/100' },
];

const TAKE_OPTIONS = [
  { value: 'internal',  label: '내복' },
  { value: 'external',  label: '외용' },
  { value: 'injection', label: '주사' },
];

const INSU_CODE_OPTIONS = [
  { value: 'C10', label: 'C10 — 건강보험 일반' },
  { value: 'C11', label: 'C11 — 건강보험 (기타)' },
  { value: 'C20', label: 'C20 — 공무원재해보상' },
  { value: 'C21', label: 'C21 — 공상' },
  { value: 'C31', label: 'C31 — 차상위' },
  { value: 'C32', label: 'C32 — 차상위 (기타)' },
  { value: 'C80', label: 'C80 — 건강보험 (기타2)' },
  { value: 'C90', label: 'C90 — 건강보험 (기타3)' },
  { value: 'D10', label: 'D10 — 의료급여 1종' },
  { value: 'D20', label: 'D20 — 의료급여 2종' },
  { value: 'D40', label: 'D40 — 의료급여 4종' },
  { value: 'D80', label: 'D80 — 의료급여 8종 (행려)' },
  { value: 'D90', label: 'D90 — 의료급여 기타' },
  { value: 'G10', label: 'G10 — 보훈 (직접)' },
  { value: 'G20', label: 'G20 — 보훈 (위탁)' },
  { value: 'F10', label: 'F10 — 자동차보험' },
  { value: 'E10', label: 'E10 — 산재 요양급여' },
  { value: 'E20', label: 'E20 — 산재 후유증' },
];

const BOHUN_CODE_OPTIONS = [
  { value: '',    label: '(없음)' },
  { value: 'M10', label: 'M10 — 전액면제' },
  { value: 'M20', label: 'M20 — 일부면제' },
  { value: 'M30', label: 'M30 — 30% 감면' },
  { value: 'M50', label: 'M50 — 50% 감면' },
  { value: 'M60', label: 'M60 — 60% 감면' },
  { value: 'M61', label: 'M61 — 60% 감면 (기타)' },
  { value: 'M81', label: 'M81 — 보훈특례A' },
  { value: 'M82', label: 'M82 — 보훈특례B' },
  { value: 'M83', label: 'M83 — 보훈특례C' },
  { value: 'M90', label: 'M90 — 보훈 기타' },
];

const SBRDN_TYPE_OPTIONS = [
  { value: '',     label: '(없음/기본)' },
  { value: 'B001', label: 'B001' },
  { value: 'B014', label: 'B014 — 희귀질환 30%' },
  { value: 'B030', label: 'B030' },
  { value: 'V103', label: 'V103 — 결핵 면제' },
];

const GENDER_OPTIONS = [
  { value: '',  label: '무관' },
  { value: 'M', label: '남(M)' },
  { value: 'F', label: '여(F)' },
];

// ── 고급 옵션 드롭다운 ─────────────────────────────────────────────────────

const MT038_OPTIONS = [
  { value: '',  label: '(해당 없음)' },
  { value: '2', label: '2 — 국비환자 타질환 조제분' },
  { value: 'A', label: 'A — 60% 감면 (도서벽지 내 약국)' },
];

const NPAY_ROUND_OPTIONS = [
  { value: '',          label: '(기본값)' },
  { value: 'None',      label: 'None — 반올림 없음' },
  { value: 'Floor10',   label: 'Floor10 — 10원 절사' },
  { value: 'Floor100',  label: 'Floor100 — 100원 절사' },
  { value: 'Round10',   label: 'Round10 — 10원 반올림' },
  { value: 'Round100',  label: 'Round100 — 100원 반올림' },
  { value: 'Ceil100',   label: 'Ceil100 — 100원 올림' },
];

const SPECIAL_PUB_OPTIONS = [
  { value: '',    label: '(해당 없음)' },
  { value: '302', label: '302 — 100% 본인부담약품 공비 전환' },
  { value: '101', label: '101 — 특수공비 분리 A' },
  { value: '102', label: '102 — 특수공비 분리 B' },
];

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function formatWon(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

let _idSeq = 0;
function nextId() { return ++_idSeq; }

function defaultDrugRow(): DrugRow {
  return {
    id: nextId(),
    code: '', price: '', dose: '1', dNum: '3', dDay: '7',
    insuPay: 'covered', take: 'internal', isPowder: '',
  };
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export default function CalculatorPage() {

  // ── 기본 입력 ──
  const [dosDate, setDosDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [insuCode, setInsuCode] = useState('C10');
  const [bohunCode, setBohunCode] = useState('');
  const [sbrdnType, setSbrdnType] = useState('');
  const [age, setAge] = useState('40');
  const [gender, setGender] = useState('');
  const [mediIllness, setMediIllness] = useState('');
  const [mediIllnessB, setMediIllnessB] = useState('');
  const [drugs, setDrugs] = useState<DrugRow[]>([defaultDrugRow()]);

  // ── 가산 체크박스 ──
  const [isNight, setIsNight] = useState(false);
  const [isHolyDay, setIsHolyDay] = useState(false);
  const [isSaturday, setIsSaturday] = useState(false);
  const [isMidNight, setIsMidNight] = useState(false);
  const [isDirectDispensing, setIsDirectDispensing] = useState(false);
  const [isNonFace, setIsNonFace] = useState(false);
  const [hasCounseling, setHasCounseling] = useState(false);
  const [isDalbitPharmacy, setIsDalbitPharmacy] = useState(false);

  // ── 고급 옵션 ──
  const [selfInjYN, setSelfInjYN] = useState('');
  const [mt038, setMt038] = useState('');
  const [nPayRoundType, setNPayRoundType] = useState('');
  const [specialPub, setSpecialPub] = useState('');
  const [isChadungExempt, setIsChadungExempt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── 결과 ──
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(true);
  const [showWageList, setShowWageList] = useState(true);
  const [showNewFields, setShowNewFields] = useState(true);

  // ── 시나리오 탭 ──
  const [activeGroup, setActiveGroup] = useState(0);

  // ── 파생값: 보훈코드 활성 여부 ──
  const isBohunInsu = useMemo(
    () => insuCode.startsWith('G') || insuCode.startsWith('C'),
    [insuCode]
  );

  // ── 6세미만 자동 판정 ──
  const parsedAge = parseInt(age, 10) || 0;
  const isUnder6 = parsedAge >= 0 && parsedAge < 6;

  // ── 약품 행 조작 ──────────────────────────────────────────────────────────

  const addDrugRow = useCallback(() => {
    setDrugs((prev) => [...prev, defaultDrugRow()]);
  }, []);

  const removeDrugRow = useCallback((id: number) => {
    setDrugs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const updateDrug = useCallback((id: number, field: keyof DrugRow, value: string) => {
    setDrugs((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }, []);

  // ── 시나리오 프리셋 적용 ──────────────────────────────────────────────────

  const applyScenario = useCallback((id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;

    setInsuCode(sc.insuCode);
    setBohunCode(sc.bohunCode ?? '');
    setAge(sc.age);
    setSbrdnType(sc.sbrdnType ?? '');
    setIsNight(sc.isNight);
    setIsSaturday(sc.isSaturday);
    setIsHolyDay(sc.isHolyDay);
    setIsMidNight(sc.isMidNight);
    setIsDirectDispensing(sc.isDirectDispensing);
    setIsDalbitPharmacy(sc.isDalbitPharmacy);
    setHasCounseling(false);
    setIsNonFace(false);
    setMediIllness('');
    setMediIllnessB('');
    setGender('');
    // 고급 옵션 초기화
    setSelfInjYN('');
    setMt038('');
    setNPayRoundType('');
    setSpecialPub('');
    setIsChadungExempt(false);

    setDrugs(
      sc.drugs.map((d) => ({
        id: nextId(),
        code: d.code,
        price: String(d.price),
        dose: String(d.dose),
        dNum: String(d.dNum),
        dDay: String(d.dDay),
        insuPay: d.insuPay,
        take: d.take,
        isPowder: d.isPowder ?? '',
      }))
    );

    setResult(null);
    setError(null);
  }, []);

  // ── 계산 실행 ─────────────────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const drugList: DrugItem[] = drugs
        .filter((d) => d.price !== '' && parseFloat(d.price) >= 0)
        .map((d) => ({
          code: d.code || 'unknown',
          insuPay: d.insuPay as DrugItem['insuPay'],
          take: d.take as DrugItem['take'],
          price: parseFloat(d.price) || 0,
          dose: parseFloat(d.dose) || 1,
          dNum: parseFloat(d.dNum) || 1,
          dDay: parseFloat(d.dDay) || 1,
          pack: 0,
          isPowder: d.isPowder || undefined,
          insuDrug: d.insuPay === 'covered',
        }));

      if (drugList.length === 0) {
        setError('약품을 1개 이상 입력해주세요.');
        setLoading(false);
        return;
      }

      const body: Record<string, unknown> = {
        dosDate: dosDate.replace(/-/g, ''),
        insuCode,
        age: parsedAge,
        sex: gender || undefined,
        drugList,
        // 가산
        isNight: isNight || undefined,
        isHolyDay: isHolyDay || undefined,
        isSaturday: isSaturday || undefined,
        isMidNight: isMidNight || undefined,
        // 특수 모드
        isDirectDispensing: isDirectDispensing || undefined,
        isNonFace: isNonFace || undefined,
        hasCounseling: hasCounseling || undefined,
        isDalbitPharmacy: isDalbitPharmacy || undefined,
        // 보훈
        bohunCode: bohunCode || undefined,
        // 의료급여
        sbrdnType: sbrdnType || undefined,
        // 산정특례
        mediIllness: mediIllness || undefined,
        mediIllnessB: mediIllnessB || undefined,
        // ── 고급 옵션 ──────────────────────────────────────────────────────
        selfInjYN: selfInjYN || undefined,
        mt038: mt038 || undefined,
        nPayRoundType: nPayRoundType || undefined,
        specialPub: specialPub || undefined,
        isChadungExempt: isChadungExempt || undefined,
      };

      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as CalcResult & { error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? '계산 중 오류가 발생했습니다.');
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [
    drugs, dosDate, insuCode, bohunCode, sbrdnType, parsedAge,
    isNight, isHolyDay, isSaturday, isMidNight,
    isDirectDispensing, isNonFace, hasCounseling, isDalbitPharmacy,
    mediIllness, mediIllnessB,
    selfInjYN, mt038, nPayRoundType, specialPub, isChadungExempt,
  ]);

  // ── 렌더링 ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              조제료 계산기
            </h1>
          </div>
          <p className="text-text-secondary text-sm ml-13">
            처방전 정보를 입력하면 약품금액·조제료·본인부담금을 단계별로 계산합니다.
          </p>
          <div className="mt-2 ml-13 flex flex-wrap gap-1.5">
            <Badge variant="info">C/D/G/E/F 전 보험코드</Badge>
            <Badge variant="neutral">19개 시나리오 프리셋</Badge>
            <Badge variant="primary">야간/공휴/토요/6세미만/보훈/직접조제</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ────────────── 입력 패널 ────────────── */}
          <div className="space-y-5">

            {/* 시나리오 프리셋 */}
            <Card variant="outlined">
              <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
                19개 테스트 시나리오 프리셋
              </p>

              {/* 카테고리 탭 */}
              <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                {SCENARIO_GROUPS.map((g, i) => (
                  <button
                    key={g.label}
                    onClick={() => setActiveGroup(i)}
                    className={[
                      'px-2.5 py-2 min-h-[36px] rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                      activeGroup === i
                        ? 'bg-primary-500 text-white'
                        : 'bg-bg-panel text-text-secondary hover:bg-primary-100 hover:text-primary-700',
                    ].join(' ')}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* 해당 그룹의 시나리오 버튼 */}
              <div className="flex flex-wrap gap-2">
                {SCENARIO_GROUPS[activeGroup].ids.map((sid) => {
                  const sc = SCENARIOS.find((s) => s.id === sid)!;
                  return (
                    <Button
                      key={sid}
                      variant="secondary"
                      size="sm"
                      onClick={() => applyScenario(sid)}
                      title={sc.description}
                      className="text-left justify-start"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                      <span className="font-medium text-text-primary text-xs">{sc.label}</span>
                    </Button>
                  );
                })}
              </div>

              {/* 선택된 시나리오 설명 힌트 */}
              <p className="text-xs text-text-muted mt-2">
                버튼을 클릭하면 모든 입력 필드가 시나리오 값으로 설정됩니다.
              </p>
            </Card>

            {/* 처방 기본 정보 */}
            <Card variant="standard">
              <h2 className="text-base font-semibold text-text-primary mb-4">처방 기본 정보</h2>

              {/* 1행: 날짜 + 보험코드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Input
                  label="조제일자"
                  type="date"
                  value={dosDate}
                  onChange={(e) => setDosDate(e.target.value)}
                />
                <Select
                  label="보험코드"
                  value={insuCode}
                  onChange={(e) => setInsuCode(e.target.value)}
                  options={INSU_CODE_OPTIONS}
                />
              </div>

              {/* 2행: 보훈코드 (G계열 / C계열일 때 활성) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Select
                  label="보훈코드"
                  value={bohunCode}
                  onChange={(e) => setBohunCode(e.target.value)}
                  options={BOHUN_CODE_OPTIONS}
                  disabled={!isBohunInsu}
                  helperText={isBohunInsu ? undefined : 'G계열/C계열 보험코드에서 활성'}
                />
                <Select
                  label="수급권자유형 (sbrdnType)"
                  value={sbrdnType}
                  onChange={(e) => setSbrdnType(e.target.value)}
                  options={SBRDN_TYPE_OPTIONS}
                />
              </div>

              {/* 3행: 나이 + 성별 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input
                  label="환자 나이 (세)"
                  type="number"
                  min="0"
                  max="150"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="예: 40"
                />
                <Select
                  label="성별"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  options={GENDER_OPTIONS}
                />
              </div>

              {/* 4행: 질병코드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Input
                  label="질병코드 (mediIllness)"
                  value={mediIllness}
                  onChange={(e) => setMediIllness(e.target.value)}
                  placeholder="예: V252"
                  helperText="산정특례 등록코드"
                />
                <Input
                  label="2차 질병코드 (mediIllnessB)"
                  value={mediIllnessB}
                  onChange={(e) => setMediIllnessB(e.target.value)}
                  placeholder="예: F008"
                  helperText="코로나 등 B코드"
                />
              </div>

              {/* 가산 체크박스 */}
              <div className="pt-4 border-t border-border-light">
                <p className="text-xs font-semibold text-text-muted mb-3">시간/특수 가산</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'isNight',    label: '야간',    desc: '평일 18시~, 토요 13시~',   value: isNight,    setter: setIsNight },
                    { id: 'isHolyDay', label: '공휴일', desc: '법정 공휴일',               value: isHolyDay,  setter: setIsHolyDay },
                    { id: 'isSaturday',label: '토요',    desc: '토요일 09~13시 별도 행',   value: isSaturday, setter: setIsSaturday },
                    { id: 'isMidNight',label: '심야',    desc: '0시~6시 (6세미만 전용)',   value: isMidNight, setter: setIsMidNight },
                  ].map(({ id, label, desc, value, setter }) => (
                    <CheckChip
                      key={id}
                      id={id}
                      label={label}
                      description={desc}
                      checked={value}
                      onChange={setter}
                    />
                  ))}
                </div>

                <p className="text-xs font-semibold text-text-muted mt-3 mb-2">조제 방식</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* 6세미만: 나이 자동 판정 — disabled 표시 */}
                  <label
                    className={[
                      'flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border text-xs',
                      isUnder6
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-border-light bg-bg-panel text-text-disabled',
                    ].join(' ')}
                    title="나이 입력 시 자동 적용됨"
                  >
                    <input
                      type="checkbox"
                      checked={isUnder6}
                      readOnly
                      disabled
                      className="accent-primary-500"
                      aria-label="6세 미만 (자동)"
                    />
                    <span className="font-medium">6세미만 (자동)</span>
                  </label>

                  {[
                    { id: 'isDirectDispensing', label: '직접조제',    desc: 'Z4200/Z4201 사용',    value: isDirectDispensing, setter: setIsDirectDispensing },
                    { id: 'isNonFace',          label: '비대면',      desc: '비대면 조제',          value: isNonFace,          setter: setIsNonFace },
                    { id: 'hasCounseling',      label: '복약상담료',  desc: 'Z7001 추가',          value: hasCounseling,      setter: setHasCounseling },
                    { id: 'isDalbitPharmacy',   label: '달빛어린이',  desc: '달빛어린이 약국',     value: isDalbitPharmacy,   setter: setIsDalbitPharmacy },
                  ].map(({ id, label, desc, value, setter }) => (
                    <CheckChip
                      key={id}
                      id={id}
                      label={label}
                      description={desc}
                      checked={value}
                      onChange={setter}
                    />
                  ))}
                </div>

                {/* 활성 가산 뱃지 미리보기 */}
                {(isNight || isHolyDay || isSaturday || isMidNight || isDirectDispensing
                  || isDalbitPharmacy || isNonFace || hasCounseling || isUnder6) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {isNight          && <Badge variant="info">야간가산</Badge>}
                    {isHolyDay        && <Badge variant="warning">공휴가산</Badge>}
                    {isSaturday       && <Badge variant="neutral">토요가산</Badge>}
                    {isMidNight       && <Badge variant="info">심야가산</Badge>}
                    {isUnder6         && <Badge variant="primary">6세미만(21%)</Badge>}
                    {isDirectDispensing && <Badge variant="primary">직접조제</Badge>}
                    {isDalbitPharmacy && <Badge variant="success">달빛어린이</Badge>}
                    {isNonFace        && <Badge variant="neutral">비대면</Badge>}
                    {hasCounseling    && <Badge variant="neutral">복약상담료</Badge>}
                  </div>
                )}
              </div>
            </Card>

            {/* 약품 목록 */}
            <Card variant="standard">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-text-primary">약품 목록</h2>
                <Button variant="ghost" size="sm" onClick={addDrugRow} aria-label="약품 추가">
                  <Plus className="w-4 h-4" />
                  추가
                </Button>
              </div>

              <div className="space-y-4">
                {drugs.map((drug, idx) => (
                  <div key={drug.id} className="p-3 rounded-lg bg-bg-panel border border-border-light">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-text-muted">약품 {idx + 1}</span>
                      {drugs.length > 1 && (
                        <button
                          onClick={() => removeDrugRow(drug.id)}
                          aria-label={`약품 ${idx + 1} 삭제`}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-error-500 transition-colors rounded-lg hover:bg-error-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* 코드 + 단가 */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Input
                        label="약품코드"
                        value={drug.code}
                        onChange={(e) => updateDrug(drug.id, 'code', e.target.value)}
                        placeholder="선택사항"
                      />
                      <Input
                        label="단가 (원)"
                        type="number"
                        min="0"
                        value={drug.price}
                        onChange={(e) => updateDrug(drug.id, 'price', e.target.value)}
                        placeholder="예: 500"
                        required
                      />
                    </div>

                    {/* 1회투약량 + 1일횟수 + 총일수 */}
                    <div className="grid grid-cols-3 xs:grid-cols-3 gap-2 mb-2">
                      <Input label="1회투약량"   type="number" min="0" step="0.5" value={drug.dose} onChange={(e) => updateDrug(drug.id, 'dose', e.target.value)} />
                      <Input label="1일횟수"     type="number" min="1"           value={drug.dNum} onChange={(e) => updateDrug(drug.id, 'dNum', e.target.value)} />
                      <Input label="총투여일수"  type="number" min="1"           value={drug.dDay} onChange={(e) => updateDrug(drug.id, 'dDay', e.target.value)} />
                    </div>

                    {/* 급여구분 + 복용구분 + 산제여부 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Select
                        label="급여구분"
                        value={drug.insuPay}
                        onChange={(e) => updateDrug(drug.id, 'insuPay', e.target.value)}
                        options={INSU_PAY_OPTIONS}
                      />
                      <Select
                        label="복용구분"
                        value={drug.take}
                        onChange={(e) => updateDrug(drug.id, 'take', e.target.value)}
                        options={TAKE_OPTIONS}
                      />
                      <Select
                        label="산제여부"
                        value={drug.isPowder}
                        onChange={(e) => updateDrug(drug.id, 'isPowder', e.target.value)}
                        options={[
                          { value: '',  label: '일반' },
                          { value: '1', label: '산제(가루)' },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCalculate}
                  loading={loading}
                  className="w-full"
                >
                  <Calculator className="w-5 h-5" />
                  계산하기
                </Button>
              </div>
            </Card>

            {/* ── 고급 옵션 ────────────────────────────────────────────── */}
            <Card variant="outlined">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-text-secondary"
                aria-expanded={showAdvanced}
              >
                <span>고급 옵션 (Phase A+B+C 신규 기능)</span>
                {showAdvanced
                  ? <ChevronUp className="w-4 h-4 text-text-muted" />
                  : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-text-muted">
                    기본 사용자는 무시해도 됩니다. calc-engine의 세부 동작을 제어합니다.
                  </p>

                  {/* 자가투여주사제 */}
                  <div className="flex items-center justify-between py-2 border-b border-border-light">
                    <div>
                      <p className="text-sm font-medium text-text-primary">자가투여주사제 (selfInjYN)</p>
                      <p className="text-xs text-text-muted">Z4130 수가 활성화 — 자가주사제 처방 시</p>
                    </div>
                    <CheckChip
                      id="selfInjYN"
                      label="Y"
                      description="자가투여주사제 여부"
                      checked={selfInjYN === 'Y'}
                      onChange={(v) => setSelfInjYN(v ? 'Y' : '')}
                    />
                  </div>

                  {/* 차등수가 면제 */}
                  <div className="flex items-center justify-between py-2 border-b border-border-light">
                    <div>
                      <p className="text-sm font-medium text-text-primary">차등수가 면제 (isChadungExempt)</p>
                      <p className="text-xs text-text-muted">영업시간 기반 차등수가 면제 여부 (C계열 건강보험)</p>
                    </div>
                    <CheckChip
                      id="isChadungExempt"
                      label="면제"
                      description="차등수가 면제 여부"
                      checked={isChadungExempt}
                      onChange={setIsChadungExempt}
                    />
                  </div>

                  {/* MT038 */}
                  <Select
                    label="보훈 MT038 특정내역 (G20 위탁 전용)"
                    value={mt038}
                    onChange={(e) => setMt038(e.target.value)}
                    options={MT038_OPTIONS}
                    disabled={insuCode !== 'G20'}
                    helperText={insuCode === 'G20' ? undefined : 'G20 (보훈 위탁) 보험코드에서만 활성'}
                  />

                  {/* 비급여 반올림 유형 */}
                  <Select
                    label="비급여 반올림 유형 (nPayRoundType)"
                    value={nPayRoundType}
                    onChange={(e) => setNPayRoundType(e.target.value)}
                    options={NPAY_ROUND_OPTIONS}
                  />

                  {/* 특수공비 */}
                  <Select
                    label="특수공비 (specialPub)"
                    value={specialPub}
                    onChange={(e) => setSpecialPub(e.target.value)}
                    options={SPECIAL_PUB_OPTIONS}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* ────────────── 결과 패널 ────────────── */}
          <div className="space-y-5">

            {/* 오류 */}
            {error && (
              <div className="flex items-start gap-2 bg-error-100 border border-error-500/30 rounded-xl p-4 text-sm text-error-500">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div><strong>오류:</strong> {error}</div>
              </div>
            )}

            {/* 초기 빈 상태 */}
            {!result && !error && !loading && (
              <Card variant="outlined" className="text-center py-12">
                <Calculator className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-text-muted text-sm">
                  왼쪽 폼을 작성하고 계산하기를 누르면<br />결과가 여기에 표시됩니다.
                </p>
                <p className="text-text-muted text-xs mt-2">
                  시나리오 프리셋을 선택하면 빠르게 테스트할 수 있습니다.
                </p>
              </Card>
            )}

            {/* 계산 결과 */}
            {result && (
              <>
                {/* 요약 카드 */}
                <Card variant="standard">
                  <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2 flex-wrap">
                    계산 결과
                    <Badge variant="success">완료</Badge>
                    {/* 서식번호 */}
                    {result.formNumber && (
                      <Badge variant="neutral">{result.formNumber}</Badge>
                    )}
                    {/* 보험 유형 뱃지 */}
                    {insuCode.startsWith('D') && <Badge variant="warning">의료급여</Badge>}
                    {(insuCode.startsWith('G') || bohunCode) && <Badge variant="info">보훈</Badge>}
                    {insuCode.startsWith('E') && <Badge variant="neutral">산재</Badge>}
                    {insuCode.startsWith('F') && <Badge variant="error">자동차보험</Badge>}
                    {/* 가산 뱃지 */}
                    {isNight      && <Badge variant="info">야간가산</Badge>}
                    {isHolyDay    && <Badge variant="warning">공휴가산</Badge>}
                    {isSaturday   && <Badge variant="neutral">토요가산</Badge>}
                    {isUnder6     && <Badge variant="primary">6세미만(21%)</Badge>}
                    {parsedAge >= 65 && <Badge variant="primary">65세이상</Badge>}
                    {isDirectDispensing && <Badge variant="primary">직접조제</Badge>}
                    {isDalbitPharmacy   && <Badge variant="success">달빛어린이</Badge>}
                  </h2>

                  <div className="space-y-3">
                    <ResultRow label="약품금액 (01항)"       value={result.sumInsuDrug} variant="neutral" />
                    <ResultRow label="조제료 (02항)"         value={result.sumWage}     variant="neutral" />
                    <div className="border-t border-border-light pt-3">
                      <ResultRow label="요양급여비용총액1"   value={result.totalPrice}  variant="primary" bold />
                    </div>
                    <div className="border-t border-border-light pt-3 space-y-3">
                      <ResultRow label="본인일부부담금"      value={result.userPrice}   variant="warning" bold />
                      <ResultRow label="청구액 (공단부담)"   value={result.pubPrice}    variant="success" bold />
                    </div>

                    {/* 보훈청 청구액 (G계열 또는 bohunCode 있을 때) */}
                    {result.mpvaPrice !== undefined && result.mpvaPrice > 0 && (
                      <div className="border-t border-border-light pt-3">
                        <ResultRow label="보훈청 청구액 (mpvaPrice)" value={result.mpvaPrice} variant="info" bold />
                      </div>
                    )}

                    {/* 자동차보험 할증 */}
                    {result.premium !== undefined && result.premium > 0 && (
                      <div className="border-t border-border-light pt-3">
                        <ResultRow label="자동차보험 할증액 (premium)" value={result.premium} variant="warning" bold />
                      </div>
                    )}

                    {/* 본인부담상한제 초과 */}
                    {result.overUserPrice !== undefined && result.overUserPrice > 0 && (
                      <div className="border-t border-border-light pt-3">
                        <ResultRow label="본인부담상한제 초과분" value={result.overUserPrice} variant="info" bold />
                      </div>
                    )}

                    {/* 항등식 확인 */}
                    <div className="bg-bg-panel rounded-lg px-3 py-2 text-xs text-text-muted font-mono">
                      {result.mpvaPrice && result.mpvaPrice > 0
                        ? <>항등식: {formatWon(result.totalPrice)} = {formatWon(result.mpvaPrice)} + {formatWon(result.userPrice)} + {formatWon(result.pubPrice)}{' '}
                            {result.totalPrice === result.mpvaPrice + result.userPrice + result.pubPrice ? '✓' : '✗ (불일치)'}</>
                        : <>항등식: {formatWon(result.totalPrice)} = {formatWon(result.userPrice)} + {formatWon(result.pubPrice)}{' '}
                            {result.totalPrice === result.userPrice + result.pubPrice ? '✓' : '✗ (불일치)'}</>
                      }
                    </div>

                    {/* 요양급여비용총액2 */}
                    {result.totalPrice2 !== undefined && (
                      <div className="border-t border-border-light pt-3">
                        <ResultRow label="요양급여비용총액2 (전자청구용)" value={result.totalPrice2} variant="primary" bold />
                      </div>
                    )}

                    {/* 3자배분 확정값 */}
                    {(result.sumUser !== undefined || result.sumInsure !== undefined || result.realPrice !== undefined) && (
                      <div className="border-t border-border-light pt-3 space-y-2">
                        <p className="text-xs font-semibold text-text-muted">3자배분 최종값</p>
                        {result.sumUser    !== undefined && <ResultRow label="최종 환자수납액 (sumUser)"    value={result.sumUser}    variant="warning" />}
                        {result.realPrice  !== undefined && <ResultRow label="실수납금 (realPrice)"         value={result.realPrice}  variant="warning" />}
                        {result.insuPrice  !== undefined && <ResultRow label="공단부담금 (insuPrice)"       value={result.insuPrice}  variant="success" />}
                        {result.sumInsure  !== undefined && <ResultRow label="최종 공단청구액 (sumInsure)"  value={result.sumInsure}  variant="success" />}
                      </div>
                    )}
                  </div>
                </Card>

                {/* ── 신규 상세 정보 카드 ─────────────────────────────── */}
                {(() => {
                  const isVeteran = insuCode.startsWith('G') || !!bohunCode;
                  const hasSbrdn = !!(
                    result.sumInsuDrug50 !== undefined ||
                    result.sumInsuDrug80 !== undefined ||
                    result.sumInsuDrug30 !== undefined ||
                    result.sumInsuDrug90 !== undefined
                  );
                  if (!isVeteran && !hasSbrdn) return null;

                  return (
                    <Card variant="standard">
                      <button
                        onClick={() => setShowNewFields((v) => !v)}
                        className="w-full flex items-center justify-between text-base font-semibold text-text-primary"
                      >
                        신규 상세 정보
                        {showNewFields
                          ? <ChevronUp className="w-4 h-4 text-text-muted" />
                          : <ChevronDown className="w-4 h-4 text-text-muted" />}
                      </button>

                      {showNewFields && (
                        <div className="mt-3 space-y-3">

                          {/* 보훈 전용 */}
                          {isVeteran && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-text-muted">보훈 전용</p>
                              {result.gsCode && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-text-secondary">공상등구분 (gsCode)</span>
                                  <Badge variant="info">{result.gsCode}</Badge>
                                </div>
                              )}
                              {result.mt038 !== undefined && result.mt038 !== '' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-text-secondary">MT038 (출력)</span>
                                  <Badge variant="neutral">{result.mt038}</Badge>
                                </div>
                              )}
                              {result.mpvaComm !== undefined && result.mpvaComm > 0 && (
                                <ResultRow label="보훈 비급여 감면분 (mpvaComm)" value={result.mpvaComm} variant="info" />
                              )}
                            </div>
                          )}

                          {/* 선별급여 전용 */}
                          {hasSbrdn && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-text-muted">선별급여 항별 약품금액</p>
                              {result.sumInsuDrug50 !== undefined && result.sumInsuDrug50 > 0 && (
                                <ResultRow label="A항 선별급여 50%" value={result.sumInsuDrug50} variant="neutral" />
                              )}
                              {result.sumInsuDrug80 !== undefined && result.sumInsuDrug80 > 0 && (
                                <ResultRow label="B항 선별급여 80%" value={result.sumInsuDrug80} variant="neutral" />
                              )}
                              {result.sumInsuDrug30 !== undefined && result.sumInsuDrug30 > 0 && (
                                <ResultRow label="D항 선별급여 30%" value={result.sumInsuDrug30} variant="neutral" />
                              )}
                              {result.sumInsuDrug90 !== undefined && result.sumInsuDrug90 > 0 && (
                                <ResultRow label="E항 선별급여 90%" value={result.sumInsuDrug90} variant="neutral" />
                              )}
                              {result.underUser !== undefined && (
                                <ResultRow label="선별급여 본인부담 합계 (underUser)" value={result.underUser} variant="warning" />
                              )}
                              {result.underInsu !== undefined && (
                                <ResultRow label="선별급여 공단부담 합계 (underInsu)" value={result.underInsu} variant="success" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {/* ── 100% 본인부담 약품 섹션 ────────────────────────── */}
                {(result.sumInsuDrug100 !== undefined ||
                  result.sumInsuDrug100_302 !== undefined ||
                  result.totalPrice100 !== undefined ||
                  result.userPrice100 !== undefined ||
                  result.pub100Price !== undefined ||
                  result.incentive !== undefined) && (
                  <Card variant="standard">
                    <h3 className="text-base font-semibold text-text-primary mb-3">
                      100% 본인부담 약품
                    </h3>
                    <div className="space-y-2">
                      {result.sumInsuDrug100 !== undefined && (
                        <ResultRow label="100% 본인부담 약품금액 (sumInsuDrug100)" value={result.sumInsuDrug100} variant="neutral" />
                      )}
                      {result.sumInsuDrug100_302 !== undefined && (
                        <ResultRow label="302 공비전환 약품금액 (sumInsuDrug100_302)" value={result.sumInsuDrug100_302} variant="neutral" />
                      )}
                      {result.totalPrice100 !== undefined && (
                        <ResultRow label="100% 급여비용총액 (totalPrice100)" value={result.totalPrice100} variant="primary" />
                      )}
                      {result.userPrice100 !== undefined && (
                        <ResultRow label="100% 본인부담금 (userPrice100)" value={result.userPrice100} variant="warning" bold />
                      )}
                      {result.pub100Price !== undefined && (
                        <ResultRow label="100% 공단부담금 (pub100Price)" value={result.pub100Price} variant="success" />
                      )}
                      {result.incentive !== undefined && (
                        <ResultRow label="인센티브 (incentive)" value={result.incentive} variant="info" />
                      )}
                    </div>
                  </Card>
                )}

                {/* 조제료 수가 내역 */}
                {result.wageList.length > 0 && (
                  <Card variant="standard">
                    <button
                      onClick={() => setShowWageList((v) => !v)}
                      className="w-full flex items-center justify-between text-base font-semibold text-text-primary"
                    >
                      조제료 수가 내역
                      {showWageList
                        ? <ChevronUp className="w-4 h-4 text-text-muted" />
                        : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </button>

                    {showWageList && (
                      <>
                        {/* 가산 뱃지 칩 */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {result.wageList.some(w => w.sugaCd.endsWith('010')) && (
                            <Badge variant="info">야간가산 적용</Badge>
                          )}
                          {result.wageList.some(w => w.sugaCd.endsWith('030')) && (
                            <Badge variant="neutral">토요 분리 적용</Badge>
                          )}
                          {result.wageList.some(w => w.sugaCd === 'Z4010') && (
                            <Badge variant="warning">산제(가루약) 가산</Badge>
                          )}
                          {result.wageList.some(w => w.sugaCd === 'Z7001') && (
                            <Badge variant="success">복약상담료 (Z7001)</Badge>
                          )}
                          {result.wageList.some(w => w.sugaCd === 'ZE100') && (
                            <Badge variant="primary">명절가산 (ZE100)</Badge>
                          )}
                          {result.wageList.some(w => w.sugaCd.startsWith('Z4200') || w.sugaCd === 'Z4200' || w.sugaCd === 'Z4201') && (
                            <Badge variant="primary">직접조제 (Z4200)</Badge>
                          )}
                        </div>

                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border-light text-left text-text-muted">
                                <th className="py-2 font-medium">Z코드</th>
                                <th className="py-2 font-medium">수가명</th>
                                <th className="py-2 text-right font-medium">단가</th>
                                <th className="py-2 text-right font-medium">횟수</th>
                                <th className="py-2 text-right font-medium">금액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.wageList.map((w, i) => (
                                <tr key={i} className="border-b border-border-light">
                                  <td className="py-2 font-mono text-xs text-primary-600">{w.sugaCd}</td>
                                  <td className="py-2 text-text-secondary text-xs">{w.name}</td>
                                  <td className="py-2 text-right font-mono text-xs">{w.price.toLocaleString()}</td>
                                  <td className="py-2 text-right font-mono text-xs">{w.cnt}</td>
                                  <td className="py-2 text-right font-mono text-xs font-medium">{w.sum.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={4} className="py-2 text-right text-xs font-semibold text-text-primary">합계</td>
                                <td className="py-2 text-right font-mono text-sm font-bold text-primary-600">
                                  {result.sumWage.toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>
                )}

                {/* 단계별 계산 과정 */}
                {result.steps.length > 0 && (
                  <Card variant="standard">
                    <button
                      onClick={() => setShowSteps((v) => !v)}
                      className="w-full flex items-center justify-between text-base font-semibold text-text-primary"
                    >
                      단계별 계산 과정
                      {showSteps
                        ? <ChevronUp className="w-4 h-4 text-text-muted" />
                        : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </button>

                    {showSteps && (
                      <div className="mt-4 space-y-3">
                        {result.steps.map((step, i) => (
                          <div key={i} className="bg-bg-panel rounded-lg p-3 border border-border-light">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-text-primary mb-1">
                                  Step {i + 1}: {step.title}
                                </p>
                                <p className="text-xs text-text-muted font-mono mb-1.5 break-all">
                                  = {step.formula}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-primary-600 whitespace-nowrap flex-shrink-0">
                                {step.result.toLocaleString()}{step.unit}
                              </span>
                            </div>
                            {/* 모듈 힌트: 타이틀에서 키워드 감지 */}
                            {step.title.includes('보훈') && (
                              <Badge variant="info" className="mt-1 text-xs">보훈 모듈 적용됨</Badge>
                            )}
                            {step.title.includes('산제') && (
                              <Badge variant="warning" className="mt-1 text-xs">산제(가루약) 가산 적용됨</Badge>
                            )}
                            {step.title.includes('trunc') && (
                              <Badge variant="neutral" className="mt-1 text-xs">반올림(절사) 처리</Badge>
                            )}
                            {step.title.includes('의료급여') && (
                              <Badge variant="warning" className="mt-1 text-xs">의료급여 규칙 적용됨</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 체크 칩 ───────────────────────────────────────────────

interface CheckChipProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function CheckChip({ id, label, description, checked, onChange }: CheckChipProps) {
  return (
    <label
      className={[
        'flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border cursor-pointer transition-colors text-xs',
        checked
          ? 'border-primary-400 bg-primary-50 text-primary-700'
          : 'border-border-light bg-bg-surface text-text-secondary hover:bg-bg-panel',
      ].join(' ')}
      title={description}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary-500"
        aria-label={label}
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

// ─── 서브 컴포넌트: 결과 행 ───────────────────────────────────────────────

interface ResultRowProps {
  label: string;
  value: number;
  variant: 'neutral' | 'primary' | 'warning' | 'success' | 'info';
  bold?: boolean;
}

function ResultRow({ label, value, variant, bold = false }: ResultRowProps) {
  const colorMap: Record<string, string> = {
    neutral: 'text-text-primary',
    primary: 'text-primary-600',
    warning: 'text-warning-500',
    success: 'text-success-500',
    info:    'text-info-500',
  };

  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold' : ''} text-text-secondary`}>
        {label}
      </span>
      <span className={`font-mono ${bold ? 'text-base font-bold' : 'text-sm'} ${colorMap[variant]}`}>
        {value.toLocaleString('ko-KR')}원
      </span>
    </div>
  );
}
