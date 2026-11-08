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

it('이번 달 월급 상태: 진행 중 → 월급 전 확인 기간(다음 기준일 3일 전) → 다 했어요', () => {
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

it('할 일 한 줄 순서: 해제 요청 → 다시 연결 → 월급 전 확인 → 초대 → 만기 → 챙길 날(7일 안). 목표 금액 정하기는 없음(ADR 0007)', () => {
  const goal = {
    id: 'g',
    name: '여행',
    status: 'active',
    target_amount: null,
    deadline: null,
    owner_user_id: null,
    closed_at: null,
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
  // 월급 전 확인은 닫으면 이번 달만 안 보임
  const closedReview = homeTodo({
    ...all,
    unlinkRequestedBy: null,
    reconnectFrom: null,
    closed: [review?.kind === 'review' ? review.key : ''],
  });
  expect(closedReview?.kind).toBe('invite');
  const noReview = { ...all, unlinkRequestedBy: null, reconnectFrom: null, today: '2026-10-07' };
  expect(homeTodo(noReview)?.kind).toBe('invite');
  // 목표 금액이 없는 저금 항목이 있어도 할 일은 바로 만기로
  expect(homeTodo({ ...noReview, inviteClosedOn: '2026-10-05' })?.kind).toBe('matured');
  const noGoal = { ...noReview, inviteClosedOn: '2026-10-05', goals: [] };
  expect(homeTodo(noGoal)).toMatchObject({ kind: 'matured', to: '/assets/a/matured' });
  expect(homeTodo({ ...noGoal, closed: ['matured:a:2026-10-07'] })).toMatchObject({
    kind: 'care',
    date: '2026-10-12',
  });
  expect(homeTodo({ ...noGoal, closed: ['matured:a:2026-10-07', 'care:m:2026-10-12'] })).toBeNull();
});

it('다가오는 일정: 월급날, 월급 전 확인, 챙길 날, 목표 기한(목표 금액·기한이 있는 저금 항목만), 만기를 날짜순(같은 날은 챙길 날 먼저)', () => {
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
          status: 'active',
          target_amount: 1,
          // 기한 2026년 10월 = 10월 31일(그 달 말일, 2026-11-09)
          deadline: '2026-10-01',
          owner_user_id: null,
          closed_at: null,
        },
        {
          id: 'x',
          name: '그만 모은 여행',
          status: 'active',
          target_amount: 1,
          deadline: '2026-11-01',
          owner_user_id: null,
          closed_at: '2026-10-01',
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
    ['goal', '2026-10-31', 24],
  ]);
  expect(u.find((x) => x.kind === 'goal')?.to).toBe('/salary/items/g');
});

it('첫 주 할 일 ‘첫 저금 추가’(19 H-06 4b, 2026-11-09 round 3): 초대 다음, 7일 안, 내 저금이 없을 때만', () => {
  const goal = (over: Partial<HomeInput['goals'][number]> = {}) => ({
    id: 'g1',
    name: '여행',
    status: 'active',
    target_amount: null,
    deadline: null,
    owner_user_id: 'c',
    closed_at: null,
    ...over,
  });
  const first = base({ onboardedOn: '2026-10-01' });
  expect(homeTodo(first)).toEqual({
    kind: 'saving',
    key: 'saving-first',
    to: '/salary/items/new/a?from=home',
  });
  // 초대가 먼저
  expect(homeTodo({ ...first, coupleState: 'not_joined' })?.kind).toBe('invite');
  expect(
    homeTodo({ ...first, coupleState: 'not_joined', inviteClosedOn: '2026-10-06' })?.kind,
  ).toBe('saving');
  // 7일째(온보딩 날 + 7)부터는 없음
  expect(homeTodo({ ...first, today: '2026-10-08' })).toBeNull();
  expect(homeTodo({ ...first, onboardedOn: null })).toBeNull();
  // 내 저금이 있으면 없음, 파트너 저금·그만 모은 저금·휴지통은 셈하지 않음
  expect(homeTodo({ ...first, goals: [goal()] })).toBeNull();
  expect(homeTodo({ ...first, goals: [goal({ owner_user_id: 'y' })] })?.kind).toBe('saving');
  expect(homeTodo({ ...first, goals: [goal({ closed_at: '2026-10-02' })] })?.kind).toBe('saving');
  expect(homeTodo({ ...first, goals: [goal({ deleted_at: '2026-10-02' })] })?.kind).toBe('saving');
  // 합쳐서: 공동 월급 계획 저금(누구 것이든)이 있으면 없음, 공동 체크리스트가 없으면 없음
  expect(
    homeTodo({
      ...first,
      joint: true,
      checklists: [{ owner_user_id: null, label: '9월 월급', cycle_end: '2026-10-24', lines: [] }],
      goals: [goal({ owner_user_id: 'y' })],
    }),
  ).toBeNull();
  expect(homeTodo({ ...first, joint: true })).toBeNull();
  // 닫으면, 연결 해제 대기면 없음
  expect(homeTodo({ ...first, closed: ['saving-first'] })).toBeNull();
  expect(homeTodo({ ...first, coupleState: 'unlink_pending' })).toBeNull();
});
