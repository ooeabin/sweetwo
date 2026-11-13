import { describe, expect, it } from 'vitest';
import { monthProgress, planChangeTouchesMonth, type MonthLine } from './month-progress';
import * as mp from './month-progress';

// 기획서 06 3-6 예시 표 그대로(찬우 350만, 저금 청약 44만·내 집 마련 95만, 지출 고정지출 88만·생활비 80만·용돈 35만)
const man = (n: number) => n * 10_000;
const line = (
  kind: string,
  planned: number,
  state = 'wait',
  actual: number | null = null,
): MonthLine => ({
  kind,
  planned: man(planned),
  state,
  actual: actual === null ? null : man(actual),
});
const base = (states: string[] = []): MonthLine[] =>
  (
    [
      ['saving', 44],
      ['saving', 95],
      ['fixed', 88],
      ['living', 80],
      ['allowance', 35],
    ] as const
  ).map(([k, v], i) => line(k, v, states[i] ?? 'wait'));

describe('이번 달 진행(06 3-6)', () => {
  it('아무것도 안 함: 칸 너비는 W-01과 같음, 채움 0, 보낸 금액 0 / 342만', () => {
    const p = monthProgress({ income: man(350), lines: base() });
    expect(p.ratio).toEqual({ saving: 40, spend: 58, free: 2, left: man(8) });
    expect(p.fill).toEqual({ saving: 0, spend: 0 });
    expect([p.sent, p.planned]).toEqual([0, man(342)]);
    expect([p.checked, p.done, p.total, p.complete]).toEqual([0, 0, 5, false]);
  });
  it('청약 + 고정지출 체크: 저금 44/139 → 31%, 지출 88/203 → 43%, 보낸 금액 132만', () => {
    const p = monthProgress({ income: man(350), lines: base(['checked', 'wait', 'checked']) });
    expect(p.fill).toEqual({ saving: 31, spend: 43 });
    expect(p.sent).toBe(man(132));
    expect(p.checked).toBe(2);
  });
  it('모두 체크: 채움 100 / 100, 막대는 계획과 같음', () => {
    const p = monthProgress({ income: man(350), lines: base(Array(5).fill('checked')) });
    expect(p.fill).toEqual({ saving: 100, spend: 100 });
    expect(p.ratio).toEqual({ saving: 40, spend: 58, free: 2, left: man(8) });
    expect(p.sent).toBe(man(342));
    expect(p.complete).toBe(true);
    expect(p.left).toBe(man(8));
  });
  it('다른 금액 + 못 함: 생활비 70만으로, 청약 못 함 → 저금 95/139 = 68%, 지출 다 체크 = 100, 보낸 금액 288만', () => {
    const ls = base(['skipped', 'checked', 'checked', 'checked', 'checked']);
    ls[3] = line('living', 80, 'checked', 70);
    const p = monthProgress({ income: man(350), lines: ls });
    expect(p.fill).toEqual({ saving: 68, spend: 100 });
    expect(p.sent).toBe(man(288));
    expect(p.spendSent).toBe(man(193));
    expect(p.complete).toBe(true);
    expect(p.checked).toBe(4);
    expect(p.done).toBe(5);
    expect(p.left).toBe(man(62));
  });
  it('계획보다 많이 보냈지만 남은 줄이 있으면 99에서 멈춤', () => {
    const ls = [line('saving', 50, 'checked', 120), line('saving', 50)];
    expect(monthProgress({ income: man(300), lines: ls }).fill.saving).toBe(99);
  });
  it('줄이 없는 묶음, 0원 계획은 0', () => {
    const p = monthProgress({ income: 0, lines: [line('fixed', 0)] });
    expect(p.fill).toEqual({ saving: 0, spend: 0 });
    expect(p.ratio).toEqual({ saving: 0, spend: 0, free: 0, left: 0 });
  });
});

describe('W-01 금액 바꾸기가 이번 달 줄도 바꾸는지(sync_checklist 맞춤)', () => {
  const plan = {
    id: 'l-living',
    kind: 'living',
    goal_id: null,
    user_id: null,
    name: null,
    amount: man(88),
  };
  const month = (state: string, split_line_id: string | null = null) => [
    { split_line_id, kind: 'living', goal_id: null, user_id: null, name: null, state },
  ];
  it('체크 안 한 줄이면 바뀜', () => {
    expect(planChangeTouchesMonth(plan, man(80), month('wait', 'l-living'))).toBe(true);
  });
  it('체크한 줄(id나 종류·이름으로 맞춤)이면 안 바뀜', () => {
    expect(planChangeTouchesMonth(plan, man(80), month('checked', 'l-living'))).toBe(false);
    expect(planChangeTouchesMonth(plan, man(80), month('skipped'))).toBe(false);
  });
  it('금액이 같거나 이번 달 체크리스트가 없으면 안 바뀜', () => {
    expect(planChangeTouchesMonth(plan, man(88), month('wait'))).toBe(false);
    expect(planChangeTouchesMonth(plan, man(80), null)).toBe(false);
  });
  it('0원이라 체크리스트에 없던 줄도 금액이 생기면 새로 생김', () => {
    expect(planChangeTouchesMonth({ ...plan, amount: 0 }, man(10), [])).toBe(true);
  });
});

// 07 5장 사이클 상태(2026-11-12 D4): 체크 또는 ‘못 함’이면 끝남. 모두 체크 = 다 했어요, ‘못 함’ 섞임 = 마쳤어요
describe('체크리스트 다 끝남(checklistFinish, finishAfter)', () => {
  const ls = (...states: string[]) => states.map((state, i) => ({ id: `l${i}`, state }));
  it('체크 안 한 줄이 있으면 안 끝남, 모두 체크면 all, 못 함이 섞이면 mixed', () => {
    const { checklistFinish } = mp;
    expect(checklistFinish(ls('checked', 'wait'))).toBeNull();
    expect(checklistFinish(ls('checked', 'checked'))).toBe('all');
    expect(checklistFinish(ls('checked', 'skipped'))).toBe('mixed');
    expect(checklistFinish(ls('skipped', 'skipped'))).toBe('mixed');
    expect(checklistFinish([])).toBeNull();
  });
  it('마지막 줄을 바꿀 때만 끝남(이미 끝났거나 풀면 null), 다른 금액 0원은 못 함', () => {
    const { finishAfter } = mp;
    expect(finishAfter(ls('checked', 'wait'), 'l1', 'checked')).toBe('all');
    expect(finishAfter(ls('checked', 'wait'), 'l1', 'skipped')).toBe('mixed');
    expect(finishAfter(ls('checked', 'wait'), 'l1', 'checked', 0)).toBe('mixed');
    expect(finishAfter(ls('wait', 'wait'), 'l1', 'checked')).toBeNull();
    expect(finishAfter(ls('checked', 'checked'), 'l1', 'wait')).toBeNull();
    expect(finishAfter(ls('checked', 'skipped'), 'l1', 'checked')).toBeNull();
  });
});
