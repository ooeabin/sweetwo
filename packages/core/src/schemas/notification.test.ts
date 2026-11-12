import { describe, expect, it } from 'vitest';
import { notiCursor, parseNotiRows } from './notification';

const row = (id: string, at: string, more: Record<string, unknown> = {}) => ({
  id,
  kind: 'payday',
  title: '오늘은 월급날이에요',
  target: '/salary',
  created_at: at,
  ...more,
});

describe('알림 행 검사(S10-13)', () => {
  it('맞는 행만 남기고, 빈 칸은 null', () => {
    const r = parseNotiRows([
      row('a', '2026-10-07T00:00:00+00:00', { icon: 'calendar-check' }),
      { id: 'b', title: '' },
      row('c', '2026-10-07T00:00:00+00:00', { target: 'https://x' }),
    ]);
    expect(r).toEqual([
      {
        id: 'a',
        kind: 'payday',
        title: '오늘은 월급날이에요',
        body: null,
        target: '/salary',
        icon: 'calendar-check',
        actor_id: null,
        created_at: '2026-10-07T00:00:00+00:00',
        read_at: null,
      },
    ]);
    expect(parseNotiRows(null)).toEqual([]);
  });
  it('커서는 마지막 행의 (만든 때, id), 덜 차면 끝', () => {
    const page = parseNotiRows([
      row('b', '2026-10-07T00:00:00+00:00'),
      row('a', '2026-10-07T00:00:00+00:00'),
    ]);
    expect(notiCursor(page, 2)).toEqual({ at: '2026-10-07T00:00:00+00:00', id: 'a' });
    expect(notiCursor(page, 30)).toBeUndefined();
  });
});
