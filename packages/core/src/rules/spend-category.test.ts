import { expect, it } from 'vitest';
import { groupSpendLines, SPEND_CATEGORIES, spendCategoryOf } from './spend-category';

it('지출 묶음 code: 서버 check 제약과 같은 10개', () => {
  expect(SPEND_CATEGORIES).toEqual([
    'living',
    'housing',
    'telecom',
    'subscription',
    'transport',
    'car',
    'insurance',
    'loan',
    'family',
    'relation',
  ]);
});

it('줄의 묶음: 직접 추가 줄은 저장된 값, 그 밖은 없음(2026-11-28 생활비 기본 줄 없음)', () => {
  expect(spendCategoryOf({ kind: 'custom', category: 'living' })).toBe('living');
  expect(spendCategoryOf({ kind: 'living', category: null })).toBeNull();
  expect(spendCategoryOf({ kind: 'custom', category: 'housing' })).toBe('housing');
  expect(spendCategoryOf({ kind: 'custom', category: null })).toBeNull();
  expect(spendCategoryOf({ kind: 'custom', category: 'snack' })).toBeNull();
  expect(spendCategoryOf({ kind: 'fixed', category: 'housing' })).toBeNull();
  expect(spendCategoryOf({ kind: 'allowance' })).toBeNull();
});

it('W-01 묶기: 묶음 순서대로, 줄 순서 그대로, 묶음 없는 줄은 맨 아래', () => {
  const lines = [
    { id: 'a', kind: 'custom', category: 'housing' },
    { id: 'b', kind: 'fixed', category: null },
    { id: 'c', kind: 'custom', category: 'living' },
    { id: 'd', kind: 'custom', category: 'living' },
    { id: 'e', kind: 'custom', category: null },
  ];
  const g = groupSpendLines(lines);
  expect(g.groups.map((x) => [x.category, x.lines.map((l) => l.id)])).toEqual([
    ['living', ['c', 'd']],
    ['housing', ['a']],
  ]);
  expect(g.rest.map((l) => l.id)).toEqual(['b', 'e']);
});
