import type { Page, Route } from '@playwright/test';

// 가짜 Supabase(http://127.0.0.1:54399). 테스트마다 응답을 정한다.
export const SB = 'http://127.0.0.1:54399';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const fakeJwt = (sub: string) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

export const chanwoo = { id: '11111111-1111-1111-1111-111111111111', email: 'chanwoo@example.com' };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });

export interface MockOptions {
  minVersionWeb?: string;
  /** 점검 시간(AD-16) */
  maintenance?: { starts: string; ends: string; message?: string };
  loginState?: unknown;
  signup?: (body: Record<string, unknown>) => void;
}

export async function mockSupabase(page: Page, o: MockOptions = {}) {
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    }
    const url = new URL(req.url());
    if (url.pathname === '/rest/v1/app_config') {
      return json(route, {
        min_version_desktop: '0.0.0',
        min_version_web: o.minVersionWeb ?? '0.0.0',
        maintenance_starts_at: o.maintenance?.starts ?? null,
        maintenance_ends_at: o.maintenance?.ends ?? null,
        maintenance_message: o.maintenance?.message ?? null,
      });
    }
    if (url.pathname === '/auth/v1/token') {
      return json(route, {
        access_token: fakeJwt(chanwoo.id),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'rt-e2e',
        user: {
          id: chanwoo.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: chanwoo.email,
          app_metadata: { provider: 'kakao' },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (url.pathname === '/rest/v1/rpc/login_state')
      return json(route, o.loginState ?? { state: 'new', needs_email: false });
    if (url.pathname === '/rest/v1/rpc/complete_signup') {
      o.signup?.(req.postDataJSON() as Record<string, unknown>);
      return json(route, { id: chanwoo.id });
    }
    // 가입 뒤 온보딩 첫 화면(O-10)까지
    if (url.pathname === '/rest/v1/app_user') {
      return json(route, {
        id: chanwoo.id,
        provider: 'kakao',
        nickname: null,
        side: null,
        birth_year: null,
        employment: null,
        space_id: 'space-1',
        onboarding_step: null,
        onboarding_done_at: null,
      });
    }
    if (url.pathname === '/rest/v1/rpc/ensure_my_space') return json(route, 'space-1');
    if (url.pathname === '/rest/v1/couple_space') return json(route, null);
    if (url.pathname === '/rest/v1/goal') return json(route, []);
    if (url.pathname === '/rest/v1/rpc/space_goals') return json(route, []);
    if (url.pathname === '/auth/v1/logout')
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    return json(route, { message: `e2e: 흉내 내지 않은 요청 ${url.pathname}` }, 404);
  });
}

/** 소셜 로그인에서 막 돌아온 상태: 누른 제공자와 PKCE verifier를 탭 저장소에 둔다. */
export async function asReturningFromProvider(page: Page, provider: 'kakao' | 'google' | 'apple') {
  await page.addInitScript((p) => {
    sessionStorage.setItem('sweetwo.pending-provider', p);
    localStorage.setItem('sb-session-code-verifier', JSON.stringify('e2e-verifier'));
    localStorage.setItem('sweetwo.started', '1');
  }, provider);
}
