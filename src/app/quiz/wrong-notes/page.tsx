'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  RotateCcw,
  BookOpen,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import {
  getWrongAnswers,
  deleteWrongAnswer,
  clearWrongAnswers,
  type WrongAnswerEntry,
} from '@/lib/quiz/wrong-notes';
import { DIFFICULTY_LABEL, DIFFICULTY_VARIANT } from '@/lib/quiz/types';
import { formatRelativeTime } from '@/lib/quiz/history';

// ── 상수 ─────────────────────────────────────────────────────

const CHAPTER_OPTIONS = [
  { value: 'ALL', label: '전체 챕터' },
  ...Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { value: `CH${n}`, label: `CH${n}` };
  }),
];

const PERIOD_OPTIONS = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'unresolved', label: '미해결' },
  { value: 'resolved', label: '해결 완료' },
];

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'unresolved' | 'resolved';

// ── 유틸 ─────────────────────────────────────────────────────

function getPeriodRange(period: PeriodFilter): { start: number; end: number } | null {
  if (period === 'all') return null;
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  if (period === 'today') return { start: startOfDay.getTime(), end: now };
  if (period === 'week') {
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return { start: startOfWeek.getTime(), end: now };
  }
  if (period === 'month') {
    const startOfMonth = new Date(startOfDay);
    startOfMonth.setDate(1);
    return { start: startOfMonth.getTime(), end: now };
  }
  return null;
}

// ── 오답 카드 ─────────────────────────────────────────────────

interface WrongNoteCardProps {
  entry: WrongAnswerEntry;
  onDelete: (id: number) => void;
}

function WrongNoteCard({ entry, onDelete }: WrongNoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="standard" className="space-y-3">
      {/* 상단: 메타 + 상태 뱃지 */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="primary">{entry.chapter}</Badge>
          <Badge variant={DIFFICULTY_VARIANT[entry.difficulty]}>
            {DIFFICULTY_LABEL[entry.difficulty]}
          </Badge>
          {entry.resolved ? (
            <Badge variant="success">해결 완료</Badge>
          ) : (
            <Badge variant="error">미해결</Badge>
          )}
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">
          {formatRelativeTime(entry.timestamp)}
        </span>
      </div>

      {/* 문제 텍스트 (최대 2줄) */}
      <p className="text-sm text-text-primary font-medium leading-relaxed line-clamp-2">
        {entry.question}
      </p>

      {/* 내 답 / 정답 */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-error-500 flex-shrink-0" />
          <span className="text-text-muted">내 답:</span>
          <span className="text-error-500 font-medium">{entry.userAnswer}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
          <span className="text-text-muted">정답:</span>
          <span className="text-success-500 font-medium">{entry.correctAnswer}</span>
        </div>
      </div>

      {/* 해설 (접기/펼치기) */}
      {entry.explanation && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 transition-colors min-h-[36px] py-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                해설 접기
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                해설 보기
              </>
            )}
          </button>
          {expanded && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed bg-neutral-50 rounded-lg px-3 py-2 border border-border-light">
              {entry.explanation}
            </p>
          )}
        </div>
      )}

      {/* 하단 액션 */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href={`/quiz/play?wrongQuestionId=${entry.questionId}`}
          className="inline-flex"
        >
          <Button variant="ghost" size="sm">
            <RotateCcw className="w-3.5 h-3.5" />
            다시 풀기
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(entry.questionId)}
          className="text-error-500 hover:bg-error-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
          삭제
        </Button>
      </div>
    </Card>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function WrongNotesPage() {
  // null = 아직 마운트 전(SSR 하이드레이션 불일치 방지)
  const [allEntries, setAllEntries] = useState<WrongAnswerEntry[] | null>(null);
  const [chapterFilter, setChapterFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  // SSR 안전 로드: useEffect는 클라이언트에서만 실행됨
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setAllEntries(getWrongAnswers());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 필터 적용 (allEntries가 null이면 빈 배열로 처리)
  const filtered = useMemo(() => {
    let list = [...(allEntries ?? [])];

    if (chapterFilter !== 'ALL') {
      list = list.filter((e) => e.chapter === chapterFilter);
    }

    const range = getPeriodRange(periodFilter);
    if (range) {
      list = list.filter(
        (e) => e.timestamp >= range.start && e.timestamp <= range.end,
      );
    }

    if (statusFilter === 'unresolved') {
      list = list.filter((e) => !e.resolved);
    } else if (statusFilter === 'resolved') {
      list = list.filter((e) => e.resolved);
    }

    return list;
  }, [allEntries, chapterFilter, periodFilter, statusFilter]);

  // 미해결 항목 (전체 다시 풀기용)
  const unresolvedIds = useMemo(
    () => (allEntries ?? []).filter((e) => !e.resolved).map((e) => e.questionId),
    [allEntries],
  );

  const handleDelete = useCallback((id: number) => {
    deleteWrongAnswer(id);
    setAllEntries(getWrongAnswers());
  }, []);

  const handleClearAll = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearWrongAnswers();
    setAllEntries([]);
    setConfirmClear(false);
  }, [confirmClear]);

  const resetFilters = useCallback(() => {
    setChapterFilter('ALL');
    setPeriodFilter('all');
    setStatusFilter('all');
  }, []);

  const isFiltered =
    chapterFilter !== 'ALL' || periodFilter !== 'all' || statusFilter !== 'all';

  // ── 렌더링 ───────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">오답 노트</h1>
          <p className="text-sm text-text-muted mt-0.5">
            총 {(allEntries ?? []).length}개의 오답이 있습니다.
          </p>
        </div>

        {/* 상단 액션 */}
        <div className="flex flex-wrap gap-2">
          {unresolvedIds.length > 0 && (
            <Link
              href={`/quiz/play?wrongQuestionIds=${unresolvedIds.join(',')}`}
              className="inline-flex"
            >
              <Button variant="primary" size="sm">
                <RotateCcw className="w-3.5 h-3.5" />
                전체 다시 풀기 ({unresolvedIds.length})
              </Button>
            </Link>
          )}
          {(allEntries ?? []).length > 0 && (
            <Button
              variant={confirmClear ? 'primary' : 'ghost'}
              size="sm"
              onClick={handleClearAll}
              onBlur={() => setConfirmClear(false)}
              className={confirmClear ? 'bg-error-500 hover:bg-error-600' : 'text-error-500 hover:bg-error-100'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmClear ? '확인 (한 번 더 클릭)' : '전체 삭제'}
            </Button>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select
          options={CHAPTER_OPTIONS}
          value={chapterFilter}
          onChange={(e) => setChapterFilter(e.target.value)}
          aria-label="챕터 필터"
        />
        <Select
          options={PERIOD_OPTIONS}
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
          aria-label="기간 필터"
        />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="상태 필터"
        />
      </div>

      {/* 오답 목록 */}
      {(allEntries ?? []).length === 0 ? (
        // 오답 자체가 없는 경우
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <CheckCircle className="w-16 h-16 text-success-500 opacity-70" />
          <p className="text-lg font-medium text-text-primary">
            아직 오답이 없습니다. 퀴즈를 풀어보세요!
          </p>
          <Link href="/quiz">
            <Button variant="primary">
              <BookOpen className="w-4 h-4" />
              퀴즈 풀러 가기
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        // 필터 결과가 없는 경우
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Search className="w-12 h-12 text-text-muted opacity-60" />
          <p className="text-base font-medium text-text-secondary">
            조건에 맞는 오답이 없습니다.
          </p>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              필터 초기화
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => (
            <WrongNoteCard
              key={entry.questionId}
              entry={entry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
