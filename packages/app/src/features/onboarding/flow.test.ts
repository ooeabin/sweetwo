import { describe, expect, it } from 'vitest';
import { current, isAhead, nextOf, prevOf, progressOf, screens, type FlowState } from './flow';

// 온보딩 화면 순서(16, 2026-11-10 QA 2구간: O-10·O-12·O-13 뺌, 이어하기는 가장 멀리 간 화면)
const st = (
  o: { inviteNow?: FlowState['inviteNow']; space?: Record<string, unknown> } = {},
): FlowState => ({
  me: null,
  space: (o.space ?? null) as FlowState['space'],
  inviteNow: o.inviteNow ?? null,
});

describe('screens', () => {
  it('처음: O-03 → O-06 → O-11 → O-30 → O-31 → O-32 → O-60', () => {
    expect(screens(st())).toEqual(['o-03', 'o-06', 'o-11', 'o-30', 'o-31', 'o-32', 'o-60']);
  });
  it('지금 초대하면 O-07', () => {
    expect(screens(st({ inviteNow: 'now' }))).toContain('o-07');
  });
  it('파트너가 이미 합류했으면 초대 없음(S2-11)', () => {
    expect(screens(st({ inviteNow: 'now', space: { couple_state: 'connected' } }))).toEqual([
      'o-03',
      'o-11',
      'o-30',
      'o-31',
      'o-32',
      'o-60',
    ]);
  });
  it('연결 해제 뒤: O-11부터', () => {
    expect(screens(st({ space: { unlinked_from: 'x' } }))[0]).toBe('o-11');
  });
});

describe('앞뒤', () => {
  const list = screens(st());
  it('이어하기로 연 O-07(목록에 없음)의 다음은 O-11(S2-03)', () => {
    expect(nextOf('o-07', list)).toBe('o-11');
  });
  it('O-11 뒤로는 O-07 시트를 건너뛰고 O-06(S2-15)', () => {
    expect(prevOf('o-11', screens(st({ inviteNow: 'now' })))).toBe('o-06');
  });
  it('첫 화면 O-03과 O-60은 뒤로 없음', () => {
    expect(prevOf('o-03', list)).toBeUndefined();
    expect(prevOf('o-60', list)).toBeUndefined();
  });
  it('진행 막대: O-03 = 1/6, O-32 = 6/6, O-60 없음', () => {
    expect(progressOf('o-03', list)?.steps).toEqual({ total: 6, done: 1 });
    expect(progressOf('o-32', list)?.fill).toBe(100);
    expect(progressOf('o-60', list)).toBeUndefined();
  });
});

describe('이어하기 기록', () => {
  it('가장 멀리 간 화면만(S2-23)', () => {
    expect(isAhead('o-31', 'O-11')).toBe(true);
    expect(isAhead('o-11', 'O-31')).toBe(false);
    expect(isAhead('o-03', null)).toBe(true);
    expect(isAhead('o-31', 'P-03')).toBe(false);
  });
  it('뺀 화면은 옮김', () => {
    expect(current('O-10')).toBe('o-03');
    expect(current('O-12')).toBe('o-30');
    expect(current('O-13')).toBe('o-30');
    expect(current('O-50')).toBe('o-31');
    expect(current('O-23-1')).toBe('o-30');
    expect(isAhead('o-31', 'O-13')).toBe(true);
  });
});
