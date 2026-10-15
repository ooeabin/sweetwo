import { expect, it } from 'vitest';
import { formatMonthDay } from '../date';
import { spaceBaseDay } from './couple';
import { proposalApplyOn } from './proposal';

const kst = (s: string) => new Date(`${s}+09:00`);

it('적용일 = 72시간이 지난 첫 기준일(08 6-3)', () => {
  // 10월 20일 낮 → 23일 낮이 72시간, 첫 기준일 25일
  expect(proposalApplyOn(25, kst('2026-10-20T12:00:00'))).toBe('2026-10-25');
  // 10월 23일 낮 → 26일 낮, 25일은 지났으니 11월 25일
  expect(proposalApplyOn(25, kst('2026-10-23T12:00:00'))).toBe('2026-11-25');
  // 정확히 22일 0시 → 25일 0시가 72시간째, 25일 적용
  expect(proposalApplyOn(25, kst('2026-10-22T00:00:00'))).toBe('2026-10-25');
  // 말일 기준
  expect(proposalApplyOn('last', kst('2027-02-10T09:00:00'))).toBe('2027-02-28');
});

it('제안 기준일 = 정해 둔 기준일, 없으면 두 월급날 중 늦은 날', () => {
  const c = { myPayday: 10, partnerPayday: 25 } as Parameters<typeof spaceBaseDay>[1];
  expect(spaceBaseDay({ base_day: null, base_day_last: false }, c)).toBe(25);
  expect(spaceBaseDay({ base_day: 1, base_day_last: false }, c)).toBe(1);
  expect(spaceBaseDay({ base_day: null, base_day_last: true }, c)).toBe('last');
  expect(formatMonthDay(proposalApplyOn(25, kst('2026-10-07T10:00:00')))).toBe('10월 25일');
});
