import { describe, expect, it } from 'vitest';
import {
  heroZero,
  homeOrder,
  monthCheck,
  monthLineUrgent,
  type HeroGoal,
  type HeroItem,
} from './home';
import type { BundleView } from './saving-bundle';

// 19 ‘홈 순서’(2026-11-17 메뉴 서랍과 같은 이름·순서). 찬우(시작한 사람) 홈
const goal = (saved: number): HeroItem => ({
  kind: 'goal',
  goal: {
    id: 'g1',
    name: '여행',
    status: 'active',
    closed_at: null,
    owner_user_id: 'c',
    target_amount: 3_000_000,
    deadline: null,
    saved,
  } satisfies HeroGoal,
});
const bundle = (p: Partial<BundleView>): HeroItem => ({
  kind: 'bundle',
  bundle: {
    id: 'b1',
    name: '결혼 비용',
    status: 'active',
    deadline: null,
    paused: false,
    percent_only: false,
    show_each: true,
    my_show_each: true,
    my_percent_only: false,
    pct: 0,
    total: 0,
    target: 50_000_000,
    mine: 0,
    partner: 0,
    goals: [{ id: 'g1', mine: true, name: '결혼 비용' }],
    ...p,
  },
});

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

describe('heroZero: H-10 첫 칸이 0원', () => {
  it('항목이 없으면 상자를 안 그리니 0원이 아님(2026-11-18)', () => {
    expect(heroZero([])).toBe(false);
  });
  it('대표 저금 모은 금액 0원이면 0원, 30만 원이면 아님', () => {
    expect(heroZero([goal(0)])).toBe(true);
    expect(heroZero([goal(300_000)])).toBe(false);
  });
  it('묶음: 합계 0원·0%면 0원, 안 들어간 묶음(예빈이 만듦)은 아님', () => {
    expect(heroZero([bundle({})])).toBe(true);
    expect(heroZero([bundle({ total: 1_000_000, pct: 2 })])).toBe(false);
    expect(heroZero([bundle({ percent_only: true, total: null, pct: 0 })])).toBe(true);
    expect(heroZero([bundle({ goals: [{ id: 'g2', mine: false, name: '결혼 비용' }] })])).toBe(
      false,
    );
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

describe('homeOrder(2026-11-17)', () => {
  it('띠 → 같이 모으기 → 결혼 준비 → 월급 상자 → 반 칸 타일 둘', () => {
    expect(homeOrder({ heroZero: false })).toEqual(['tasks', 'hero', 'wedding', 'salary', 'tiles']);
  });
  it('0원 같이 모으기는 월급 상자 아래, 결혼 준비는 그래도 같이 모으기 바로 아래', () => {
    expect(homeOrder({ heroZero: true })).toEqual(['tasks', 'salary', 'hero', 'wedding', 'tiles']);
  });
  it('같이 모으기 항목이 없으면 H-10을 안 그림(결혼 준비·월급 상자·타일은 그대로)', () => {
    expect(homeOrder({ heroZero: false, heroNone: true })).toEqual([
      'tasks',
      'wedding',
      'salary',
      'tiles',
    ]);
  });
  it('H-11·H-14·큰 반 칸 타일(월급 계획)·저금 타일은 홈 블록에 없음', () => {
    const all = [...homeOrder({ heroZero: false }), ...homeOrder({ heroZero: true })] as string[];
    for (const gone of ['month', 'month_us', 'small']) expect(all).not.toContain(gone);
  });
});
