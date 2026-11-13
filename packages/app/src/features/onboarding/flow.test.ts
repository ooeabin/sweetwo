import { describe, expect, it } from 'vitest';
import {
  current,
  isAhead,
  nextOf,
  passed,
  prevOf,
  progressOf,
  screens,
  type FlowState,
} from './flow';

// 온보딩 화면 순서(16·17 v2.2, 2026-11-13: O-06 없앰, O-30 세 질문, O-55 알림 허용. 이어하기는 가장 멀리 간 화면)
const st = (
  o: { me?: Record<string, unknown>; space?: Record<string, unknown> } = {},
): FlowState => ({
  me: (o.me ?? null) as FlowState['me'],
  space: (o.space ?? null) as FlowState['space'],
});

describe('screens', () => {
  it('처음(생활비 아직 모름): O-03 → O-11 → O-30 → O-30b → O-31 → O-32 → O-55 → O-60', () => {
    expect(screens(st())).toEqual([
      'o-03',
      'o-11',
      'o-30',
      'o-30b',
      'o-31',
      'o-32',
      'o-55',
      'o-60',
    ]);
  });
  it('생활비 ‘네’면 O-30c', () => {
    expect(screens(st({ space: { shared_living: true } }))).toEqual([
      'o-03',
      'o-11',
      'o-30',
      'o-30b',
      'o-30c',
      'o-31',
      'o-32',
      'o-55',
      'o-60',
    ]);
  });
  it('생활비 ‘아니요’면 O-30c 없음', () => {
    expect(screens(st({ space: { shared_living: false } }))).not.toContain('o-30c');
  });
  it('월급 없음(0원)이면 O-32 없이 O-55', () => {
    const l = screens(st({ me: { monthly_income: 0 } }));
    expect(l).not.toContain('o-32');
    expect(nextOf('o-31', l)).toBe('o-55');
  });
  it('연결 해제 뒤: O-30부터(이름·두 사람 사이 건너뜀)', () => {
    expect(screens(st({ space: { unlinked_from: 'x' } }))[0]).toBe('o-30');
  });
});

describe('앞뒤', () => {
  const list = screens(st());
  it('첫 화면 O-03과 O-60은 뒤로 없음', () => {
    expect(prevOf('o-03', list)).toBeUndefined();
    expect(prevOf('o-60', list)).toBeUndefined();
  });
  it('O-31 뒤로는 O-30b(생활비 아니요) / O-30c(생활비 네)', () => {
    expect(prevOf('o-31', list)).toBe('o-30b');
    expect(prevOf('o-31', screens(st({ space: { shared_living: true } })))).toBe('o-30c');
  });
  it('진행 막대: O-03 = 1/7, O-55 = 7/7, O-60 없음', () => {
    expect(progressOf('o-03', list)?.steps).toEqual({ total: 7, done: 1 });
    expect(progressOf('o-55', list)?.fill).toBe(100);
    expect(progressOf('o-60', list)).toBeUndefined();
  });
});

describe('이어하기 기록', () => {
  it('가장 멀리 간 화면만(S2-23)', () => {
    expect(isAhead('o-31', 'O-11')).toBe(true);
    expect(isAhead('o-11', 'O-31')).toBe(false);
    expect(isAhead('o-03', null)).toBe(true);
    expect(isAhead('o-31', 'P-03')).toBe(false);
    expect(isAhead('o-30c', 'O-30B')).toBe(true);
  });
  it('뺀 화면은 옮김(O-06·O-07은 2026-11-13 O-11로)', () => {
    expect(current('O-10')).toBe('o-03');
    expect(current('O-06')).toBe('o-11');
    expect(current('O-07')).toBe('o-11');
    expect(current('O-12')).toBe('o-30');
    expect(current('O-13')).toBe('o-30');
    expect(current('O-50')).toBe('o-31');
    expect(current('O-23-1')).toBe('o-30');
    expect(isAhead('o-31', 'O-13')).toBe(true);
  });
  it('지나간 화면만 고른 값을 보여 줌(미리 고른 값 없음)', () => {
    expect(passed('o-30', 'O-30')).toBe(false);
    expect(passed('o-30', 'O-30B')).toBe(true);
    expect(passed('o-30', null)).toBe(false);
  });
});
