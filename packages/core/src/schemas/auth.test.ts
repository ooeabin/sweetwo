import { describe, expect, it } from 'vitest';
import { isWeakPin, LoginState, NotifyEmail, Pin, pinRemainingNotice } from './auth';

describe('알림 이메일(A-04)', () => {
  it('공백 제거, 소문자', () => {
    expect(NotifyEmail.parse('  YeBin @Mail.com ')).toBe('yebin@mail.com');
  });
  it('형식이 틀리면 거부', () => {
    expect(NotifyEmail.safeParse('yebin@mail').success).toBe(false);
    expect(NotifyEmail.safeParse('').success).toBe(false);
  });
});

describe('PIN(A-06)', () => {
  it('같은 숫자, 연속 숫자는 약한 PIN', () => {
    for (const p of ['000000', '777777', '123456', '654321', '345678'])
      expect(isWeakPin(p)).toBe(true);
    for (const p of ['135790', '120925', '111112']) expect(isWeakPin(p)).toBe(false);
  });
  it('6자리 숫자만', () => {
    expect(Pin.safeParse('12a456').success).toBe(false);
    expect(Pin.safeParse('20251').success).toBe(false);
    expect(Pin.safeParse('120925').success).toBe(true);
  });
  it('3회째부터 남은 기회 안내', () => {
    expect(pinRemainingNotice(2)).toBeNull();
    expect(pinRemainingNotice(3)).toBe(2);
    expect(pinRemainingNotice(4)).toBe(1);
  });
});

describe('login_state 응답', () => {
  it('다른 소셜로 가입된 계정', () => {
    expect(LoginState.parse({ state: 'provider_conflict', provider: 'kakao' })).toEqual({
      state: 'provider_conflict',
      provider: 'kakao',
    });
  });
  it('모르는 값은 거부', () => {
    expect(
      LoginState.safeParse({
        state: 'existing',
        provider: 'naver',
        onboarding_done: true,
        onboarding_step: null,
      }).success,
    ).toBe(false);
  });
});
