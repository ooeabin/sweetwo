import { describe, expect, it } from 'vitest';
import { upcomingSchedules } from './data';

// 홈 H-16 ‘다가오는 날’ 고르기, H-08 캘린더 타일은 첫 항목(19 ‘H-16’, 2026-11-20)
type Money = { date: string; kind: string; name: string };
const mk = (today: string, care: { name: string; date: string }[], money: Money[]) => ({
  today,
  upcoming: care.map((c) => ({ care: { name: c.name } as never, date: c.date })),
  caresOf: (_y: number, m: number) =>
    care
      .filter((c) => Number(c.date.slice(5, 7)) === m)
      .map((c) => ({ date: c.date, care: { name: c.name } as never })),
  monthOf: (y: number, m: number) =>
    ({
      dates: money.filter((x) => x.date.startsWith(`${y}-${String(m).padStart(2, '0')}`)),
    }) as never,
});

describe('upcomingSchedules', () => {
  const d = mk(
    '2026-11-25',
    [
      { name: '어머니 생신', date: '2026-12-03' },
      { name: '설 명절', date: '2027-02-06' },
    ],
    [
      { date: '2026-12-01', kind: 'auto', name: '월세' },
      { date: '2026-11-25', kind: 'payday', name: '' },
      { date: '2026-11-22', kind: 'auto', name: '지난 일정' },
      { date: '2026-12-03', kind: 'maturity', name: '적금' },
    ],
  );
  it('이른 순 2개, 월급날은 빼고 지난 일정도 뺀다', () => {
    const r = upcomingSchedules(d, 2);
    expect(r.map((x) => x.label)).toEqual(['월세 1일', '어머니 생신']);
    expect(r.map((x) => x.date)).toEqual(['2026-12-01', '2026-12-03']);
  });
  it('같은 날이면 경조사가 먼저, 60일 밖은 뺀다', () => {
    const r = upcomingSchedules(d, 5);
    expect(r.map((x) => x.label)).toEqual(['월세 1일', '어머니 생신', '적금 만기']);
    expect(r.some((x) => x.label === '설 명절')).toBe(false);
  });
  it('같은 반복 일정(월세 매달 1일)은 가장 가까운 회차 하나만(2026-11-20)', () => {
    const r = upcomingSchedules(
      mk(
        '2026-11-20',
        [],
        [
          { date: '2026-12-01', kind: 'auto', name: '월세' },
          { date: '2027-01-01', kind: 'auto', name: '월세' },
          { date: '2026-12-25', kind: 'auto', name: '통신비' },
        ],
      ),
      5,
    );
    expect(r.map((x) => `${x.label} ${x.date}`)).toEqual([
      '월세 1일 2026-12-01',
      '통신비 25일 2026-12-25',
    ]);
  });
  it('일정이 없으면 빈 배열(홈이 상자를 안 그림)', () => {
    expect(upcomingSchedules(mk('2026-11-25', [], []), 2)).toEqual([]);
  });
});
