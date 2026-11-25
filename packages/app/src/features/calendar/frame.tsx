import { AddText, Button, LineTabs } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadErrorCard, MainFrame } from '../frame';
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

/** 보기 필터(12번): 밑줄 탭(2026-11-23 바탕 정리 2, 거르는 탭은 LineTabs) */
export function FilterChips({
  value,
  onChange,
}: {
  value: CalFilter;
  onChange: (f: CalFilter) => void;
}) {
  return (
    <LineTabs<CalFilter>
      label={copy.filterLabel}
      value={value}
      onChange={onChange}
      items={(['all', 'care', 'money'] as const).map((k) => ({ value: k, label: copy.filters[k] }))}
    />
  );
}

// 캘린더 메뉴 틀(24 Y-04 1~3번, 2026-11-17 첫 화면이 달력 Y-04, 예전 일정 목록 Y-01은 없앰).
// 제목 “달력” + 오른쪽 ‘+ 일정 추가’(넓은 창만) + 보기 필터 밑줄 탭 → Y-07. 좁은 창 ‘+ 일정 추가’는 ‘다가오는 일정’ 머리 오른쪽(upcoming.tsx, 2026-11-24 K안).
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
        title: copy.monthTitle, // 제목 = 서랍 줄 이름 ‘달력’(2026-11-18)
        actions: (
          // 넓은 창만. 좁은 창은 보기 필터 줄 오른쪽 ‘+ 일정 추가’(2026-11-09 + 버튼 대신).
          // 메뉴 제목 줄 ‘추가’는 보조 버튼(DESIGN.md 브랜드 색 ‘바꾸지 않는 것’, 2026-11-12 QA 8구간 S8-11)
          <Button className="hg-wide-only" variant="secondary" aria-label={copy.add} onClick={add}>
            <AddText>{copy.add}</AddText>
          </Button>
        ),
      }}
      columns={[
        <div key="c" className="hg-stack">
          <div className="hg-cal__tools">
            <FilterChips value={filter} onChange={onFilter} />
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
  return <LoadErrorCard onRetry={onRetry} />;
}
