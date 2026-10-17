import { describe, expect, it } from 'vitest';
import { maskMoney, notiGroup, notiTime } from './notification';

// 14 N-01 6번 시간, 4번 묶음(이번 주 = 이번 주 월요일 ~ 어제). 2026-10-07은 수요일
const now = new Date('2026-10-07T15:00:00+09:00');
const at = (s: string) => new Date(s).toISOString();

describe('알림 시간', () => {
  it('방금, 분, 시간, 어제, 일, 날짜', () => {
    expect(notiTime(at('2026-10-07T14:59:30+09:00'), now)).toBe('방금');
    expect(notiTime(at('2026-10-07T14:48:00+09:00'), now)).toBe('12분 전');
    expect(notiTime(at('2026-10-07T13:00:00+09:00'), now)).toBe('2시간 전');
    expect(notiTime(at('2026-10-06T09:00:00+09:00'), now)).toBe('어제');
    expect(notiTime(at('2026-10-04T09:00:00+09:00'), now)).toBe('3일 전');
    expect(notiTime(at('2026-09-30T09:00:00+09:00'), now)).toBe('9월 30일');
  });
  it('묶음', () => {
    expect(notiGroup(at('2026-10-07T00:10:00+09:00'), now)).toBe('today');
    expect(notiGroup(at('2026-10-05T09:00:00+09:00'), now)).toBe('week'); // 월요일
    expect(notiGroup(at('2026-10-04T23:00:00+09:00'), now)).toBe('earlier'); // 일요일
  });
  it('금액 가리기', () => {
    expect(maskMoney('예산은 30만 원이에요')).toBe('예산은 •••이에요');
    expect(maskMoney('공동 생활비 260만 원 → 280만 5,000원')).toBe('공동 생활비 ••• → •••');
    expect(maskMoney('다음 주에 1억 2,000만 원이 나가요, 300,000원')).toBe(
      '다음 주에 •••이 나가요, •••',
    );
    expect(maskMoney('원래 계획')).toBe('원래 계획');
  });
});
