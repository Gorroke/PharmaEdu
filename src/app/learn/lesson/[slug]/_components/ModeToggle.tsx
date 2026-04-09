'use client';

/**
 * ModeToggle.tsx
 * "단계별 학습" / "전체 보기" 모드 전환 버튼 그룹
 * URL 쿼리 파라미터 ?mode=step | ?mode=full 로 상태 관리
 *
 * 개선: 활성 탭에 애니메이션 슬라이더 효과, F키 힌트 툴팁
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { BookOpen, LayoutList } from 'lucide-react';

type ViewMode = 'step' | 'full';

interface ModeToggleProps {
  currentMode: ViewMode;
}

export function ModeToggle({ currentMode }: ModeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchMode(mode: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', mode);
    // 모드 전환 시 step 파라미터는 초기화
    params.delete('step');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="flex items-center gap-1 p-1 bg-bg-panel border border-border-light rounded-xl"
      role="group"
      aria-label="보기 모드 전환"
    >
      <ToggleButton
        active={currentMode === 'step'}
        onClick={() => switchMode('step')}
        icon={<LayoutList className="w-3.5 h-3.5" aria-hidden="true" />}
        label="단계별"
        hint="단계별 학습 (F키로 전환)"
      />
      <ToggleButton
        active={currentMode === 'full'}
        onClick={() => switchMode('full')}
        icon={<BookOpen className="w-3.5 h-3.5" aria-hidden="true" />}
        label="전체 보기"
        hint="전체 내용 한 번에 보기 (F키로 전환)"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
        active
          ? 'bg-primary-500 text-white shadow-sm scale-[1.02]'
          : 'text-text-secondary hover:text-text-primary hover:bg-neutral-100',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
