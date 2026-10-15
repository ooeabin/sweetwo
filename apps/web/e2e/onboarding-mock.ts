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
  todos: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  closes: Record<string, unknown>[];
  spends: Record<string, unknown>[];
  bigs: Record<string, unknown>[];
  deposits: Record<string, unknown>[];
  /** 합류 흐름: 배우자 프로필, 동의 기록, 다시 나눈 분담 */
  partner: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  shares: Record<string, unknown> | null;
  /** 제안(08 6장) */
  proposals: Record<string, unknown>[];
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

/** now: 화면 시계를 고정한 시각(첫 플랜을 만든 시각으로 씀) */
export async function mockOnboarding(page: Page, opts: { now?: Date } = {}): Promise<MemDb> {
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
    todos: [],
    categories: [],
    closes: [],
    spends: [],
    bigs: [],
    deposits: [],
    partner: null,
    consents: [],
    shares: null,
    proposals: [],
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
      if (fn === 'invite_preview') return json(route, [{ inviter_nickname: '찬우', status: 'ok' }]);
      if (fn === 'join_space') {
        const sp = db.space ?? {};
        Object.assign(db.me, {
          space_id: 'space-1',
          side: 'bride',
          nickname: db.me.nickname ?? sp.partner_nickname,
          monthly_income: db.me.monthly_income ?? sp.partner_income,
          onboarding_step: sp.partner_income ? 'P-02B' : 'P-03',
          onboarding_done_at: null,
        });
        return json(route, 'joined');
      }
      if (fn === 'partner_profile') return json(route, db.partner ? [db.partner] : []);
      if (fn === 'finish_join') {
        if (db.space) db.space.couple_state = 'connected';
        Object.assign(db.me, {
          onboarding_step: 'P-11',
          onboarding_done_at: new Date().toISOString(),
        });
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'update_pending_shares') {
        db.shares = body();
        const a = db.plans[0]?.args;
        const shares = (db.shares.p_shares ?? []) as Record<string, unknown>[];
        if (a)
          a.p_lines = ((a.p_lines as Record<string, unknown>[]) ?? []).map((l) => ({
            ...l,
            ...(shares.find((x) => x.account_role === l.account_role) ?? {}),
          }));
        return json(route, shares.length);
      }
      // 제안: 서버 함수와 같은 규칙만 간단히(항목당 열린 제안 하나, 용돈은 사람마다)
      if (fn === 'propose') {
        const b = body();
        const me = String(db.me.id);
        const item = String(b.p_item);
        const cur = db.proposals.find(
          (p) =>
            p.status === 'open' && p.item === item && (item !== 'allowance' || p.proposer === me),
        );
        if (cur) cur.status = 'superseded';
        const trips = cur ? Number(cur.round_trips) + (cur.proposer !== me ? 1 : 0) : 0;
        const at = new Date(Date.now() + db.proposals.length * 1000).toISOString();
        const row = {
          id: `prop-${db.proposals.length + 1}`,
          space_id: 'space-1',
          item,
          proposer: me,
          before:
            item === 'allowance'
              ? { allowance: db.me.allowance ?? null }
              : {
                  mode: db.space?.split_mode ?? null,
                  starter_ratio: db.space?.split_ratio ?? null,
                },
          after: b.p_after,
          status: 'open',
          apply_on: b.p_apply_on,
          seen_at: null,
          response: null,
          responded_at: null,
          oppose_count: cur?.oppose_count ?? 0,
          round_trips: trips,
          together: trips >= 2,
          replaces: cur?.id ?? null,
          applied_at: null,
          created_at: at,
          updated_at: at,
          version: 1,
        };
        db.proposals.push(row);
        return json(route, row.id);
      }
      if (fn === 'respond_proposal' || fn === 'withdraw_proposal') {
        const b = body();
        const p = db.proposals.find((x) => x.id === b.p_id);
        if (!p) return json(route, { code: '42501', message: 'not_allowed' }, 403);
        if (p.status !== 'open') return json(route, p.status);
        if (fn === 'withdraw_proposal') p.status = 'withdrawn';
        else if (b.p_response === 'oppose') {
          Object.assign(p, {
            status: 'held',
            response: 'oppose',
            oppose_count: Number(p.oppose_count) + 1,
          });
        } else {
          const after = p.after as Record<string, unknown>;
          if (p.item === 'allowance') {
            const who = p.proposer === db.me.id ? db.me : db.partner;
            if (who) who.allowance = after.allowance;
          } else if (db.space) {
            Object.assign(db.space, {
              split_mode: after.mode,
              split_ratio: after.starter_ratio ?? null,
              split_deferred: false,
            });
          }
          Object.assign(p, { status: 'applied', response: 'like', together: false });
        }
        return json(route, p.status);
      }
      if (fn === 'mark_proposal_seen') {
        const p = db.proposals.find((x) => x.id === body().p_id);
        if (p && !p.seen_at) p.seen_at = new Date().toISOString();
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'apply_due_proposals') return json(route, 0);
      if (fn === 'create_invite')
        return json(route, [{ code: 'K7M2QX', expires_at: '2026-10-22T00:00:00Z' }]);
      if (fn === 'delete_minor_account')
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return json(route, { message: `e2e: 모르는 함수 ${fn}` }, 404);
    }
    if (path === '/rest/v1/proposal') {
      return json(
        route,
        [...db.proposals].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      );
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
    if (path === '/rest/v1/monthly_plan' && method === 'GET') {
      const a = db.plans[0]?.args;
      if (!a) return json(route, null);
      const lines = ((a.p_lines as Record<string, unknown>[]) ?? []).map((l, i) => ({
        id: `line-${i + 1}`,
        account_role: null,
        goal_id: null,
        amount_groom: null,
        amount_bride: null,
        state: 'pending',
        deleted_at: null,
        ...l,
      }));
      return json(route, {
        id: 'plan-1',
        label_month: a.p_label_month,
        cycle_start: a.p_cycle_start,
        cycle_end: a.p_cycle_end,
        is_partial: true,
        first_adjust: a.p_first_adjust,
        merged_close: a.p_merged_close,
        is_temp: a.p_is_temp,
        snapshot: a.p_snapshot,
        status: 'created',
        created_at: (opts.now ?? new Date()).toISOString(),
        deleted_at: null,
        lines,
      });
    }
    const ok204 = () =>
      route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    const rowsOf = () => {
      const b = req.postDataJSON() as Record<string, unknown> | Record<string, unknown>[];
      return Array.isArray(b) ? b : [b];
    };
    if (path === '/rest/v1/consent' && method === 'POST') {
      db.consents.push(...rowsOf());
      return ok204();
    }
    if (path === '/rest/v1/todo') {
      if (method === 'GET') return json(route, db.todos);
      if (method === 'POST') {
        for (const r of rowsOf())
          if (!db.todos.some((t) => t.kind === r.kind))
            db.todos.push({
              id: `todo-${db.todos.length + 1}`,
              status: 'pending',
              snoozed_until: null,
              deleted_at: null,
              ...r,
            });
        return ok204();
      }
      if (method === 'PATCH') {
        for (const t of db.todos) if (t.id === eqId(url)) Object.assign(t, body());
        return ok204();
      }
    }
    if (path === '/rest/v1/spend_category') {
      if (method === 'GET')
        return json(
          route,
          [...db.categories].sort((a, b) => Number(a.sort) - Number(b.sort)),
        );
      if (method === 'POST') {
        for (const r of rowsOf())
          db.categories.push({
            id: `cat-${db.categories.length + 1}`,
            enabled: true,
            deleted_at: null,
            ...r,
          });
        return ok204();
      }
    }
    if (path === '/rest/v1/month_close') {
      if (method === 'GET') {
        const c = db.closes[0];
        return json(
          route,
          c ? { ...c, spends: db.spends, bigs: db.bigs, deposits: db.deposits } : null,
        );
      }
      if (method === 'POST') {
        const c = {
          id: 'close-1',
          status: 'draft',
          deleted_at: null,
          ...(req.postDataJSON() as object),
        };
        db.closes.push(c);
        return json(route, { id: c.id }, 201);
      }
      if (method === 'PATCH') {
        for (const c of db.closes) if (c.id === eqId(url)) Object.assign(c, body());
        return ok204();
      }
    }
    if (path === '/rest/v1/big_expense') {
      if (method === 'POST') {
        for (const r of rowsOf()) {
          const cur = db.bigs.find((x) => x.kind === r.kind);
          if (cur) Object.assign(cur, r);
          else db.bigs.push({ id: `big-${db.bigs.length + 1}`, ...r });
        }
        return ok204();
      }
      if (method === 'PATCH') {
        const kinds = (url.searchParams.get('kind') ?? '').replace(/^in\.\(|\)$/g, '').split(',');
        for (const b of db.bigs) if (kinds.includes(String(b.kind))) Object.assign(b, body());
        db.bigs = db.bigs.filter((b) => !b.deleted_at);
        return ok204();
      }
    }
    // 목표 달별 기록(G-02): 플랜 목표 줄, 정리한 달 납입
    if (path === '/rest/v1/plan_line' && method === 'GET') {
      const a = db.plans[0]?.args;
      const lines = ((a?.p_lines as Record<string, unknown>[]) ?? []).filter(
        (l) => l.target === 'goal' && l.goal_id,
      );
      return json(
        route,
        lines.map((l) => ({
          goal_id: l.goal_id,
          amount: l.amount,
          monthly_plan: { label_month: a?.p_label_month },
        })),
      );
    }
    if (path === '/rest/v1/saving_deposit' && method === 'GET') {
      const label = db.plans[0]?.args.p_label_month;
      return json(
        route,
        db.deposits
          .filter((d) => d.goal_id && !d.deleted_at)
          .map((d) => ({
            goal_id: d.goal_id,
            amount: d.amount,
            month_close: {
              status: db.closes.find((c) => c.id === d.month_close_id)?.status ?? 'done',
              monthly_plan: { label_month: d.label_month ?? label },
            },
          })),
      );
    }
    if (path === '/rest/v1/saving_deposit' && method === 'POST') {
      for (const r of rowsOf()) {
        const cur = db.deposits.find((x) => x.name === r.name);
        if (cur) Object.assign(cur, r);
        else db.deposits.push({ id: `dep-${db.deposits.length + 1}`, deleted_at: null, ...r });
      }
      return ok204();
    }
    if (path === '/rest/v1/month_spend' && method === 'POST') {
      for (const r of rowsOf()) {
        const cur = db.spends.find((x) => x.category_id === r.category_id);
        if (cur) Object.assign(cur, r);
        else db.spends.push({ id: `spend-${db.spends.length + 1}`, deleted_at: null, ...r });
      }
      return ok204();
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
