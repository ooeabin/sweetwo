import { describe, expect, it } from 'vitest';
import { homeOrder, monthCheck, monthLineUrgent } from './home';

// 19 ‘홈 순서’(2026-11-17 메뉴 서랍과 같은 이름·순서, 2026-11-20 고정). 찬우(시작한 사람) 홈
describe('monthLineUrgent: H-11이 확인할 것을 말할 때', () => {
  it('월급날 손 줄 남음, 월급날 뒤 남음, 늦은 확인은 할 일', () => {
    expect(
      monthLineUrgent({
        kind: 'payday',
        cycleStart: '2026-11-25',
        left: 2,
        late: 0,
        to: '/salary',
      }),
    ).toBe(true);
    expect(
      monthLineUrgent({ kind: 'left', cycleStart: '2026-11-25', left: 1, late: 0, to: '/salary' }),
    ).toBe(true);
    expect(
      monthLineUrgent({
        kind: 'done',
        cycleStart: '2026-10-25',
        finish: 'all',
        nextPayday: '2026-11-25',
        daysLeft: 3,
        late: 1,
        to: '/salary',
      }),
    ).toBe(true);
  });
  it('다 끝남, 자동뿐, 첫 월급날 전, 월급 없음은 할 일 아님', () => {
    expect(
      monthLineUrgent({
        kind: 'done',
        cycleStart: '2026-10-25',
        finish: 'all',
        nextPayday: '2026-11-25',
        daysLeft: 3,
        late: 0,
        to: '/salary',
      }),
    ).toBe(false);
    expect(
      monthLineUrgent({
        kind: 'auto_only',
        cycleStart: '2026-11-25',
        next: null,
        late: 0,
        to: '/salary',
      }),
    ).toBe(false);
    expect(monthLineUrgent({ kind: 'first', date: '2026-11-25', to: '/salary' })).toBe(false);
  });
});

describe('monthCheck: 할 일 띠 5b 재료', () => {
  it('월급날 당일·월급날 뒤·확인 목록 기간에 손 줄이 남으면 그 종류와 수', () => {
    expect(
      monthCheck({ kind: 'payday', cycleStart: '2026-11-25', left: 1, late: 0, to: '/salary' }),
    ).toEqual({ kind: 'payday', left: 1, late: 0, cycleStart: '2026-11-25', to: '/salary' });
    expect(
      monthCheck({ kind: 'left', cycleStart: '2026-11-25', left: 2, late: 1, to: '/salary' }),
    ).toEqual({ kind: 'left', left: 2, late: 1, cycleStart: '2026-11-25', to: '/salary' });
    expect(
      monthCheck({ kind: 'review', cycleStart: '2026-11-25', left: 1, late: 0, to: '/salary' })
        ?.kind,
    ).toBe('review');
  });
  it('손 줄은 없고 지난 달 늦은 확인만 남으면 late, 이동은 지난 달', () => {
    expect(
      monthCheck({
        kind: 'done',
        cycleStart: '2026-10-25',
        finish: 'all',
        nextPayday: '2026-11-25',
        daysLeft: 3,
        late: 2,
        to: '/salary?cycle=last',
      }),
    ).toEqual({
      kind: 'late',
      left: 0,
      late: 2,
      cycleStart: '2026-10-25',
      to: '/salary?cycle=last',
    });
  });
  it('확인할 것이 없으면 null', () => {
    expect(
      monthCheck({
        kind: 'auto_only',
        cycleStart: '2026-11-25',
        next: null,
        late: 0,
        to: '/salary',
      }),
    ).toBeNull();
    expect(monthCheck({ kind: 'first', date: '2026-11-25', to: '/salary/plan' })).toBeNull();
  });
});

describe('homeOrder(2026-11-20 고정)', () => {
  it('띠 → 같이 모으기 → 월급 상자 → 반 칸 타일 둘 → 다가오는 날(2026-11-26 H-12 결혼 준비 상자 없앰)', () => {
    expect(homeOrder()).toEqual(['tasks', 'hero', 'salary', 'tiles', 'upcoming']);
  });
  it('같이 모으기 모은 금액이 0원이어도 순서는 그대로(월급 상자가 H-10 위로 올라가지 않음)', () => {
    // 항목이 있으면 모은 금액과 상관없이 heroNone이 아니니 같은 순서
    expect(homeOrder({ heroNone: false })).toEqual(homeOrder());
    expect(homeOrder().indexOf('hero')).toBeLessThan(homeOrder().indexOf('salary'));
  });
  it('같이 모으기 항목이 없으면 H-10을 안 그림(월급 상자·타일은 그대로)', () => {
    expect(homeOrder({ heroNone: true })).toEqual(['tasks', 'salary', 'tiles', 'upcoming']);
  });
  it('H-11·H-14·큰 반 칸 타일(월급 계획)·저금 타일은 홈 블록에 없음', () => {
    const all = homeOrder() as string[];
    for (const gone of ['month', 'month_us', 'small', 'wedding']) expect(all).not.toContain(gone);
  });
});
