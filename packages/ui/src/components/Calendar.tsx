import type { ReactNode } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';

// 캘린더 달력(docs/design/components/Calendar.md): 머리(월·연도, 이전·다음) → 요일 → 6주 칸 → 아래 일정 목록(children).
// 칸: 숫자 + 일정 막대(챙길 날, 영역색 최대 3개) + 돈 날짜 점(ink). 오늘 brand-soft, 고른 날 ink 원, 정리 기간 띠.
export type CalMark = 'family' | 'together' | 'goal';
export interface CalDay {
  date: string;
  day: number;
  muted: boolean;
  marks?: CalMark[];
  money?: boolean;
  band?: boolean;
  /** 화면 읽기용(“10월 25일, 일정 2개”) */
  label: string;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function Calendar({
  year,
  month,
  yearLabel,
  monthLabel,
  days,
  today,
  selected,
  onSelect,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  filter,
  children,
}: {
  year: number;
  month: number;
  yearLabel: string;
  monthLabel: string;
  days: CalDay[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  /** 맨 위 보기 필터(칩) */
  filter?: ReactNode;
  /** 범례, 고른 날 일정 목록 */
  children?: ReactNode;
}) {
  return (
    <section className="hg-cal" aria-label={`${yearLabel} ${monthLabel}`}>
      {filter}
      <div className="hg-cal__head">
        <span className="hg-cal__month">
          <b>{monthLabel}</b>
          <span>{yearLabel}</span>
        </span>
        <span className="hg-cal__nav">
          <IconButton icon="chevron-left" label={prevLabel} small onClick={onPrev} />
          <IconButton icon="chevron-right" label={nextLabel} small onClick={onNext} />
        </span>
      </div>
      <div className="hg-cal__grid" role="group" aria-label={`${year}-${month}`}>
        {DOW.map((d) => (
          <span key={d} className="hg-cal__dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className={cx(
              'hg-cal__day',
              d.muted && 'is-muted',
              d.band && 'is-band',
              d.date === today && 'is-today',
              d.date === selected && 'is-selected',
            )}
            aria-label={d.label}
            aria-pressed={d.date === selected}
            aria-current={d.date === today ? 'date' : undefined}
            onClick={() => onSelect(d.date)}
          >
            <span className="hg-cal__num">{d.day}</span>
            <span className="hg-cal__marks" aria-hidden="true">
              {(d.marks ?? []).slice(0, 3).map((k, i) => (
                <i key={i} className={cx('hg-cal__mark', `hg-mark--${k}`)} />
              ))}
              {d.money && <i className="hg-cal__dot" />}
            </span>
          </button>
        ))}
      </div>
      {children}
    </section>
  );
}
