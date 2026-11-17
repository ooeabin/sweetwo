import { AddRow, Button, Chip } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { sharedCopy } from '../../shared/copy';
import { MainFrame } from '../frame';
import { copy } from './copy';
import { startCareAdd } from './pages/y-07-care-add';

export type CalFilter = 'all' | 'care' | 'money';
const FILTER_KEY = 'sweetwo.cal-filter';
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 기억 못 해도 됨 */
  }
};
/** 보기 필터(12번): 목록·달력 공통, 기본 전체, 마지막 선택 기억 */
export function useCalFilter() {
  const [f, setF] = useState<CalFilter>(() => {
    const v = read(FILTER_KEY);
    return v === 'care' || v === 'money' ? v : 'all';
  });
  return [
    f,
    (x: CalFilter) => {
      setF(x);
      write(FILTER_KEY, x);
    },
  ] as const;
}

export function FilterChips({
  value,
  onChange,
}: {
  value: CalFilter;
  onChange: (f: CalFilter) => void;
}) {
  return (
    <div className="hg-cal__filter" role="group" aria-label={copy.filterLabel}>
      {(['all', 'care', 'money'] as const).map((k) => (
        <Chip key={k} small selected={value === k} onClick={() => onChange(k)}>
          {copy.filters[k]}
        </Chip>
      ))}
    </div>
  );
}

// 캘린더 메뉴 틀(24 Y-04 1~3번, 2026-11-17 첫 화면이 달력 Y-04, 예전 일정 목록 Y-01은 없앰).
// 제목 “캘린더” + 오른쪽 ‘+ 일정 추가’(넓은 창만) + 보기 필터 칩과 오른쪽 ‘+ 일정 추가’ 글자 줄(좁은 창만) → Y-07.
// 예전 이번 주 띠(WeekStrip)와 ‘달력 ›’ 링크는 없앰(달력이 첫 화면이라 겹침)
export function CalendarFrame({
  filter,
  onFilter,
  children,
}: {
  filter: CalFilter;
  onFilter: (f: CalFilter) => void;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const add = () => {
    startCareAdd();
    nav('/calendar/add/a');
  };
  return (
    <MainFrame
      current="calendar"
      page={{
        title: copy.title,
        actions: (
          // 넓은 창만. 좁은 창은 보기 필터 줄 오른쪽 ‘+ 일정 추가’(2026-11-09 + 버튼 대신).
          // 메뉴 제목 줄 ‘추가’는 보조 버튼(DESIGN.md 브랜드 색 ‘바꾸지 않는 것’, 2026-11-12 QA 8구간 S8-11)
          <Button className="hg-wide-only" variant="secondary" onClick={add}>
            {copy.add}
          </Button>
        ),
      }}
      columns={[
        <div key="c" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
          <div className="hg-cal__tools">
            <FilterChips value={filter} onChange={onFilter} />
            <AddRow className="hg-narrow-only" label={copy.addSchedule} onClick={add} />
          </div>
          {children}
        </div>,
      ]}
    />
  );
}

/**
 * 못 불러옴(13 공통 상태 7번, 2026-11-12 QA 9구간 S9-02): “잠시 문제가 생겼어요” / “다시 시도해 주세요” + ‘다시 시도’.
 * Y-04 본문 자리, Y-05 머리 아래(목록으로 튕기지 않음). 저금(W-10 SavingLoadError)과 같은 카드
 */
export function CalendarLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="hg-card hg-card--fill hg-stack" role="status">
      <p className="hg-card__title">{sharedCopy.errorTitle}</p>
      <p className="hg-card__meta">{sharedCopy.errorBody}</p>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={onRetry}
      >
        {sharedCopy.retry}
      </button>
    </section>
  );
}
