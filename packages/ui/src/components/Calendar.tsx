import type { ReactNode } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';

// 캘린더 달력(docs/design/components/Calendar.md, 2026-11-04 토스 소비 달력형):
// 카드 없이 가운데 ‘‹ 10월 ›’(다른 달이면 오른쪽 ‘오늘’) → 요일 → 그 달 주만 → 아래 일정 목록(children).
// 칸: 숫자 + 짧은 이름 한 줄(월급, 생신, 만기, 공휴일 이름) + 월급 전 확인 기간은 칸 아래 이어진 한 줄 띠.
// 오늘은 굵은 숫자, 고른 날은 떠 있는 흰 칸. 다른 달 날짜는 비워 둠.
export type CalTone = 'care' | 'holiday' | 'money';
export interface CalDay {
  date: string;
  day: number;
  muted: boolean;
  /** 칸 안 짧은 이름(“월급”, “생신”, “만기”). 여러 개면 화면이 ‘+1’을 붙여 줌 */
  short?: string;
  tone?: CalTone;
  /** 월급 전 확인 기간 띠의 자리. start 칸에 띠 이름 */
  band?: 'start' | 'mid' | 'end' | 'single';
  /** 공휴일(숫자 빨간 글자) */
  holiday?: boolean;
  /** 설·추석 연휴 */
  festive?: boolean;
  /** 화면 읽기용(“10월 25일, 일정 2개”) */
  label: string;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function Calendar({
  year,
  month,
  yearLabel,
  monthLabel,
  showYear = false,
  days,
  today,
  selected,
  onSelect,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  todayLabel,
  onToday,
  bandLabel,
  filter,
  children,
}: {
  year: number;
  month: number;
  yearLabel: string;
  monthLabel: string;
  /** 올해가 아니면 연도도 보여 줌 */
  showYear?: boolean;
  days: CalDay[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  /** 오늘이 든 달이 아니면 ‘오늘’ */
  todayLabel?: string;
  onToday?: () => void;
  /** 월급 전 확인 띠 이름(“월급 전 확인”) */
  bandLabel?: string;
  /** 맨 위 보기 필터(칩) */
  filter?: ReactNode;
  /** 고른 날 일정 목록 */
  children?: ReactNode;
}) {
  return (
    <section className="hg-cal" aria-label={`${yearLabel} ${monthLabel}`}>
      {filter}
      <div className="hg-cal__head">
        <IconButton icon="chevron-left" label={prevLabel} small onClick={onPrev} />
        <span className="hg-cal__month">
          {showYear && <span>{yearLabel}</span>}
          <b>{monthLabel}</b>
        </span>
        <IconButton icon="chevron-right" label={nextLabel} small onClick={onNext} />
        {todayLabel && onToday && (
          <button type="button" className="hg-cal__today" onClick={onToday}>
            {todayLabel}
          </button>
        )}
      </div>
      <div className="hg-cal__grid" role="group" aria-label={`${year}-${month}`}>
        {DOW.map((d) => (
          <span key={d} className="hg-cal__dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d) =>
          // 2026-11-04 다른 달 날짜는 비워 둠(토스처럼, 흐린 숫자는 대비가 모자람)
          d.muted ? (
            <span key={d.date} className="hg-cal__day is-muted" aria-hidden="true" />
          ) : (
            <button
              key={d.date}
              type="button"
              className={cx(
                'hg-cal__day',
                d.muted && 'is-muted',
                d.festive && 'is-festive',
                d.holiday && 'is-holiday',
                d.date === today && 'is-today',
                d.date === selected && 'is-selected',
              )}
              aria-label={d.label}
              aria-pressed={d.date === selected}
              aria-current={d.date === today ? 'date' : undefined}
              onClick={() => onSelect(d.date)}
            >
              <span className="hg-cal__num">{d.day}</span>
              {d.short && (
                <span className={cx('hg-cal__short', d.tone && `is-${d.tone}`)} aria-hidden="true">
                  {d.short}
                </span>
              )}
              {d.band && (
                <span className={cx('hg-cal__band', `is-${d.band}`)} aria-hidden="true">
                  {(d.band === 'start' || d.band === 'single') && bandLabel}
                </span>
              )}
            </button>
          ),
        )}
      </div>
      {children}
    </section>
  );
}
