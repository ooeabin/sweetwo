import { Button, Chip, Tabs } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MainFrame } from '../frame';
import { copy } from './copy';
import { startCareAdd } from './pages/y-07-care-add';

export type CalView = 'list' | 'month';
export type CalFilter = 'all' | 'care' | 'money';
const VIEW_KEY = 'sweetwo.cal-view';
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
/** 마지막 보기(Y-01 2번), 기기에만 */
export const lastCalPath = () =>
  read(VIEW_KEY) === 'month' ? '/calendar/month' : '/calendar/list';
/** /calendar: 마지막으로 본 보기로 */
export function CalendarHome() {
  return <Navigate to={lastCalPath()} replace />;
}

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

// 캘린더 메뉴 틀(Y-01 1~3번): “캘린더” + ‘+ 추가’(Y-07) + 보기 전환 “목록” / “달력”
export function CalendarFrame({ view, children }: { view: CalView; children: ReactNode }) {
  const nav = useNavigate();
  write(VIEW_KEY, view);
  return (
    <MainFrame
      current="calendar"
      page={{
        title: copy.title,
        actions: (
          <Button
            variant="primary"
            onClick={() => {
              startCareAdd();
              nav('/calendar/add/a');
            }}
          >
            {copy.add}
          </Button>
        ),
      }}
      columns={[
        <div key="c" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          <Tabs<CalView>
            variant="seg"
            label={copy.viewsLabel}
            value={view}
            onChange={(v) => nav(v === 'month' ? '/calendar/month' : '/calendar/list')}
            items={[
              { value: 'list', label: copy.views.list },
              { value: 'month', label: copy.views.month },
            ]}
          />
          {children}
        </div>,
      ]}
    />
  );
}
