import { describe, expect, it } from 'vitest';
import { moneyInPeriod } from './money-in-period';
import {
  pickHero,
  pickHeroes,
  pickMonthLine,
  pickTopTask,
  reconcileTask,
  type HeroGoal,
  type MonthChecklist,
  type MonthLineInput,
  type TopTaskInput,
} from './home';
import { bundleView } from './saving-bundle';

// 19 ‘홈 v2.2’. 찬우(c, 시작한 사람), 예빈(y, 합류한 사람)
const MAN = 10_000;
const goal = (o: Partial<HeroGoal> & { id: string }): HeroGoal => ({
  name: o.id,
  status: 'active',
  closed_at: null,
  owner_user_id: 'c',
  target_amount: null,
  deadline: null,
  saved: 0,
  ...o,
});

describe('pickHero(H-10 대표 저금)', () => {
  const goals = [
    goal({ id: '비상금', saved: 900 * MAN }),
    goal({ id: '여행', target_amount: 300 * MAN, saved: 150 * MAN }),
    goal({ id: '가전', target_amount: 200 * MAN, saved: 160 * MAN }),
    goal({ id: '예빈 적금', owner_user_id: 'y', target_amount: 100 * MAN, saved: 99 * MAN }),
    goal({ id: '끝난 것', target_amount: 100 * MAN, saved: 100 * MAN, status: 'achieved' }),
    goal({ id: '묶인 것', bundle_id: 'b', target_amount: 100 * MAN, saved: 90 * MAN }),
  ];
  it('각자: 내 저금 중 목표 금액에 가까운 것 → 목표 없는 것 중 큰 것, 상대 개인 저금 빼고', () => {
    expect(
      pickHeroes({ meId: 'c', joint: false, goals, bundles: [] }).map(
        (h) => h.kind === 'goal' && h.goal.id,
      ),
    ).toEqual(['가전', '여행', '비상금']);
  });
  it('묶음(달성 전)이 맨 앞', () => {
    const b = bundleView(
      {
        id: 'b',
        name: '결혼 비용',
        status: 'active',
        target_amount: 5_000 * MAN,
        deadline: null,
        member_a: 'c',
        member_b: 'y',
        show_each_a: false,
        show_each_b: false,
        percent_only_a: false,
        percent_only_b: false,
      },
      [],
      'c',
    );
    expect(pickHero({ meId: 'c', joint: false, goals, bundles: [b] })?.kind).toBe('bundle');
    expect(
      pickHero({ meId: 'c', joint: false, goals, bundles: [{ ...b, status: 'achieved' }] })?.kind,
    ).toBe('goal');
  });
  it('합쳐서: 주인 있는 저금도 공동(공동 중 가까운 것 먼저)', () => {
    const h = pickHeroes({ meId: 'c', joint: true, goals, bundles: [] });
    expect(h[0]?.kind === 'goal' && h[0].goal.id).toBe('예빈 적금');
    expect(pickHero({ meId: 'c', joint: false, goals: [], bundles: [] })).toBeNull();
  });
});

