import { describe, expect, it } from 'vitest';
import {
  chipCounts,
  doneState,
  foldText,
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
      skipped: 1,
      checked: 1,
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
  it('확인 중 “5개 중 1개 확인, 1개 건너뜀”(건너뜀은 확인 개수에 안 넣음)', () => {
    const lines = [L('checked', 1), L('skipped', 2), L('wait', 3), L('wait', 4), L('wait', 5)];
    expect(heroMeta({ lines })).toBe('5개 중 1개 확인, 1개 건너뜀');
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
    expect(doneState([])).toBeNull();
  });
  it('자동 줄뿐인 달(손 줄 0개)은 모두 확인됐어도 다 확인 상태가 아님(2026-11-25): 첫날 축하 화면 오류', () => {
    const a = (state: string, o: object = {}) => L(state, 1, { auto: true, ...o });
    expect(doneState([a('checked'), a('checked')])).toBeNull();
    expect(doneState([a('checked'), a('skipped')])).toBeNull();
    expect(doneState([a('checked', { actual: 50 })])).toBeNull();
    expect(doneState([a('checked'), a('wait')])).toBeNull();
  });
  it('저축·투자 합 = 확인한 저축·투자 줄(다른 금액 반영, 건너뜀 0)', () => {
    const s = (state: string, extra: object = {}) => L(state, 1, { kind: 'saving', ...extra });
    expect(
      savedSum([s('checked'), s('checked', { actual: 70 }), s('skipped'), L('checked', 2)]),
    ).toBe(170);
    expect(savedSum([s('wait')])).toBe(0);
  });
});

describe('W-02 개수 글자(2026-11-19: 확인 개수에 건너뜀을 넣지 않음)', () => {
  const mixed = [L('checked', 1), L('checked', 2), L('checked', 3), L('skipped', 4), L('wait', 5)];
  it('보조 줄 “n개 중 m개 확인”: 건너뜀은 m에서 빼고 “, k개 건너뜀”을 붙임', () => {
    expect(heroMeta({ lines: mixed })).toBe('5개 중 3개 확인, 1개 건너뜀');
    expect(heroMeta({ lines: [L('checked', 1), L('wait', 2)] })).toBe('2개 중 1개 확인');
    expect(heroMeta({ lines: [L('skipped', 1), L('skipped', 2)] })).toBe(
      '2개 중 0개 확인, 2개 건너뜀',
    );
  });
  it('접힌 줄: 건너뜀이 없으면 “n개 모두 확인했어요”, 있으면 “5개 확인, 1개 건너뜀”', () => {
    const five = [1, 2, 3, 4, 5].map((n) => L('checked', n));
    expect(foldText(five)).toBe('5개 모두 확인했어요');
    expect(foldText([...five, L('skipped', 6)])).toBe('5개 확인, 1개 건너뜀');
    // 자동 줄이 아직 대기면 “모두”를 쓰지 않음
    expect(foldText([L('checked', 1), L('wait', 2, { auto: true })])).toBe('1개 확인했어요');
  });
  it('칩 숫자: 완료 칩은 건너뜀 포함, checked·skipped는 따로', () => {
    expect(chipCounts(mixed)).toEqual({ all: 5, left: 1, done: 4, skipped: 1, checked: 3 });
  });
});
