import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { weekIndexOf, type DayTone } from '@sweetwo/core';
import { cx } from './cx';
import { Button } from './Button';
import { Icon } from './Icon';

// 캘린더 달력(docs/design/components/Calendar.md, 2026-11-24 K안, 한국 금융 앱 달력형):
// 머리 왼쪽 ‹ 11월 ›(선 꺾쇠 + 달 이름, 달 이름을 누르면 연·월 칸 시트, 2026-11-27 ‘달 넘기기 C안’) + 오른쪽 ‘오늘’(다른 달일 때만)
// → 요약 한 줄 → 요일 → 그 달 주만 → 손잡이(한 주로 접기).
// 칸: 높이가 모두 같고(그림이 없어도 줄이 흐트러지지 않음), 숫자 아래 20px 그림 칸(그림이 없으면 그리지 않음). 일정 있는 날 굵은 ink 숫자,
// 오늘 오렌지 숫자, 고른 날은 칸 전체를 덮는 회색 둥근 판, 공휴일 빨간 숫자. 다른 달 날짜는 비워 둠.
export interface CalDay {
  date: string;
  day: number;
  muted: boolean;
  /** 숫자 모양(core dayTone): 일정 있는 날 event, 지난 날 past, 그 밖 plain */
  tone: DayTone;
  /** 칸 그림(첫 일정 그림. 파일이 없으면 넣지 않음 → 그림 칸을 그리지 않음) */
  art?: ReactNode;
  /** 첫 일정 말고 더 있는 일정 수(“+1”) */
  more?: number;
  /** 공휴일(숫자 빨간 글자) */
  holiday?: boolean;
  /** 화면 읽기용(“10월 25일, 일정 2개”) */
  label: string;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 손잡이를 이만큼(px) 끌면 접거나 폄 */
const DRAG = 24;

export function Calendar({
  year,
  month,
  monthText,
  monthMenuLabel,
  onMonthMenu,
  summary,
  days,
  today,
  selected,
  onSelect,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  prevDisabled,
  nextDisabled,
  todayLabel,
  onToday,
  folded,
  onFoldedChange,
  foldLabel,
  unfoldLabel,
  filter,
  children,
}: {
  year: number;
  month: number;
  /** 머리 달 이름(“12월”, 다른 해면 “2027년 2월”) */
  monthText: string;
  /** 달 이름 버튼 화면 읽기 이름(“2026년 12월, 달 고르기”) */
  monthMenuLabel: string;
  onMonthMenu: () => void;
  /** 머리 아래 요약 한 줄(없으면 줄 없음) */
  summary?: ReactNode;
  days: CalDay[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  /** 넘길 수 없는 끝(꺾쇠를 stone + disabled로) */
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** 오늘이 든 달이 아니면 ‘오늘’ */
  todayLabel?: string;
  onToday?: () => void;
  /** 한 주로 접음(고른 날이 든 주만) */
  folded: boolean;
  /** via: 손잡이를 눌렀나(tap, 키보드 포함) 끌었나(drag) */
  onFoldedChange: (folded: boolean, via: 'tap' | 'drag') => void;
  foldLabel: string;
  unfoldLabel: string;
  /** 맨 위 보기 필터 */
  filter?: ReactNode;
  /** 달력 아래 */
  children?: ReactNode;
}) {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
    days.slice(i * 7, i * 7 + 7),
  );
  const open = weekIndexOf(
    days.map((d) => d.date),
    selected ?? '',
  );
  const drag = useRef<{ y: number; done: boolean } | null>(null);
  const [dragged, setDragged] = useState(false);
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, done: false };
    setDragged(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = drag.current;
    if (!s || s.done) return;
    const dy = e.clientY - s.y;
    if (dy <= -DRAG && !folded) {
      s.done = true;
      setDragged(true);
      onFoldedChange(true, 'drag');
    } else if (dy >= DRAG && folded) {
      s.done = true;
      setDragged(true);
      onFoldedChange(false, 'drag');
    }
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <section className={cx('hg-cal', folded && 'is-folded')} aria-label={`${year}년 ${month}월`}>
      {filter}
      <div className="hg-cal__head">
        <div className="hg-cal__nav">
          <button
            type="button"
            className="hg-chevnav"
            aria-label={prevLabel}
            disabled={prevDisabled}
            onClick={onPrev}
          >
            <Icon name="chevron-left" size={24} />
          </button>
          <button
            type="button"
            className="hg-cal__month"
            aria-label={monthMenuLabel}
            aria-haspopup="dialog"
            onClick={onMonthMenu}
          >
            <b aria-hidden="true">{monthText}</b>
          </button>
          <button
            type="button"
            className="hg-chevnav"
            aria-label={nextLabel}
            disabled={nextDisabled}
            onClick={onNext}
          >
            <Icon name="chevron-right" size={24} />
          </button>
        </div>
        {todayLabel && onToday && (
          <Button size="sm" className="hg-cal__today" onClick={onToday}>
            {todayLabel}
          </Button>
        )}
      </div>
      {summary && <p className="hg-cal__summary">{summary}</p>}
      <div className="hg-cal__dows" aria-hidden="true">
        {DOW.map((d) => (
          <span key={d} className="hg-cal__dow">
            {d}
          </span>
        ))}
      </div>
      <div className="hg-cal__grid" role="group" aria-label={`${year}-${month}`}>
        {weeks.map((w, i) => {
          const hidden = folded && i !== open;
          return (
            <div key={w[0]?.date ?? i} className={cx('hg-cal__week', hidden && 'is-hidden')}>
              <div className="hg-cal__weekin">
                {w.map((d) =>
                  // 다른 달 날짜는 비워 둠(대형 금융 앱처럼, 흐린 숫자는 대비가 모자람)
                  d.muted ? (
                    <span key={d.date} className="hg-cal__day is-muted" aria-hidden="true" />
                  ) : (
                    <button
                      key={d.date}
                      type="button"
                      className={cx(
                        'hg-cal__day',
                        `is-${d.tone}`,
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
                      {d.art && (
                        <span className="hg-cal__art" aria-hidden="true">
                          {d.art}
                          {!!d.more && <b>+{d.more}</b>}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="hg-cal__handle"
        aria-expanded={!folded}
        aria-label={folded ? unfoldLabel : foldLabel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => {
          // 끌어서 바뀐 뒤 따라오는 누름은 한 번 무시
          if (dragged) return setDragged(false);
          onFoldedChange(!folded, 'tap');
        }}
      >
        <i aria-hidden="true" />
      </button>
      {children}
    </section>
  );
}
