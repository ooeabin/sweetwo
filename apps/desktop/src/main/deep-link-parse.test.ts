import { describe, expect, it } from 'vitest';
import { findDeepLink, parseDeepLink } from './deep-link-parse';

describe('parseDeepLink', () => {
  it('로그인 콜백은 code와 state만', () => {
    expect(
      parseDeepLink('sweetwo://auth/callback?code=abc-123&state=xyz&next=https://evil.example'),
    ).toEqual({
      kind: 'auth',
      code: 'abc-123',
      state: 'xyz',
    });
  });
  it('브라우저에서 취소', () => {
    expect(parseDeepLink('sweetwo://auth/callback?error=access_denied&state=xyz')).toEqual({
      kind: 'auth_error',
      error: 'access_denied',
      state: 'xyz',
    });
    expect(parseDeepLink('sweetwo://auth/callback?error=<script>&state=xyz')).toBeNull();
  });
  it('state가 없으면 버린다', () => {
    expect(parseDeepLink('sweetwo://auth/callback?code=abc')).toBeNull();
  });
  it('초대 링크', () => {
    expect(parseDeepLink('sweetwo://i/AB12CD')).toEqual({ kind: 'invite', code: 'AB12CD' });
  });
  it('허용 목록 밖은 버린다', () => {
    expect(parseDeepLink('sweetwo://settings/delete')).toBeNull();
    expect(parseDeepLink('https://app.sweetwo.kr/auth/callback?code=a&state=b')).toBeNull();
    expect(parseDeepLink('sweetwo://i/../../x')).toBeNull();
    expect(parseDeepLink('이상한 값')).toBeNull();
  });
  it('실행 인자에서 링크 찾기(Windows second-instance)', () => {
    expect(findDeepLink(['sweeTwo.exe', '--flag', 'sweetwo://i/AB12CD'])).toBe(
      'sweetwo://i/AB12CD',
    );
  });
});
