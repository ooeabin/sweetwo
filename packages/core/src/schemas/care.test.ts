import { describe, expect, it } from 'vitest';
import { CareDaySchema, CareRecordSchema, RecordCareResultSchema } from './care';

describe('경조사 응답 검사(S9-15)', () => {
  it('경조사 행: 기록용 열은 없으면 기본값', () => {
    const r = CareDaySchema.parse({
      id: 'c-1',
      category: 'couple',
      kind: 'birthday',
      name: '어머니 생신',
      date_rule: 'solar_yearly',
      month: 10,
      day: 14,
      budget: 300000,
    });
    expect(r).toMatchObject({ once_on: null, status: 'todo', secret: false, alerts: [] });
  });
  it('모르는 날짜 규칙, 소수 금액은 거절', () => {
    const base = { id: 'c', category: 'couple', kind: 'x', name: 'x', budget: 0 };
    expect(CareDaySchema.safeParse({ ...base, date_rule: 'weekly' }).success).toBe(false);
    expect(
      CareDaySchema.safeParse({ ...base, date_rule: 'once', once_on: '2026-10-01', budget: 1.5 })
        .success,
    ).toBe(false);
  });
  it('기록 행, record_care 결과', () => {
    expect(
      CareRecordSchema.parse({
        id: 'r',
        care_day_id: 'c',
        occurs_on: '2026-10-14',
        amount: 250000,
        paid_from: 'personal',
      }).gifts,
    ).toEqual([]);
    expect(RecordCareResultSchema.parse({ record: 'r-1', line: 0 }).record).toBe('r-1');
    expect(RecordCareResultSchema.safeParse({ line: 0 }).success).toBe(false);
  });
});
