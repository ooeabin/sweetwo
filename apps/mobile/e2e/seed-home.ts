import { chanwoo } from './supabase-mock';
import type { MemDb } from './onboarding-mock';

// 홈·월급 e2e 공통 준비: 온보딩을 마친 찬우(혼자, 각자, 실수령 350만, 월급날 25일), 저금 항목 비상금(목표 금액 없음)·내 집 마련,
// 월급 계획과 9월 월급 체크리스트(9월 25일 ~ 10월 24일).
const LINES: [string, string | null, number][] = [
  ['saving', 'goal-e', 440_000],
  ['saving', 'goal-h', 950_000],
  ['fixed', null, 880_000],
  ['living', null, 880_000],
  ['allowance', null, 350_000],
];

/** 온보딩을 마친 찬우: 저금 항목(비상금, 내 집 마련), 월급 계획, 9월 월급 체크리스트 */
export function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    space_id: 'space-1',
    onboarding_done_at: '2026-10-01T00:00:00Z',
    onboarding_step: 'O-60',
    monthly_income: 3_500_000,
    payday: 25,
    birth_year: 1994,
  });
  db.space = {
    id: 'space-1',
    created_by: chanwoo.id,
    couple_state: 'not_joined',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    salary_mode: 'separate',
    joint_cycle_day: null,
    holiday_shift: true,
    partner_nickname: null,
    split_ratio: null,
    partner_income: null,
    partner_income_unknown: false,
    partner_income_estimated: false,
    base_day: null,
    base_day_last: false,
    version: 1,
  };
  // 저금 항목(ADR 0007): 각자 모드라 찬우 것. 비상금은 목표 금액 없이 모으는 항목
  const goal = (
    id: string,
    name: string,
    priority: number,
    target: number | null,
    deadline: string | null,
  ) => ({
    id,
    template: 'custom',
    name,
    kind: 'once',
    priority,
    target_amount: target,
    other_held: 0,
    deadline,
    status: 'active',
    owner_user_id: chanwoo.id,
    created_by: chanwoo.id,
    visibility: 'all',
    details: {},
    closed_at: null,
    deleted_at: null,
    created_at: '2026-10-01T00:00:00Z',
  });
  db.goals.push(
    goal('goal-e', '비상금', 0, null, null),
    goal('goal-h', '내 집 마련', 1, 150_000_000, '2031-10-01'),
  );
  const split_line = LINES.map(([kind, goal_id, amount], i) => ({
    id: `split-1-line-${i}`,
    split_id: 'split-1',
    kind,
    goal_id,
    user_id: kind === 'allowance' ? chanwoo.id : null,
    name: null,
    amount,
    sort: i,
  }));
  db.splits.push({ id: 'split-1', owner_user_id: chanwoo.id, split_line });
  db.checklists.push({
    id: 'checklist-1',
    split_id: 'split-1',
    owner_user_id: chanwoo.id,
    label: '9월 월급',
    cycle_start: '2026-09-25',
    cycle_end: '2026-10-24',
    state: 'open',
    pay_check_line: split_line.map((l) => ({
      ...l,
      id: `${l.id}-c`,
      planned: l.amount,
      actual: null,
      state: 'wait',
      checked_by: null,
      checked_at: null,
    })),
  });
}
