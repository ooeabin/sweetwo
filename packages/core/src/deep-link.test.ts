import { describe, expect, it } from 'vitest';
import { parseDeepLink } from './deep-link';

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
    expect(parseDeepLink('sweetwo://n')).toEqual({ kind: 'open', path: '/notifications' });
    expect(parseDeepLink('sweetwo://n/settings')).toEqual({
      kind: 'open',
      path: '/settings/notifications',
    });
    expect(parseDeepLink('sweetwo://n/settings/delete')).toBeNull();
    expect(parseDeepLink('sweetwo://n?to=/settings/delete')).toBeNull();
    expect(parseDeepLink('https://app.sweetwo.kr/auth/callback?code=a&state=b')).toBeNull();
    expect(parseDeepLink('sweetwo://i/../../x')).toBeNull();
    expect(parseDeepLink('이상한 값')).toBeNull();
  });
});

describe('parseDeepLink 모바일 앱 링크', () => {
  it('sweetwo.kr의 초대, 알림 링크', () => {
    expect(parseDeepLink('https://sweetwo.kr/i/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseDeepLink('https://sweetwo.kr/n')).toEqual({ kind: 'open', path: '/notifications' });
    expect(parseDeepLink('https://sweetwo.kr/n/settings/')).toEqual({
      kind: 'open',
      path: '/settings/notifications',
    });
  });
  it('로그인 콜백은 앱 링크로 받지 않음(sweetwo://만), 다른 주소도 버림', () => {
    expect(parseDeepLink('https://sweetwo.kr/auth/callback?code=a&state=b')).toBeNull();
    expect(parseDeepLink('https://evil.example/i/AB12CD')).toBeNull();
    expect(parseDeepLink('http://sweetwo.kr/i/AB12CD')).toBeNull();
    expect(parseDeepLink('https://sweetwo.kr:8443/i/AB12CD')).toBeNull();
    expect(parseDeepLink('https://sweetwo.kr/settings')).toBeNull();
  });
  it('위젯 링크(26)는 정한 화면만, sweetwo://로만', () => {
    const id = '0b9c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
    expect(parseDeepLink(`sweetwo://widget?to=/salary/items/${id}`)).toEqual({
      kind: 'open',
      path: `/salary/items/${id}`,
    });
    expect(parseDeepLink(`sweetwo://widget?to=/salary/bundles/${id}/notes`)).toEqual({
      kind: 'open',
      path: `/salary/bundles/${id}/notes`,
    });
    expect(parseDeepLink(`sweetwo://widget?to=/calendar/day/${id}`)).toEqual({
      kind: 'open',
      path: `/calendar/day/${id}`,
    });
    expect(parseDeepLink('sweetwo://widget?to=/')).toEqual({ kind: 'open', path: '/' });
    expect(parseDeepLink('sweetwo://widget?to=/settings/delete')).toBeNull();
    expect(parseDeepLink('sweetwo://widget?to=//evil.example')).toBeNull();
    expect(parseDeepLink(`sweetwo://widget?to=/salary/items/${id}&x=1`)).toBeNull();
    expect(parseDeepLink(`https://sweetwo.kr/widget?to=/salary/items/${id}`)).toBeNull();
  });
});
