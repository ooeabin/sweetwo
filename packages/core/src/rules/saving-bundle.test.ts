import { expect, it } from 'vitest';
import {
  bundleNextStatus,
  bundlePct,
  bundleTargetDefault,
  bundleView,
  canPercentOnly,
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
