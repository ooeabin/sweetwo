import { expect, it } from 'vitest';
import {
  incomeRatioAllowed,
  partnerLineVisible,
  partnerPlanView,
  shareNarrowed,
  type PlanViewLine,
} from './share-view';

// 예빈(각자 계열)의 월급 계획을 찬우가 볼 때(서버 partner_plan_view와 같은 자르기, pgTAP v22_share_filter)
const line = (id: string, kind: PlanViewLine['kind'], amount: number): PlanViewLine => ({
  id,
  kind,
  goal_id: kind === 'saving' ? 'g' : null,
  name: kind === 'saving' ? '여행' : null,
  user_id: null,
  amount,
  in_checklist: true,
  auto_pay: false,
  state: 'checked',
});
const lines = [
  line('1', 'saving', 300_000),
  line('2', 'fixed', 700_000),
  line('3', 'shared_account', 400_000),
];
const view = (share: 'all' | 'saving_only' | 'done_only', joint = false, unlinkPending = false) =>
  partnerPlanView({
    owner: 'y',
    nickname: '예빈',
    share,
    joint,
    unlinkPending,
    income: 2_800_000,
    payday: 25,
    lines,
  });

it('모두: 수입·월급날·모든 줄 금액', () => {
  const v = view('all');
  expect(v).toMatchObject({ income: 2_800_000, payday: 25, hidden: false });
  expect(v.lines.map((l) => l.amount)).toEqual([300_000, 700_000, 400_000]);
});

it('저금만(기본): 저금·같이 쓰는 통장 줄 금액, 수입 없음', () => {
  const v = view('saving_only');
  expect(v).toMatchObject({ income: null, payday: null });
  expect(v.lines.map((l) => [l.kind, l.amount])).toEqual([
    ['saving', 300_000],
    ['shared_account', 400_000],
  ]);
});

it('했어요만: 저금 줄 이름 + 확인 여부만', () => {
  const v = view('done_only');
  expect(v.lines).toHaveLength(1);
  expect(v.lines[0]).toMatchObject({ name: '여행', amount: null, state: 'checked' });
});

it('같이 계열은 모두, 해제 대기는 모두 가림', () => {
  expect(view('done_only', true).lines).toHaveLength(3);
  expect(view('all', false, true)).toMatchObject({ hidden: true, lines: [], income: null });
  expect(partnerLineVisible('fixed', { share: 'all', joint: false, unlinkPending: true })).toBe(
    false,
  );
});

it('좁히기와 월급 비율 허용', () => {
  expect(shareNarrowed('all', 'saving_only')).toBe(true);
  expect(shareNarrowed('done_only', 'all')).toBe(false);
  expect(
    incomeRatioAllowed({ share: 'all', income: 3_500_000 }, { share: 'all', income: 2_800_000 }),
  ).toBe(true);
  expect(
    incomeRatioAllowed(
      { share: 'all', income: 3_500_000 },
      { share: 'saving_only', income: 2_800_000 },
    ),
  ).toBe(false);
  expect(
    incomeRatioAllowed({ share: 'all', income: 3_500_000 }, { share: 'all', income: null }),
  ).toBe(false);
});
