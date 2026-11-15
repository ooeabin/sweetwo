import { describe, expect, it } from 'vitest';
import { heroZero, homeOrder, monthLineUrgent, type HeroGoal, type HeroItem } from './home';
import type { BundleView } from './saving-bundle';

// 19 ‘홈 순서’(2026-11-15 3차 검토). 찬우(시작한 사람) 홈
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
    expect(monthLineUrgent({ kind: 'no_salary', to: '/settings/me' })).toBe(false);
  });
});

describe('heroZero: H-10 첫 칸이 0원', () => {
  it('저금이 없으면 0원(상대 같이 모으기 권유는 아님)', () => {
    expect(heroZero([])).toBe(true);
    expect(heroZero([], true)).toBe(false);
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

describe('homeOrder', () => {
  it('할 일이 없고 돈이 있으면 띠·H-14 → H-10 → H-11', () => {
    expect(homeOrder({ urgent: false, heroZero: false })).toEqual([
      'tasks',
      'month_us',
      'hero',
      'month',
      'tiles',
      'wedding',
      'small',
    ]);
  });
  it('월급날 확인이 남으면 H-11이 맨 위, 띠, H-14, 그다음 H-10', () => {
    expect(homeOrder({ urgent: true, heroZero: false })).toEqual([
      'month',
      'tasks',
      'month_us',
      'hero',
      'tiles',
      'wedding',
      'small',
    ]);
  });
  it('0원 같이 모으기는 반 칸 타일 아래로', () => {
    expect(homeOrder({ urgent: true, heroZero: true })).toEqual([
      'month',
      'tasks',
      'month_us',
      'tiles',
      'hero',
      'wedding',
      'small',
    ]);
    expect(homeOrder({ urgent: false, heroZero: true })).toEqual([
      'tasks',
      'month_us',
      'month',
      'tiles',
      'hero',
      'wedding',
      'small',
    ]);
  });
});
