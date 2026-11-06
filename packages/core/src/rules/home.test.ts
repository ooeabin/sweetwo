import { expect, it } from 'vitest';
import { homeTodo, homeUpcoming, salaryState, type HomeInput } from './home';

// 찬우(혼자, 각자, 월급날 25일), 9월 월급 사이클 9월 25일 ~ 10월 24일
const base = (over: Partial<HomeInput> = {}): HomeInput => ({
  today: '2026-10-07',
  meId: 'c',
  joint: false,
  coupleState: 'connected',
  checklists: [
    {
      owner_user_id: 'c',
      label: '9월 월급',
      cycle_end: '2026-10-24',
      lines: [{ state: 'checked' }, { state: 'wait' }, { state: 'skipped' }, { state: 'wait' }],
    },
    { owner_user_id: 'y', label: '9월 월급', cycle_end: '2026-10-09', lines: [{ state: 'wait' }] },
  ],
  goals: [],
  cares: [],
  assets: [],
  unlinkRequestedBy: null,
  reconnectFrom: null,
  inviteClosedOn: null,
  closed: [],
  ...over,
});

it('이번 달 월급 상태: 진행 중 → 월말 확인 기간(다음 기준일 3일 전) → 다 했어요', () => {
  expect(salaryState(base())).toEqual({
    state: 'progress',
    label: '9월 월급',
    done: 1,
    total: 4,
    left: 2,
    nextPayday: '2026-10-25',
  });
  expect(salaryState(base({ today: '2026-10-22' })).state).toBe('review');
  expect(salaryState(base({ joint: true })).state).toBe('none');
});

it('할 일 한 줄 순서: 해제 요청 → 다시 연결 → 월말 확인 → 초대 → 목표 금액 → 만기 → 챙길 날(7일 안)', () => {
  const goal = {
    id: 'g',
    name: '여행',
    template: 'travel',
    status: 'active',
    target_amount: null,
    deadline: null,
    owner_user_id: null,
  };
  const asset = {
    id: 'a',
    name: '청년 적금',
    side: 'asset',
    kind: 'saving',
    owner: 'person',
    owner_user_id: 'c',
    maturity_date: '2026-10-07',
  };
  const care = {
    id: 'm',
    name: '어머니 생신',
    date_rule: 'solar_yearly' as const,
    month: 10,
    day: 12,
    leap: false,
    once_on: null,
  };
  const all = base({
    today: '2026-10-22',
    unlinkRequestedBy: 'y',
    reconnectFrom: 'y',
    coupleState: 'not_joined',
    goals: [goal],
    assets: [asset],
    cares: [care],
  });
  expect(homeTodo(all)?.kind).toBe('unlink');
  expect(homeTodo({ ...all, unlinkRequestedBy: 'c' })?.kind).toBe('reconnect');
  const review = homeTodo({ ...all, unlinkRequestedBy: null, reconnectFrom: null });
  expect(review).toMatchObject({ kind: 'review', left: 2 });
  // 월말 확인은 닫으면 이번 달만 안 보임
  const closedReview = homeTodo({
    ...all,
    unlinkRequestedBy: null,
    reconnectFrom: null,
    closed: [review?.kind === 'review' ? review.key : ''],
  });
  expect(closedReview?.kind).toBe('invite');
  const noReview = { ...all, unlinkRequestedBy: null, reconnectFrom: null, today: '2026-10-07' };
  expect(homeTodo(noReview)?.kind).toBe('invite');
  const amount = homeTodo({ ...noReview, inviteClosedOn: '2026-10-05' });
  expect(amount).toMatchObject({ kind: 'amount', goal: '여행' });
  // 목표 금액 정하기도 닫을 수 있음
  expect(
    homeTodo({
      ...noReview,
      inviteClosedOn: '2026-10-05',
      closed: [amount?.kind === 'amount' ? amount.key : ''],
    })?.kind,
  ).toBe('matured');
  const noGoal = { ...noReview, inviteClosedOn: '2026-10-05', goals: [] };
  expect(homeTodo(noGoal)).toMatchObject({ kind: 'matured', to: '/assets/a/matured' });
  expect(homeTodo({ ...noGoal, closed: ['matured:a:2026-10-07'] })).toMatchObject({
    kind: 'care',
    date: '2026-10-12',
  });
  expect(homeTodo({ ...noGoal, closed: ['matured:a:2026-10-07', 'care:m:2026-10-12'] })).toBeNull();
});

it('다가오는 일정: 월급날, 월말 확인, 챙길 날, 목표 기한, 만기를 날짜순(같은 날은 챙길 날 먼저)', () => {
  const u = homeUpcoming(
    base({
      cares: [
        {
          id: 'm',
          name: '어머니 생신',
          date_rule: 'solar_yearly',
          month: 10,
          day: 25,
          leap: false,
          once_on: null,
        },
      ],
      goals: [
        {
          id: 'g',
          name: '여행',
          template: 'travel',
          status: 'active',
          target_amount: 1,
          deadline: '2026-11-01',
          owner_user_id: null,
        },
      ],
      assets: [
        {
          id: 'a',
          name: '청년 적금',
          side: 'asset',
          kind: 'saving',
          owner: 'joint',
          owner_user_id: null,
          maturity_date: '2026-10-30',
        },
      ],
    }),
  );
  expect(u.map((x) => [x.kind, x.date, x.dday])).toEqual([
    ['review', '2026-10-22', 15],
    ['care', '2026-10-25', 18],
    ['payday', '2026-10-25', 18],
    ['maturity', '2026-10-30', 23],
    ['goal', '2026-11-01', 25],
  ]);
});
