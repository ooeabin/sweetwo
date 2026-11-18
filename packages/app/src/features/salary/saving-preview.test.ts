import { expect, it } from 'vitest';
import { previewSavingLines } from './saving-preview';

const won = (v: number) => `${v / 10_000}만 원`;
const ex = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: `저축${i}`, amount: 100_000 }));

it('W-11f 줄: 기존 줄은 최대 2개 + “외 n개”, 새 줄은 맨 아래 “새로” 강조', () => {
  const none = previewSavingLines([], { name: '여행', monthly: 300_000 }, won);
  expect(none.map((l) => l.name)).toEqual(['여행']);
  expect(none[0]).toMatchObject({ amount: '매달 30만 원', badge: '새로', fresh: true });
  expect(
    previewSavingLines(ex(2), { name: '여행', monthly: 300_000 }, won).map((l) => l.name),
  ).toEqual(['저축0', '저축1', '여행']);
  const many = previewSavingLines(ex(5), { name: '여행', monthly: 300_000 }, won);
  expect(many.map((l) => l.name)).toEqual(['저축0', '저축1', '외 3개', '여행']);
  expect(many[0]?.amount).toBe('매달 10만 원');
});

it('W-11f 줄: 매달 0원이면 “매달 금액 없음”', () => {
  const l = previewSavingLines([], { name: '여행', monthly: 0 }, won);
  expect(l[0]).toMatchObject({ amount: '매달 금액 없음', muted: true });
});
