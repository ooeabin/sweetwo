import { describe, expect, it } from 'vitest';
import {
  emailTypoSuggestion,
  isWeakPin,
  LoginState,
  NotifyEmail,
  Pin,
  pinRemainingNotice,
} from './auth';

describe('알림 이메일(A-04)', () => {
  it('앞뒤 공백 제거, 소문자', () => {
    expect(NotifyEmail.parse('  YeBin@Mail.com ')).toBe('yebin@mail.com');
    expect(NotifyEmail.parse('ye.bin+sweetwo@mail.co.kr')).toBe('ye.bin+sweetwo@mail.co.kr');
  });
  it('형식이 틀리면 거부(가운데 공백은 말없이 지우지 않음)', () => {
    for (const e of [
      'yebin@mail',
      '',
      'a@b.c',
      'a@b..com',
      '.yebin@mail.com',
      'ye..bin@mail.com',
      'yebin.@mail.com',
      'ye bin@mail.com',
      'yebin @mail.com',
      'yebin@-mail.com',
      'yebin@mail.c0m',
      'yebin@@mail.com',
      `${'a'.repeat(65)}@mail.com`,
      `a@${'b'.repeat(250)}.com`,
    ])
      expect(NotifyEmail.safeParse(e).success, e).toBe(false);
  });
  it('흔한 도메인 오타는 고친 주소를 알려 줌', () => {
    expect(emailTypoSuggestion('yebin@gmail.con')).toBe('yebin@gmail.com');
    expect(emailTypoSuggestion('yebin@gmial.com')).toBe('yebin@gmail.com');
    expect(emailTypoSuggestion('Yebin@Naver.co')).toBe('yebin@naver.com');
    expect(emailTypoSuggestion('yebin@hanmail.ent')).toBe('yebin@hanmail.net');
    expect(emailTypoSuggestion('yebin@company.cmo')).toBe('yebin@company.com');
    expect(emailTypoSuggestion('yebin@gmail.com')).toBeNull();
    expect(emailTypoSuggestion('yebin@mail.co.kr')).toBeNull();
    expect(emailTypoSuggestion('yebin')).toBeNull();
  });
});

describe('PIN(A-06)', () => {
  it('같은 숫자, 연속 숫자는 약한 PIN', () => {
    for (const p of ['000000', '777777', '123456', '654321', '345678'])
      expect(isWeakPin(p), p).toBe(true);
    for (const p of ['135790', '120925', '111112', '258036', '112234', '121213'])
      expect(isWeakPin(p), p).toBe(false);
  });
  it('9 다음 0으로 도는 연속(오름·내림), 두 개씩 3번, 두 숫자 번갈아도 약한 PIN(2026-11-10)', () => {
    for (const p of ['890123', '901234', '789012', '098765', '210987', '109876'])
      expect(isWeakPin(p), p).toBe(true);
    for (const p of ['112233', '998877', '001122']) expect(isWeakPin(p), p).toBe(true);
    for (const p of ['121212', '909090', '373737']) expect(isWeakPin(p), p).toBe(true);
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
