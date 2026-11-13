import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'web' },
  registerPlugin: () => ({}),
}));
const { codeFromClipboard, codeFromReferrer } = await import('./invite-code');

describe('초대 코드 자동 입력(31 2장)', () => {
  it('설치 리퍼러 invite_{코드}', () => {
    expect(codeFromReferrer('invite_ABC234')).toBe('ABC234');
    expect(codeFromReferrer('utm_source=site&referrer=invite_abc234')).toBe('ABC234');
    expect(codeFromReferrer('referrer%3Dinvite_ABC234')).toBe('ABC234');
    expect(codeFromReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
    // 헷갈리는 글자(I, O, 0, 1)는 코드가 아님
    expect(codeFromReferrer('invite_ABCD10')).toBeNull();
    expect(codeFromReferrer('invite_ABC2345')).toBeNull();
    expect(codeFromReferrer(null)).toBeNull();
  });
  it('클립보드는 코드 6자만', () => {
    expect(codeFromClipboard(' abc234\n')).toBe('ABC234');
    expect(codeFromClipboard('내 코드는 ABC234')).toBeNull();
    expect(codeFromClipboard('https://sweetwo.kr/i/ABC234')).toBeNull();
    expect(codeFromClipboard(null)).toBeNull();
  });
});
