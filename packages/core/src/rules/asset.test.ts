import { expect, it } from 'vitest';
import { assetGroupsOf, netWorth } from './asset';

it('분류: 자산 8묶음, 부채 6묶음, 모두 기타(직접 입력)', () => {
  expect(assetGroupsOf('asset')).toHaveLength(8);
  expect(assetGroupsOf('debt')).toHaveLength(6);
  for (const g of [...assetGroupsOf('asset'), ...assetGroupsOf('debt')])
    expect(g.kinds.at(-1)?.key).toBe('other');
});

it('순자산 = 원금 기준, 예상 = 평가금액 기준, 비공개·판 항목 빼고 배우자 합계만 더함', () => {
  const n = netWorth(
    [
      { side: 'asset', amount: 3_000_000 },
      { side: 'asset', amount: 10_000_000, principal: 8_000_000 },
      { side: 'asset', amount: 500_000, visibility: 'private' },
      { side: 'asset', amount: 9_000_000, status: 'sold' },
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

it('재정 진단: 비상금 몇 개월, 요약 순서(06 8장)', async () => {
  const { emergencyMonths, diagnosisSummary } = await import('../onboarding/diagnosis');
  expect(emergencyMonths(5_000_000, 1_550_000)).toBe(3.2);
  expect(emergencyMonths(null, 1_000_000)).toBeNull();
  const s = diagnosisSummary([
    { key: 'savingRate', signal: 'good', pct: 33 },
    { key: 'emergency', signal: 'caution', pct: 60 },
    { key: 'loanBurden', signal: 'good', pct: 5 },
    { key: 'fixedRatio', signal: 'danger', pct: 70 },
    { key: 'investPrinciple', signal: 'unknown', pct: null },
  ]);
  expect(s.good).toBe(2);
  expect(s.ordered.map((x) => x.key)).toEqual([
    'fixedRatio',
    'emergency',
    'savingRate',
    'loanBurden',
    'investPrinciple',
  ]);
});
