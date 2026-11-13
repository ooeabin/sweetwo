import { describe, expect, it } from 'vitest';
import { authorizeUrl, challengeOf } from './pkce';

// 데스크톱 앱(ADR 0008로 없앰)의 PKCE 시험을 모바일 웹뷰용으로 옮김
describe('PKCE', () => {
  it('RFC 7636 부록 B 예시', async () => {
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
  it('authorize 주소', async () => {
    const u = new URL(
      await authorizeUrl({
        supabaseUrl: 'https://x.supabase.co',
        webOrigin: 'https://sweetwo.kr',
        provider: 'kakao',
        verifier: 'v',
        state: 's1',
      }),
    );
    expect(u.pathname).toBe('/auth/v1/authorize');
    expect(u.searchParams.get('provider')).toBe('kakao');
    expect(u.searchParams.get('redirect_to')).toBe(
      'https://sweetwo.kr/auth/callback?from=app&state=s1',
    );
    expect(u.searchParams.get('code_challenge_method')).toBe('s256');
  });
});
