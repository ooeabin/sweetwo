import type { Page, Route } from '@playwright/test';
import { chanwoo, fakeJwt, SB } from './supabase-mock';

// 온보딩용 가짜 Supabase: 로그인된 찬우 + 메모리 DB(app_user, couple_space, goal, fixed_expense, account, 첫 플랜). 테스트가 db를 들여다본다.
export interface MemDb {
  me: Record<string, unknown>;
  space: Record<string, unknown> | null;
  goals: Record<string, unknown>[];
  fixed: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  plans: { args: Record<string, unknown> }[];
  rpc: string[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });

const eqId = (url: URL) => url.searchParams.get('id')?.replace(/^eq\./, '');
const inIds = (url: URL) =>
  (url.searchParams.get('id') ?? '')
    .replace(/^in\.\(|\)$/g, '')
    .split(',')
    .map((x) => x.replace(/"/g, ''));

export async function mockOnboarding(page: Page): Promise<MemDb> {
  const db: MemDb = {
    me: {
      id: chanwoo.id,
      provider: 'kakao',
      nickname: null,
      side: null,
      birth_year: null,
      employment: null,
      space_id: null,
      onboarding_step: null,
      onboarding_done_at: null,
      monthly_income: null,
      income_variable: false,
      payday: null,
      payday_last: false,
      allowance: null,
    },
    space: null,
    goals: [],
    fixed: [],
    accounts: [],
    plans: [],
    rpc: [],
  };
  // 로그인된 세션(웹, 로그인 유지 끔 → sessionStorage)
  await page.addInitScript(
    ({ token, user }) => {
      const now = Math.floor(Date.now() / 1000);
      sessionStorage.setItem(
        'sb-session',
        JSON.stringify({
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: 'rt',
          user,
        }),
      );
      localStorage.setItem('sweetwo.started', '1');
    },
    {
      token: fakeJwt(chanwoo.id),
      user: {
        id: chanwoo.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: chanwoo.email,
        app_metadata: { provider: 'kakao' },
        user_metadata: {},
        created_at: '2026-10-15T00:00:00Z',
      },
    },
  );

  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') {
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
    const path = url.pathname;
    const body = () => (req.postData() ? (req.postDataJSON() as Record<string, unknown>) : {});

    if (path === '/rest/v1/app_config')
      return json(route, { min_version_desktop: '0.0.0', min_version_web: '0.0.0' });
    if (path === '/rest/v1/rpc/login_state') {
      return json(route, {
        state: 'existing',
        provider: 'kakao',
        onboarding_done: !!db.me.onboarding_done_at,
        onboarding_step: db.me.onboarding_step,
      });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length);
      db.rpc.push(fn);
      if (fn === 'ensure_my_space') {
        if (!db.space) {
          db.space = {
            id: 'space-1',
            couple_state: 'not_joined',
            partner_nickname: null,
            marriage_status: null,
            wedding_date: null,
            wedding_month: null,
            wedding_date_estimated: false,
            housing: null,
            child_plan: null,
            wedding_budget: null,
            wedding_budget_estimated: false,
            family_support_answer: null,
            family_support: null,
            family_support_estimated: false,
            wedding_saved: null,
            newlywed_home: null,
            newlywed_home_month: null,
            prep_money_mode: null,
            partner_income: null,
            partner_income_estimated: false,
            partner_income_unknown: false,
            fixed_total: null,
            fixed_total_estimated: false,
            living_budget: null,
            living_budget_estimated: false,
            loan_repayment: null,
            split_mode: null,
            split_ratio: null,
            split_deferred: false,
            account_mode: null,
            base_day: null,
            base_day_last: false,
            version: 1,
          };
          db.me.space_id = 'space-1';
        }
        return json(route, 'space-1');
      }
      if (fn === 'start_first_plan') {
        if (!db.plans.length) db.plans.push({ args: body() });
        return json(route, 'plan-1');
      }
      if (fn === 'create_invite')
        return json(route, [{ code: 'K7M2QX', expires_at: '2026-10-22T00:00:00Z' }]);
      if (fn === 'delete_minor_account')
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return json(route, { message: `e2e: 모르는 함수 ${fn}` }, 404);
    }
    if (path === '/rest/v1/app_user') {
      if (method === 'GET') return json(route, db.me);
      if (method === 'PATCH') Object.assign(db.me, body());
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (path === '/rest/v1/couple_space') {
      if (method === 'GET') return json(route, db.space);
      if (method === 'PATCH' && db.space) Object.assign(db.space, body());
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (path === '/rest/v1/goal') {
      if (method === 'GET') {
        return json(
          route,
          db.goals
            .filter((g) => !g.deleted_at)
            .sort((a, b) => Number(a.priority) - Number(b.priority)),
        );
      }
      if (method === 'POST') {
        const rows = req.postDataJSON() as Record<string, unknown>[];
        for (const r of Array.isArray(rows) ? rows : [rows]) {
          db.goals.push({
            id: `goal-${db.goals.length + 1}`,
            details: {},
            other_held: 0,
            deadline: null,
            target_amount: null,
            amount_estimated: false,
            deadline_estimated: false,
            after_marriage: false,
            deleted_at: null,
            ...r,
          });
        }
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const ids = url.searchParams.get('id')?.startsWith('in.') ? inIds(url) : [eqId(url)];
        for (const g of db.goals) if (ids.includes(String(g.id))) Object.assign(g, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    if (path === '/rest/v1/fixed_expense') {
      if (method === 'GET') {
        return json(
          route,
          db.fixed.filter((r) => !r.deleted_at).sort((a, b) => Number(a.sort) - Number(b.sort)),
        );
      }
      if (method === 'POST') {
        const rows = req.postDataJSON() as Record<string, unknown>[];
        for (const r of Array.isArray(rows) ? rows : [rows]) {
          db.fixed.push({
            id: `fixed-${db.fixed.length + 1}`,
            monthly_amount: null,
            deleted_at: null,
            ...r,
          });
        }
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const ids = inIds(url);
        for (const r of db.fixed) if (ids.includes(String(r.id))) Object.assign(r, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    if (path === '/rest/v1/account') {
      if (method === 'GET')
        return json(
          route,
          db.accounts.filter((r) => !r.deleted_at),
        );
      if (method === 'POST') {
        const r = req.postDataJSON() as Record<string, unknown>;
        db.accounts.push({ id: `account-${db.accounts.length + 1}`, deleted_at: null, ...r });
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const ids = url.searchParams.get('id')?.startsWith('in.') ? inIds(url) : [eqId(url)];
        for (const r of db.accounts) if (ids.includes(String(r.id))) Object.assign(r, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    return json(route, { message: `e2e: 흉내 내지 않은 요청 ${method} ${path}` }, 404);
  });
  return db;
}
