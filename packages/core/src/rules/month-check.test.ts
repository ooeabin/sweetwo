import { describe, expect, it } from 'vitest';
import {
  chipCounts,
  doneState,
  heroMeta,
  plannedSum,
  savedSum,
  splitCheckLines,
} from './month-check';

const L = (state: string, sort: number, o: object = {}) => ({
  state,
  sort,
  auto: false,
  planned: 100,
  actual: null,
  kind: 'living',
  ...o,
});

describe('W-02 큰 금액과 칩 숫자', () => {
  it('큰 금액 = 계획 합(손 줄 + 자동 줄, 건너뜀 포함)', () => {
    expect(plannedSum([L('wait', 1), L('checked', 2), L('skipped', 3, { auto: true })])).toBe(300);
  });
  it('전체 / 남음 / 완료(건너뜀은 완료)', () => {
    expect(chipCounts([L('wait', 1), L('checked', 2), L('skipped', 3)])).toEqual({
      all: 3,
      left: 1,
      done: 2,
    });
  });
});

describe('W-02 한 목록 정렬과 칩 필터', () => {
  const lines = [
    { id: 'a', ...L('checked', 1) },
    { id: 'b', ...L('wait', 2, { auto: true }) },
    { id: 'c', ...L('skipped', 3) },
    { id: 'd', ...L('wait', 4) },
    { id: 'e', ...L('wait', 0) },
  ];
  it('전체: 남은 줄(손·자동) 먼저, 확인·건너뛴 줄 아래, 각각 템플릿 순서', () => {
    const r = splitCheckLines(lines);
    expect(r.open.map((l) => l.id)).toEqual(['e', 'b', 'd']);
    expect(r.done.map((l) => l.id)).toEqual(['a', 'c']);
  });
  it('남음·완료 칩은 한쪽만', () => {
    expect(splitCheckLines(lines, 'left').done).toEqual([]);
    expect(splitCheckLines(lines, 'done').open).toEqual([]);
    expect(splitCheckLines(lines, 'done').done).toHaveLength(2);
  });
});

describe('W-02 보조 한 줄', () => {
  it('월급날 전 “D-6, 5개”, 당일은 D-day', () => {
    const p = { today: '2026-10-19', payday: '2026-10-25', count: 5 };
    expect(heroMeta({ preview: p })).toBe('D-6, 5개');
    expect(heroMeta({ preview: { ...p, today: '2026-10-25' } })).toBe('D-day, 5개');
  });
  it('확인 중 “5개 중 2개 확인”', () => {
    const lines = [L('checked', 1), L('skipped', 2), L('wait', 3), L('wait', 4), L('wait', 5)];
    expect(heroMeta({ lines })).toBe('5개 중 2개 확인');
  });
});

describe('W-02 다 확인 상태', () => {
  it('손 줄을 모두 계획대로 했으면 all(자동 줄이 남아도)', () => {
    expect(doneState([L('checked', 1), L('checked', 2), L('wait', 3, { auto: true })])).toBe('all');
  });
  it('건너뜀이나 다른 금액이 섞이면 mixed', () => {
    expect(doneState([L('checked', 1), L('skipped', 2)])).toBe('mixed');
    expect(doneState([L('checked', 1, { actual: 50 })])).toBe('mixed');
  });
  it('손 줄이 남았거나 없으면 null', () => {
    expect(doneState([L('checked', 1), L('wait', 2)])).toBeNull();
    expect(doneState([L('wait', 1, { auto: true })])).toBeNull();
  });
  it('저축·투자 합 = 확인한 저축·투자 줄(다른 금액 반영, 건너뜀 0)', () => {
    const s = (state: string, extra: object = {}) => L(state, 1, { kind: 'saving', ...extra });
    expect(
      savedSum([s('checked'), s('checked', { actual: 70 }), s('skipped'), L('checked', 2)]),
    ).toBe(170);
    expect(savedSum([s('wait')])).toBe(0);
  });
});
