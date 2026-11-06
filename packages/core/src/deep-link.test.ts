import { describe, expect, it } from 'vitest';
import { parseDeepLink } from './deep-link';

// 데스크톱 시험(apps/desktop deep-link-parse.test.ts)에 더해 모바일 앱 링크
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
});