describe('pickMonthLine(H-11 상태)', () => {
  const base: MonthLineInput = {
    today: '2026-11-13',
    noSalary: false,
    paydayNone: false,
    nonManager: false,
    base: 25,
  };
  const cur = (lines: MonthChecklist['lines']) => ({
    id: 'cl',
    cycle_start: '2026-10-25',
    cycle_end: '2026-11-24',
    lines,
  });
  it('첫 월급날 전(소급 없음)', () => {
    expect(pickMonthLine({ ...base, firstPayday: '2026-11-25' })).toMatchObject({
      kind: 'first',
      date: '2026-11-25',
    });
  });
  it('월급날 손 줄 남음 → 월급 전 확인 기간이면 W-05', () => {
    const c = cur([
      { state: 'wait' },
      { state: 'checked' },
      { state: 'wait', auto: true, auto_due: '2026-10-26' },
    ]);
    expect(pickMonthLine({ ...base, current: c })).toMatchObject({
      kind: 'payday',
      left: 1,
      to: '/salary',
    });
    expect(pickMonthLine({ ...base, today: '2026-11-22', current: c })).toMatchObject({
      kind: 'review',
      left: 1,
      to: '/salary/review?checklist=cl',
    });
  });
  it('자동 줄뿐 → “26일에 3개”', () => {
    const c = cur([
      { state: 'wait', auto: true, auto_due: '2026-10-26' },
      { state: 'wait', auto: true, auto_due: '2026-10-26' },
      { state: 'wait', auto: true, auto_due: '2026-10-26' },
    ]);
    expect(pickMonthLine({ ...base, current: c })).toMatchObject({
      kind: 'auto_only',
      next: { date: '2026-10-26', count: 3 },
    });
  });
  it('지난 달 끝 + 다음 월급날까지 12일 + 늦은 확인', () => {
    const c = cur([{ state: 'checked' }, { state: 'checked', auto: true }]);
    expect(pickMonthLine({ ...base, current: c })).toMatchObject({
      kind: 'done',
      finish: 'all',
      nextPayday: '2026-11-25',
      daysLeft: 12,
      late: 0,
    });
    const prev = {
      id: 'p',
      cycle_start: '2026-09-25',
      cycle_end: '2026-10-24',
      lines: [{ state: 'skipped' }],
    };
    expect(pickMonthLine({ ...base, current: c, previous: prev })).toMatchObject({
      kind: 'done',
      late: 1,
      to: '/salary?cycle=last',
    });
  });
  it('날짜 없음(H-13), 관리하지 않는 쪽, 월급 없음, 못 불러옴', () => {
    const period = moneyInPeriod(
      [{ amount: 200 * MAN, received_on: '2026-10-25' }],
      '2026-11-13',
      380 * MAN,
    );
    expect(pickMonthLine({ ...base, paydayNone: true, period })).toMatchObject({
      kind: 'period',
      display: 'bar',
      fillPct: 52,
      full: false,
    });
    expect(pickMonthLine({ ...base, paydayNone: true })).toMatchObject({
      kind: 'period',
      display: 'none',
    });
    expect(pickMonthLine({ ...base, nonManager: true }).kind).toBe('non_manager');
    expect(pickMonthLine({ ...base, noSalary: true }).kind).toBe('no_salary');
    expect(pickMonthLine({ ...base, error: true, noSalary: true }).kind).toBe('error');
  });
});

it('잔액 맞추기 띠(H-06 12번): 90일마다 14일 동안', () => {
  const o = { hasSaving: true, lastReconciledOn: null, firstSavingOn: '2026-08-01' };
  expect(reconcileTask({ ...o, today: '2026-10-29' })).toBeNull();
  expect(reconcileTask({ ...o, today: '2026-10-30' })).toEqual({
    key: 'reconcile:2026-10-30',
    due: '2026-10-30',
  });
  expect(reconcileTask({ ...o, today: '2026-11-12' })?.key).toBe('reconcile:2026-10-30');
  expect(reconcileTask({ ...o, today: '2026-11-13' })).toBeNull();
  expect(reconcileTask({ ...o, today: '2027-01-28' })?.due).toBe('2027-01-28');
  expect(reconcileTask({ ...o, lastReconciledOn: '2026-11-01', today: '2026-11-13' })).toBeNull();
  expect(reconcileTask({ ...o, hasSaving: false, today: '2026-10-30' })).toBeNull();
});

