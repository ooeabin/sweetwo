import { expect, it } from 'vitest';
import { splitLeft, splitProgress, splitRows, type SplitCheckLine } from './split';

const line = (o: Partial<SplitCheckLine> & { id: string }): SplitCheckLine => ({
  target: 'account',
  account_role: 'living',
  kind: 'split',
  sort: 0,
  amount_groom: null,
  amount_bride: null,
  groom_done_at: null,
  groom_done_by: null,
  groom_done_amount: null,
  bride_done_at: null,
  bride_done_by: null,
  bride_done_amount: null,
  ...o,
});

it('월급 나누기: 사람마다 몫 있는 공동 통장 줄만, 진행은 두 사람 몫 전체', () => {
  const lines = [
    line({
      id: 'l',
      sort: 0,
      amount_groom: 520_000,
      amount_bride: 350_000,
      groom_done_at: 't',
      groom_done_amount: 500_000,
    }),
    line({
      id: 'g',
      account_role: 'goal_fund',
      sort: 1,
      amount_groom: 1_800_000,
      amount_bride: 1_200_000,
    }),
    line({ id: 'e', account_role: 'emergency', sort: 2, amount_groom: 220_000, amount_bride: 0 }),
    line({ id: 'p', account_role: 'personal', sort: 3, amount_groom: 300_000 }),
    line({ id: 'x', target: 'goal', account_role: null, amount_groom: 1 }),
  ];
  const chanwoo = splitRows(lines, 'groom');
  expect(chanwoo.map((r) => r.lineId)).toEqual(['l', 'g', 'e']);
  expect(chanwoo[0]).toMatchObject({ done: true, amount: 520_000, doneAmount: 500_000 });
  expect(splitRows(lines, 'bride').map((r) => r.lineId)).toEqual(['l', 'g']);
  expect(splitProgress(lines)).toEqual({ done: 1, total: 5 });
  expect(splitLeft(lines, 'groom')).toEqual({ count: 2, amount: 2_020_000 });
});
