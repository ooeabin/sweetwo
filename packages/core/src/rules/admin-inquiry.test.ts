import { expect, it } from 'vitest';
import { businessHoursSince, inquiryOverdue } from './admin-inquiry';

// 27 AD-06 2번: 1영업일 넘으면 강조(주말, 공휴일 뺌). 시각은 KST
it('평일 하루를 꽉 채우면 1영업일', () => {
  // 2026-11-02(월) 10:00 KST → 11-03(화) 10:00
  expect(
    businessHoursSince('2026-11-02T01:00:00Z', new Set(), new Date('2026-11-03T01:00:00Z')),
  ).toBe(24);
  expect(inquiryOverdue('2026-11-02T01:00:00Z', new Set(), new Date('2026-11-03T00:59:00Z'))).toBe(
    false,
  );
});

it('금요일 저녁 문의는 주말을 빼고 월요일에 1영업일', () => {
  // 2026-11-06(금) 18:00 KST → 11-09(월) 18:00 = 금 6시간 + 월 18시간
  const from = '2026-11-06T09:00:00Z';
  expect(inquiryOverdue(from, new Set(), new Date('2026-11-08T23:00:00Z'))).toBe(false);
  expect(businessHoursSince(from, new Set(), new Date('2026-11-09T09:00:00Z'))).toBe(24);
});

it('공휴일도 뺌', () => {
  // 2026-12-24(목) 10:00 → 12-25(금) 성탄절 → 12-28(월) 10:00 = 목 14 + 월 10
  const h = new Set(['2026-12-25']);
  expect(businessHoursSince('2026-12-24T01:00:00Z', h, new Date('2026-12-28T01:00:00Z'))).toBe(24);
});