describe('pickTopTask(H-06 16순서)', () => {
  const base: TopTaskInput = {
    today: '2026-11-13',
    now: '2026-11-13T03:00:00Z',
    meId: 'c',
    coupleState: 'connected',
    joint: false,
    unlinkRequestedBy: null,
    reconnectFrom: null,
    onboardedOn: '2026-11-01',
    savingCount: 1,
  };
  const req = { id: 'r', from: 'y', status: 'open', expires_at: '2026-11-18T00:00:00Z' };
  it('없으면 null', () => expect(pickTopTask(base)).toBeNull());
  it('순서: 해제 > 다시 연결 > 관리 형태 > 분담 > 순위 > 월급 바뀜 > 첫 저금', () => {
    const all: TopTaskInput = {
      ...base,
      unlinkRequestedBy: 'y',
      reconnectFrom: 'y',
      modeRequest: { ...req, phrase: 'p04_send' },
      splitProposal: { ...req, name: '생활비 통장' },
      rankRequest: req,
      salaryChanged: { appliedDay: '2026-11-10', done: false },
      savingCount: 0,
    };
    const order: string[] = [];
    let i: TopTaskInput = all;
    for (let n = 0; n < 7; n++) {
      const t = pickTopTask(i);
      if (!t) break;
      order.push(t.kind);
      i = { ...i, closedKeys: [...(i.closedKeys ?? []), t.key] };
    }
    expect(order).toEqual([
      'unlink',
      'reconnect',
      'mode_request',
      'split_request',
      'rank_request',
      'salary_changed',
      'first_saving',
    ]);
  });
  it('요청: 내가 보낸 것·만료·닫힌 상태는 없음', () => {
    expect(pickTopTask({ ...base, rankRequest: { ...req, from: 'c' } })).toBeNull();
    expect(
      pickTopTask({ ...base, rankRequest: { ...req, expires_at: '2026-11-13T02:00:00Z' } }),
    ).toBeNull();
    expect(pickTopTask({ ...base, rankRequest: { ...req, status: 'accepted' } })).toBeNull();
    expect(pickTopTask({ ...base, rankRequest: req })).toMatchObject({
      kind: 'rank_request',
      to: '/assets/rank/consent/r',
    });
  });
  it('생활비 나누기: 각자 + 생활비 네 + 분담 없음 + 첫 30일, ‘이미 정했어요’면 영구히 없음', () => {
    const o = { ...base, sharedLiving: true };
    expect(pickTopTask(o)?.kind).toBe('split_suggest');
    expect(pickTopTask({ ...o, closedKeys: ['split_suggest'] })).toBeNull();
    expect(pickTopTask({ ...o, hasSplit: true })).toBeNull();
    expect(pickTopTask({ ...o, joint: true })).toBeNull();
    expect(pickTopTask({ ...o, today: '2026-12-01' })).toBeNull();
  });
  it('자동 줄 고르기 → 알림 다시 묻기 → 다음 저금 → 잔액 맞추기 → 파트너 저금 → 날짜 → 초대 → 기다리는 합류자', () => {
    const o: TopTaskInput = {
      ...base,
      today: '2027-01-02',
      now: '2027-01-02T00:00:00Z',
      coupleState: 'not_joined',
      autoPickOpen: true,
      pushReask: true,
      paydayNone: true,
      deadlineGoals: [
        {
          id: 'g',
          name: '여행',
          status: 'active',
          closed_at: null,
          target_amount: 300,
          deadline: '2026-12',
          saved: 100,
        },
      ],
      reconcile: { key: 'reconcile:2026-12-30', due: '2026-12-30' },
      cares: [
        {
          id: 'k',
          name: '엄마 생신',
          date_rule: 'solar_yearly',
          month: 1,
          day: 5,
          leap: false,
          once_on: null,
        },
      ],
      waitingJoiner: { name: '예빈' },
    };
    const order: string[] = [];
    let i = o;
    for (let n = 0; n < 9; n++) {
      const t = pickTopTask(i);
      if (!t) break;
      order.push(t.kind);
      i = { ...i, closedKeys: [...(i.closedKeys ?? []), t.key] };
    }
    expect(order).toEqual([
      'auto_pick',
      'push_reask',
      'next_saving',
      'reconcile',
      'care',
      'invite',
      'waiting_joiner',
    ]);
  });
  it('파트너 저금에 같이 모으기: 각자 + 연결 + 만든 지 7일 안 + 묶음 밖', () => {
    const partnerGoals = [
      { id: 'py', name: '결혼 비용', created_at: '2026-11-10T01:00:00Z', bundle_id: null },
    ];
    expect(pickTopTask({ ...base, partnerGoals })).toMatchObject({
      kind: 'bundle_invite',
      goalId: 'py',
    });
    expect(pickTopTask({ ...base, partnerGoals, today: '2026-11-17' })).toBeNull();
    expect(pickTopTask({ ...base, joint: true, partnerGoals })).toBeNull();
  });
  it('쓸 곳 메모 날짜(7일 안, 안 낸 것)', () => {
    const notes = [
      {
        id: 'n',
        name: '예식장 잔금',
        due_on: '2026-11-20',
        paid: false,
        goal_id: 'g',
        bundle_id: null,
      },
      { id: 'm', name: '계약금', due_on: '2026-11-14', paid: true, goal_id: 'g', bundle_id: null },
    ];
    expect(pickTopTask({ ...base, notes })).toMatchObject({
      kind: 'note',
      date: '2026-11-20',
      to: '/salary/items/g/notes',
    });
  });
});
