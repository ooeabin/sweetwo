import { describe, expect, it } from 'vitest';
import {
  bundleNextStatus,
  bundlePct,
  bundleTargetDefault,
  bundleView,
  canPercentOnly,
  joinableBundle,
  savingsTotal,
  waitingBundle,
  type BundleRow,
} from './saving-bundle';

// 06 5-6 예: 찬우 ‘결혼 비용’ 2,100만 + 예빈 ‘결혼 비용’ 1,500만 = 3,600만, 묶음 목표 5,000만 → 72%
const MAN = 10_000;
const b: BundleRow = {
  id: 'b',
  name: '결혼 비용',
  status: 'active',
  target_amount: 5_000 * MAN,
  deadline: '2027-05-01',
  member_a: 'c',
  member_b: 'y',
  show_each_a: false,
  show_each_b: false,
  percent_only_a: false,
  percent_only_b: false,
};
const goals = [
  { id: 'gc', name: '결혼 비용', owner_user_id: 'c', saved: 2_100 * MAN },
  { id: 'gy', name: '결혼 비용', owner_user_id: 'y', saved: 1_500 * MAN },
];

it('기본은 합계만(상대 금액 없음)', () => {
  const v = bundleView(b, goals, 'c');
  expect(v).toMatchObject({
    total: 3_600 * MAN,
    target: 5_000 * MAN,
    pct: 72,
    mine: 2_100 * MAN,
    partner: null,
  });
  expect(v.goals).toEqual([
    { id: 'gc', mine: true, name: '결혼 비용' },
    { id: 'gy', mine: false, name: '결혼 비용' },
  ]);
});

it('각자 금액은 두 사람이 모두 켰을 때만', () => {
  expect(bundleView({ ...b, show_each_a: true }, goals, 'c').partner).toBeNull();
  const v = bundleView({ ...b, show_each_a: true, show_each_b: true }, goals, 'y');
  expect(v).toMatchObject({
    mine: 1_500 * MAN,
    partner: 2_100 * MAN,
    show_each: true,
    my_show_each: true,
  });
});

it('한 사람이라도 했어요만이면 둘 다 켜도 각자 금액 없음, 그 사람 저금 이름은 상대에게 없음(20261208090000)', () => {
  const both = { ...b, show_each_a: true, show_each_b: true };
  const c = bundleView(both, goals, 'c', false, ['y']);
  expect(c).toMatchObject({
    total: 3_600 * MAN,
    mine: 2_100 * MAN,
    partner: null,
    show_each: false,
  });
  expect(c.goals).toEqual([
    { id: 'gc', mine: true, name: '결혼 비용' },
    { id: 'gy', mine: false, name: null },
  ]);
  // 했어요만인 예빈 화면도 같게(상대 금액 없음, 자기 저금 이름은 그대로)
  const y = bundleView(both, goals, 'y', false, ['y']);
  expect(y).toMatchObject({ partner: null, show_each: false });
  expect(y.goals.find((g) => g.mine)?.name).toBe('결혼 비용');
});

it('하나라도 퍼센트만이면 둘 모두에게 %만', () => {
  for (const me of ['c', 'y']) {
    const v = bundleView(
      { ...b, percent_only_b: true, show_each_a: true, show_each_b: true },
      goals,
      me,
    );
    expect(v).toMatchObject({
      percent_only: true,
      pct: 72,
      total: null,
      target: null,
      mine: null,
      partner: null,
    });
  }
  expect(canPercentOnly(null)).toBe(false);
  expect(canPercentOnly(5_000 * MAN)).toBe(true);
});

it('해제 대기: 상대 몫 빼고 멈춤', () => {
  expect(bundleView(b, goals, 'c', true)).toMatchObject({
    paused: true,
    total: 2_100 * MAN,
    pct: 42,
  });
});

it('달성은 합계 기준, 내려가면 되돌림, 목표 금액 없으면 그대로', () => {
  expect(bundleNextStatus('active', 5_000 * MAN, 5_000 * MAN)).toBe('achieved');
  expect(bundleNextStatus('achieved', 4_999 * MAN, 5_000 * MAN)).toBe('active');
  expect(bundleNextStatus('active', 9_000 * MAN, null)).toBe('active');
  expect(bundleNextStatus('closed', 9_000 * MAN, 1)).toBe('closed');
  expect(bundlePct(9_000 * MAN, 5_000 * MAN)).toBe(100);
  expect(bundlePct(1, null)).toBeNull();
});

it('묶음 목표 금액 처음 값(Q11): 둘 다 있으면 합', () => {
  expect(bundleTargetDefault(3_000 * MAN, 2_000 * MAN)).toBe(5_000 * MAN);
  expect(bundleTargetDefault(3_000 * MAN, null)).toBeNull();
});

describe('묶음 하나씩(H1)과 홈 저금 합(M1)', () => {
  const b = (id: string, goals: { id: string; mine: boolean }[], total: number | null = 0) => ({
    id,
    status: 'active' as const,
    total,
    goals: goals.map((g) => ({ ...g, name: null })),
  });
  it('상대 저금만 든 묶음은 들어갈 묶음, 내 저금만 든 묶음은 기다리는 묶음', () => {
    const list = [b('x', [{ id: 'c', mine: false }]), b('y', [{ id: 'y1', mine: true }])];
    expect(joinableBundle(list)?.id).toBe('x');
    expect(waitingBundle(list)?.id).toBe('y');
    expect(
      joinableBundle([
        b('z', [
          { id: 'a', mine: true },
          { id: 'b', mine: false },
        ]),
      ]),
    ).toBeUndefined();
  });
  it('예빈 쪽: 찬우 결혼 비용(가림) 묶음 20만 원 + 예빈 비상금 0원 = 20만 원, 2개', () => {
    const items = [
      { id: 'c', saved: 0, bundle_id: 'x' }, // 상대 묶인 저금(서버가 금액을 가림)
      { id: 'y', saved: 0, bundle_id: null },
    ];
    expect(savingsTotal(items, [b('x', [{ id: 'c', mine: false }], 200_000)])).toEqual({
      count: 2,
      total: 200_000,
    });
  });
  it('퍼센트만이면 합계 대신 내 저금 모은 금액만', () => {
    const items = [
      { id: 'c', saved: 3_000_000, bundle_id: 'x' },
      { id: 'y', saved: 0, bundle_id: 'x' },
    ];
    expect(
      savingsTotal(items, [
        b(
          'x',
          [
            { id: 'c', mine: true },
            { id: 'y', mine: false },
          ],
          null,
        ),
      ]),
    ).toEqual({ count: 1, total: 3_000_000 });
  });
});
