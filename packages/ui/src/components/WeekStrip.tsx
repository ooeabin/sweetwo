import { addDays } from '@sweetwo/core';
import { cx } from './cx';

// 이번 주 날짜 띠(docs/design/components/WeekStrip.md, 현대카드 소비 캘린더 느낌).
// 일~토 7칸, 오늘은 검정 원, 일정 있는 날은 아래 점, 일요일·공휴일은 holiday-ink. 아래 목록이 같은 내용을 읽어 주므로 그림만.
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function WeekStrip({
  today,
  marked,
  holidays,
}: {
  /** 오늘(YYYY-MM-DD, KST) */
  today: string;
  /** 일정이 있는 날 */
  marked: ReadonlySet<string>;
  /** 공휴일 */
  holidays?: ReadonlySet<string>;
}) {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = addDays(today, -dow);
  return (
    <div className="hg-week" aria-hidden="true">
      {DOW.map((name, i) => {
        const day = addDays(start, i);
        const red = i === 0 || !!holidays?.has(day);
        return (
          <span
            key={day}
            className={cx(
              'hg-week__day',
              red && 'is-holiday',
              day === today && 'is-today',
              day < today && 'is-past',
            )}
          >
            <small>{name}</small>
            <b>{Number(day.slice(8))}</b>
            <i className={marked.has(day) ? 'is-on' : undefined} />
          </span>
        );
      })}
    </div>
  );
}
