import { dday, formatDateWeekday, formatMonthDay, withinDays, type MoneyDate } from '@sweetwo/core';
import {
  Button,
  Icon,
  Lead,
  leadOf,
  type LeadSpec,
  ListRow,
  SectionHeader,
  StatBlock,
} from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money as won, useMask } from '../../shared/mask';
import { copy } from './copy';
import { moneyLine, type useCalendarData } from './data';
import type { CalFilter } from './frame';

// Y-04 달력 아래 ‘다가오는 일정’ 묶음(24 Y-04 11~14번, 2026-11-17): 예전 Y-01 일정 목록 본문을 달력으로 옮김.
// 기록할 날 띠(→ Y-08), 다음 경조사 카드(D-day, 준비하기 → Y-05), “다가오는 일정” 한 목록(60일 안 경조사 + 금융 일정, 날짜순,
// 오른쪽 D-day, 경조사는 영역 색, 금융 일정은 종류 아이콘), 선물 기록(→ Y-09). 보기 필터가 “금융 일정”이면 경조사 쪽은 숨김.
type CalData = ReturnType<typeof useCalendarData>;

/** 기록 없이 7일 지난 날이 있으면 맨 위 회색 띠 “선물을 기록할 날이 1개 있어요”(→ Y-08) */
export function RecordBand({ d, filter }: { d: CalData; filter: CalFilter }) {
  const nav = useNavigate();
  const first = d.overdue[0];
  if (filter === 'money' || !first) return null;
  return (
    <button
      type="button"
      className="hg-recband"
      onClick={() => nav(`/calendar/day/${first.care.id}/record/a?on=${first.date}`)}
    >
      <span className="hg-recband__icon" aria-hidden="true">
        <Icon name="pencil" />
      </span>
      <span className="hg-recband__text">
        <b>{copy.recordCount(d.overdue.length)}</b>
        <span>
          {copy.recordWhich(first.care.name, formatMonthDay(first.date), d.overdue.length - 1)}
        </span>
      </span>
      <span className="hg-chevron" aria-hidden="true" />
    </button>
  );
}

export function UpcomingSection({ d, filter }: { d: CalData; filter: CalFilter }) {
  const nav = useNavigate();
  const { masked } = useMask();
  const m = (x: number) => won(x, masked);

  const [y, mo] = d.today.split('-').map(Number) as [number, number];
  const months: [number, number][] = [0, 1, 2].map((n) => {
    const t = y * 12 + (mo - 1) + n;
    return [Math.floor(t / 12), (t % 12) + 1];
  });
  const money: MoneyDate[] = months
    .flatMap(([yy, mm]) => d.monthOf(yy, mm).dates)
    .filter((x) => withinDays(d.today, x.date, 60));
  const soon = d.upcoming.filter((x) => withinDays(d.today, x.date, 60));
  const next = d.upcoming[0];

  // 경조사와 금융 일정을 날짜순 한 목록으로
  type Row = {
    key: string;
    date: string;
    label: string;
    sub: string;
    /** 줄 앞 칸(2026-11-09 lead-kinds.ts ‘care’·‘money’ 표) */
    lead: LeadSpec;
    to: string;
  };
  const rows: Row[] = [
    ...(filter === 'money'
      ? []
      : soon.map((x) => ({
          key: `c-${x.care.id}`,
          date: x.date,
          label: x.care.name,
          sub:
            x.care.budget > 0
              ? `${formatDateWeekday(x.date)}, ${m(x.care.budget)}`
              : formatDateWeekday(x.date),
          lead: leadOf('care', x.care.kind),
          to: `/calendar/day/${x.care.id}`,
        }))),
    ...(filter === 'care'
      ? []
      : money.map((x, i) => {
          const l = moneyLine(x, true);
          return {
            key: `m-${x.date}-${x.kind}-${i}`,
            date: x.date,
            label: l.label,
            sub: l.why ?? formatDateWeekday(x.date),
            lead: leadOf('money', x.kind),
            to: l.to,
          };
        })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      {filter !== 'money' && next && (
        <section className="hg-card hg-stack" aria-label={copy.nextCare}>
          {/* 2026-11-04 Y-05와 같게: 큰 D-day + 이름 + 날짜·금액 메모 */}
          <StatBlock
            as="div"
            big={copy.dday(dday(d.today, next.date))}
            title={next.care.name}
            sub={
              next.care.budget > 0
                ? `${formatMonthDay(next.date)}, ${copy.memoAmount(m(next.care.budget))}`
                : formatMonthDay(next.date)
            }
          />
          <div className="hg-row">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => nav(`/calendar/day/${next.care.id}`)}
            >
              {copy.prepare}
            </Button>
            {/* 그날이 되면 여기서도 ‘다녀왔어요’ → Y-08(24 Y-05 4번). 이번 회차를 기록했으면 숨김(Y-04·Y-05와 같은 조건, S9-12) */}
            {next.date <= d.today &&
              !(next.care.status === 'done' && next.care.status_on === next.date) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => nav(`/calendar/day/${next.care.id}/record/a?on=${next.date}`)}
                >
                  {copy.statuses.done}
                </Button>
              )}
          </div>
        </section>
      )}
      <section className="hg-stack" aria-label={copy.upcomingList}>
        <SectionHeader title={copy.upcomingList} />
        {!rows.length ? (
          <p className="hg-card__meta" style={{ margin: 0 }}>
            {filter === 'money' ? copy.noMoney60 : copy.none60}
          </p>
        ) : (
          // 2026-11-04 달 머리로 묶음(월급 줄이 되풀이돼도 어디까지가 이번 달인지 보이게)
          Object.entries(
            rows.reduce<Record<string, Row[]>>((acc, r) => {
              (acc[r.date.slice(0, 7)] ??= []).push(r);
              return acc;
            }, {}),
          ).map(([ym, list]) => (
            <div key={ym} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
              <h3 className="hg-cal__monthhead">{copy.monthHead(Number(ym.slice(5, 7)))}</h3>
              <div className="hg-list">
                {list.map((r) => {
                  const n = dday(d.today, r.date);
                  return (
                    <ListRow
                      key={r.key}
                      lead={<Lead icon={r.lead.icon} tone={r.lead.tone} />}
                      label={r.label}
                      sub={r.sub}
                      value={
                        <span className={n <= 7 ? 'hg-cal__dday is-near' : 'hg-cal__dday'}>
                          {copy.dday(n)}
                        </span>
                      }
                      onClick={() => nav(r.to)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
      {filter !== 'money' && !!d.cares.length && (
        <div className="hg-list">
          <ListRow label={copy.gifted} onClick={() => nav('/calendar/gifts')} />
        </div>
      )}
    </>
  );
}
