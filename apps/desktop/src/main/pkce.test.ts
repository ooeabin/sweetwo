import { describe, expect, it } from 'vitest';
import { authorizeUrl, challengeOf } from './pkce';

describe('PKCE', () => {
  it('RFC 7636 부록 B 예시', () => {
    expect(challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
  it('authorize 주소', () => {
    const u = new URL(
      authorizeUrl({
        supabaseUrl: 'https://x.supabase.co',
        webOrigin: 'https://app.sweetwo.kr',
        provider: 'kakao',
        verifier: 'v',
        state: 's1',
      }),
    );
    expect(u.pathname).toBe('/auth/v1/authorize');
    expect(u.searchParams.get('provider')).toBe('kakao');
    expect(u.searchParams.get('redirect_to')).toBe(
      'https://app.sweetwo.kr/auth/callback?from=desktop&state=s1',
    );
    expect(u.searchParams.get('code_challenge_method')).toBe('s256');
  });
});
