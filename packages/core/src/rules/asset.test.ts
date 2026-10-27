import { expect, it } from 'vitest';
import { investPrinciple } from '../onboarding/diagnosis';
import {
  QUICK_ASSETS,
  QUICK_LOANS,
  assetGroup,
  avgRate,
  assetGroupsOf,
  investSummary,
  netWorth,
  netWorthSeries,
  periodEnabled,
  periodSlice,
  startPeriod,
  withKindNames,
} from './asset';

it('분류: 자산 8묶음, 부채 6묶음, 모두 기타(직접 입력)', () => {
  expect(assetGroupsOf('asset')).toHaveLength(8);
  expect(assetGroupsOf('debt')).toHaveLength(6);
  for (const g of [...assetGroupsOf('asset'), ...assetGroupsOf('debt')])
    expect(g.kinds.at(-1)?.key).toBe('other');
});

it('순자산 = 원금 기준, 예상 = 평가금액 기준, 비공개·판 항목·만기 완료 항목 빼고 배우자 합계만 더함', () => {
  const n = netWorth(
    [
      { side: 'asset', amount: 3_000_000 },
      { side: 'asset', amount: 10_000_000, principal: 8_000_000 },
      { side: 'asset', amount: 500_000, visibility: 'private' },
      { side: 'asset', amount: 9_000_000, status: 'sold' },
      { side: 'asset', amount: 5_000_000, status: 'matured' },
      { side: 'debt', amount: 1_000_000 },
    ],
    [{ side: 'asset', total: 4_400_000, principal_total: 4_000_000 }],
  );
  expect(n).toEqual({
    assets: 17_400_000,
    debts: 1_000_000,
    net: 14_000_000,
    expected: 16_400_000,
    gain: 2_400_000,
  });
});

it('순자산 그래프: 이번 달은 지금 값, 앞쪽 빈 달은 뺌', () => {
  const s = netWorthSeries(
    [
      { month: '2026-07-01', net: 0, expected: 0 },
      { month: '2026-08-01', net: 12_000_000, expected: 12_000_000 },
      { month: '2026-09-01', net: 14_200_000, expected: 16_000_000 },
      { month: '2026-10-01', net: 15_000_000, expected: 15_000_000 },
    ],
    { net: 16_000_000, expected: 18_400_000 },
    '2026-10-01',
  );
  expect(s.map((x) => x.month)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  expect(s.at(-1)).toEqual({ month: '2026-10-01', net: 16_000_000, expected: 18_400_000 });
  expect(netWorthSeries([], { net: 0, expected: 0 }, '2026-10-01')).toHaveLength(1);
});

it('기간 탭: 데이터보다 긴 기간은 비활성, 1년 미만이면 전체로 시작, 기억한 탭 우선', () => {
  expect(periodEnabled(6, 5)).toBe(false);
  expect(periodEnabled(null, 1)).toBe(true);
  expect(startPeriod(8)).toBeNull();
  expect(startPeriod(12)).toBe(12);
  expect(startPeriod(40, 36)).toBe(36);
  expect(startPeriod(8, 36)).toBeNull();
  expect(startPeriod(8, 6)).toBe(6);
  expect(periodSlice([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([2, 3, 4, 5, 6, 7]);
});

it('투자 묶음 줄: 비중은 총자산(평가금액) 대비, 손익은 원금 있는 항목만', () => {
  const r = investSummary(
    [
      { side: 'asset', grp: 'cash', amount: 6_000_000 },
      { side: 'asset', grp: 'invest', amount: 11_200_000, principal: 10_000_000 },
      { side: 'asset', grp: 'invest', amount: 800_000 },
      { side: 'asset', grp: 'invest', amount: 5_000_000, visibility: 'private' },
      { side: 'debt', grp: 'credit', amount: 9_000_000 },
    ],
    [{ side: 'asset', grp: 'invest', total: 2_000_000 }],
  );
  // (1,120 + 80 + 200) ÷ (600 + 1,120 + 80 + 200) = 70%
  expect(r).toEqual({ sharePct: 70, gain: 1_200_000, gainPct: 12 });
  expect(investSummary([{ side: 'asset', grp: 'invest', amount: 1 }]).gain).toBeNull();
});

it('투자 원칙: 보수적인 쪽 허용 비중, 한 명만이면 one, 혼자 쓰기는 내 답으로 both', () => {
  expect(investPrinciple(null, null)).toEqual({ state: null, limit: null });
  expect(investPrinciple('active', null)).toEqual({ state: 'one', limit: 60 });
  expect(investPrinciple(null, 'some')).toEqual({ state: 'one', limit: 30 });
  expect(investPrinciple('active', 'some')).toEqual({ state: 'both', limit: 30 });
  expect(investPrinciple('unsure', 'active')).toEqual({ state: 'both', limit: 0 });
  expect(investPrinciple('some', null, true)).toEqual({ state: 'both', limit: 30 });
});

it('첫 주 정리 칩: 묶음과 세부 항목이 분류에 있고, 금리 평균은 06 4장 초기값', () => {
  for (const q of [...QUICK_ASSETS, ...QUICK_LOANS]) {
    const g = assetGroup(q.grp);
    expect(g?.kinds.some((k) => k.key === q.kind)).toBe(true);
    expect(q.name.length).toBeLessThanOrEqual(20);
  }
  expect([avgRate('jeonse_loan'), avgRate('credit_loan'), avgRate('student_loan')]).toEqual([
    4, 6, 2,
  ]);
  expect(avgRate('family_loan')).toBeNull();
});

it('AD-19 항목 이름 목록: 기본 항목 이름 바꾸기·숨기기, 새 칩은 기본 항목 동작, 기타는 마지막', () => {
  const groups = withKindNames(assetGroupsOf('asset'), [
    { id: 'a', grp: 'deposit', base: 'saving', name: '자유적금', added: false, hidden: false },
    { id: 'b', grp: 'deposit', base: 'term_deposit', name: '정기예금', added: false, hidden: true },
    { id: 'c', grp: 'deposit', base: 'policy_saving', name: '청년도약계좌', added: true, hidden: false },
    { id: 'd', grp: 'deposit', base: 'etf', name: '그룹 밖', added: true, hidden: false },
    { id: 'e', grp: 'cash', base: 'bank', name: '현금성은 안 고침', added: false, hidden: true },
  ]);
  const dep = groups.find((g) => g.key === 'deposit');
  expect(dep?.kinds.map((k) => [k.key, k.name])).toEqual([
    ['saving', '자유적금'],
    ['policy_saving', '정책형 적금'],
    ['policy_saving', '청년도약계좌'],
    ['other', '기타(직접 입력)'],
  ]);
  expect(dep?.kinds[2]?.id).toBe('c');
  expect(groups.find((g) => g.key === 'cash')).toBe(assetGroup('cash'));
});
