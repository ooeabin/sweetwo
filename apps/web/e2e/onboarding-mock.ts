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
  /** 우리 자산: 내가 볼 수 있는 행, 이력, 배우자 합계만, 월말 순자산 */
  assets: Record<string, unknown>[];
  assetHistory: Record<string, unknown>[];
  partnerSums: Record<string, unknown>[];
  netWorth: Record<string, unknown>[];
  /** 다른 수입(O-35b), 상여금(O-35) */
  incomeItems: Record<string, unknown>[];
  incomeEvents: Record<string, unknown>[];
  /** 캘린더 가족·챙길 날 */
  family: Record<string, unknown>[];
  cares: Record<string, unknown>[];
  /** 다녀온 뒤 기록(Y-08), 목표 사용 */
  careRecords: Record<string, unknown>[];
  goalUses: Record<string, unknown>[];
  /** 공휴일(읽기만) */
  holidays: { date: string; name: string; kind: string }[];
  /** 알림 센터(내 알림) */
  notifications: Record<string, unknown>[];
  invites: { code: string; expires_at: string; used_at: string | null }[];
  unlinks: Record<string, unknown>[];
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
      noti_prefs: {},
      quiet_start: 22,
      quiet_end: 8,
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
    assets: [],
    assetHistory: [],
    partnerSums: [],
    netWorth: [],
    incomeItems: [],
    incomeEvents: [],
    family: [],
    cares: [],
    careRecords: [],
    goalUses: [],
    holidays: [],
    notifications: [],
    invites: [],
    unlinks: [],
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
      // 양가 비용 예산 바로 저장(혼자): 같은 종류 챙길 날 쓸 돈, 양가 비용 목표 금액
      if (fn === 'save_family_budget') {
        const a = body().p_after as Record<string, number>;
        const parent = (id: unknown) =>
          db.family.some((f) => f.id === id && f.relation === 'parent');
        for (const c of db.cares) {
          if (c.category !== 'family' || c.deleted_at) continue;
          const key =
            c.kind === 'seollal' || c.kind === 'chuseok'
              ? 'holiday'
              : c.kind === 'birthday' && parent(c.member_id)
                ? 'birthday'
                : c.kind === 'parents_day'
                  ? 'parents_day'
                  : 'other';
          if (a[key] !== undefined) c.budget = a[key];
        }
        for (const g of db.goals)
          if (g.template === 'family_cost') g.target_amount = a.target_amount;
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      // 신랑·신부(S-11b): 나와 배우자 쪽, 쪽으로 저장한 값을 같이 바꿈
      if (fn === 'set_my_side') {
        const side = String(body().p_side);
        const flip = (v: unknown) => (v === 'groom' ? 'bride' : v === 'bride' ? 'groom' : v);
        const had = db.me.side;
        if (had !== side) {
          db.me.side = side;
          if (db.partner) (db.partner as Record<string, unknown>).side = flip(side);
          if (had) {
            for (const f of db.family) f.side = flip(f.side);
            for (const c of db.cares)
              Object.assign(c, { side: flip(c.side), carer: flip(c.carer) });
          }
        }
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'save_base_day') {
        const a = body().p_after as { base_day: number | null; base_day_last: boolean };
        Object.assign(db.space ?? {}, a);
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'propose') {
        const b = body();
        const me = String(db.me.id);
        const item = String(b.p_item);
        const target = (b.p_target as string | undefined) ?? null;
        const goal = db.goals.find((g) => g.id === target);
        const cur = db.proposals.find(
          (p) =>
            p.status === 'open' &&
            p.item === item &&
            (item !== 'allowance' || p.proposer === me) &&
            (p.target_id ?? null) === target,
        );
        if (cur) cur.status = 'superseded';
        const trips = cur ? Number(cur.round_trips) + (cur.proposer !== me ? 1 : 0) : 0;
        const at = new Date(Date.now() + db.proposals.length * 1000).toISOString();
        const before =
          item === 'allowance'
            ? { allowance: db.me.allowance ?? null }
            : item === 'split'
              ? { mode: db.space?.split_mode ?? null, starter_ratio: db.space?.split_ratio ?? null }
              : item === 'goal_amount'
                ? { target_amount: goal?.target_amount ?? null }
                : item === 'goal_deadline'
                  ? { deadline: goal?.deadline ?? null }
                  : item === 'goal_pause'
                    ? { paused: goal?.status === 'paused' }
                    : item === 'base_day'
                      ? {
                          base_day: db.space?.base_day ?? null,
                          base_day_last: !!db.space?.base_day_last,
                        }
                      : item === 'family_budget'
                        ? {
                            target_amount:
                              db.goals.find((g) => g.template === 'family_cost')?.target_amount ??
                              null,
                          }
                        : { deleted: false };
        const row = {
          id: `prop-${db.proposals.length + 1}`,
          space_id: 'space-1',
          item,
          target_id: target,
          proposer: me,
          before,
          after: item === 'goal_delete' ? { deleted: true } : b.p_after,
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
          const goal = db.goals.find((g) => g.id === p.target_id);
          if (p.item === 'goal_add') {
            const gid = `goal-${db.goals.length + 1}`;
            for (const a of db.assets)
              if (((after.asset_ids as string[]) ?? []).includes(String(a.id))) a.goal_id = gid;
            db.goals.push({
              id: gid,
              status: 'active',
              priority: Math.max(0, ...db.goals.map((g) => Number(g.priority))) + 1,
              created_by: p.proposer,
              created_at: new Date().toISOString(),
              after_marriage: false,
              deleted_at: null,
              ...after,
            });
          } else if (String(p.item).startsWith('goal_')) {
            if (goal && p.item === 'goal_amount') goal.target_amount = after.target_amount;
            if (goal && p.item === 'goal_deadline') goal.deadline = after.deadline;
            if (goal && p.item === 'goal_pause') goal.status = after.paused ? 'paused' : 'active';
            if (goal && p.item === 'goal_delete') goal.deleted_at = new Date().toISOString();
          } else if (p.item === 'allowance') {
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
      if (fn === 'partner_asset_sums') return json(route, db.partnerSums);
      if (fn === 'net_worth_history') return json(route, db.netWorth);
      // 이번 달만 바꾸기(W-01a): 차이는 빠지는 곳 줄이 받고 몫은 비율대로, 기준값도
      if (fn === 'adjust_plan') {
        const a = body();
        const args = db.plans[0]?.args;
        const lines = (args?.p_lines as Record<string, unknown>[]) ?? [];
        const A = lines.find((l) => l.account_role === a.p_role);
        const B = lines.find((l) => l.account_role === a.p_counter);
        if (!A || !B) return json(route, { message: 'no_line' }, 400);
        const diff = Number(a.p_amount) - Number(A.amount);
        const scale = (l: Record<string, unknown>, amt: number) => {
          const g =
            Number(l.amount) > 0
              ? Math.round((amt * Number(l.amount_groom ?? 0)) / Number(l.amount))
              : Math.round(amt / 2);
          Object.assign(l, { amount: amt, amount_groom: g, amount_bride: amt - g });
        };
        const bAfter = Number(B.amount) - diff;
        if (bAfter < 0) return json(route, { message: 'not_enough' }, 400);
        scale(A, Number(a.p_amount));
        scale(B, bAfter);
        const key = (r: unknown) => (r === 'goal_fund' ? 'goalFund' : String(r));
        const parts = (args?.p_snapshot as { parts?: Record<string, number> } | undefined)?.parts;
        if (parts) {
          parts[key(a.p_role)] = Number(a.p_amount);
          parts[key(a.p_counter)] = bAfter;
        }
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      // 월급 나누기 체크(W-02): 플랜 줄(p_lines)에 바로 기록
      if (fn === 'check_split' || fn === 'uncheck_split') {
        const a = body();
        const lines = (db.plans[0]?.args.p_lines as Record<string, unknown>[]) ?? [];
        const l = lines[Number(String(a.p_line).replace('line-', '')) - 1];
        const side = String(a.p_side);
        if (!l) return json(route, { message: 'not_member' }, 400);
        if (fn === 'uncheck_split') {
          l[`${side}_done_at`] = null;
          l[`${side}_done_by`] = null;
          l[`${side}_done_amount`] = null;
          return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (l[`${side}_done_at`] && a.p_amount === undefined) return json(route, 'already');
        l[`${side}_done_at`] ??= new Date().toISOString();
        l[`${side}_done_by`] ??= db.me.id;
        l[`${side}_done_amount`] = a.p_amount ?? l[`amount_${side}`];
        return json(route, 'ok');
      }
      // 다녀온 뒤 기록(Y-08): 기록, 다녀왔어요, 목표 사용, 생활비로 냈으면 ‘목표자금 → 공동 생활비’ 줄
      if (fn === 'record_care') {
        const a = body();
        const care = db.cares.find((c) => c.id === a.p_care);
        if (!care) return json(route, { message: 'not_member' }, 400);
        const rid = `rec-${db.careRecords.length + 1}`;
        db.careRecords.push({
          id: rid,
          care_day_id: care.id,
          member_id: care.member_id ?? null,
          occurs_on: a.p_on,
          amount: a.p_amount,
          paid_from: a.p_paid_from,
          gifts: a.p_gifts,
          gift_name: a.p_gift_name || null,
          memo: a.p_memo || null,
          deleted_at: null,
        });
        Object.assign(care, { status: 'done', status_on: a.p_on });
        const goal =
          ['goal_fund', 'living'].includes(String(a.p_paid_from)) && care.category === 'family'
            ? db.goals.find((g) => g.template === 'family_cost')
            : undefined;
        let line = 0;
        if (goal && Number(a.p_amount) > 0) {
          db.goalUses.push({
            goal_id: goal.id,
            amount: a.p_amount,
            used_on: a.p_on,
            deleted_at: null,
          });
          const lines = db.plans[0]?.args.p_lines as Record<string, unknown>[] | undefined;
          line = Math.min(Number(a.p_move ?? 0), Number(a.p_amount));
          if (a.p_paid_from === 'living' && lines && line > 0) {
            const bride = db.me.side === 'bride';
            lines.push({
              target: 'account',
              account_role: 'living',
              goal_id: goal.id,
              kind: 'goal_to_living',
              amount: line,
              amount_groom: bride ? 0 : line,
              amount_bride: bride ? line : 0,
            });
          } else line = 0;
        }
        return json(route, { record: rid, line });
      }
      if (fn === 'mark_notifications_read') {
        const ids = (body().p_ids as string[] | undefined) ?? null;
        let n = 0;
        for (const r of db.notifications)
          if (!r.read_at && (!ids || ids.includes(String(r.id)))) {
            r.read_at = new Date().toISOString();
            n++;
          }
        return json(route, n);
      }
      if (fn === 'invest_answers')
        return json(route, [
          {
            mine: db.me.invest_answer ?? null,
            partner: (db.partner as Record<string, unknown> | null)?.invest_answer ?? null,
          },
        ]);
      if (fn === 'goal_asset_sums') {
        const t: Record<string, { goal_id: string; n: number; total: number }> = {};
        for (const a of db.assets) {
          if (!a.goal_id || a.deleted_at || a.side !== 'asset' || a.visibility === 'private')
            continue;
          const k = String(a.goal_id);
          t[k] ??= { goal_id: k, n: 0, total: 0 };
          t[k].n += 1;
          t[k].total += Number(a.principal ?? a.amount);
        }
        return json(route, Object.values(t));
      }
      if (fn === 'request_unlink') {
        // 서버 request_unlink 흉내: 공동 명의 자산마다 몫(없으면 분담 비율 기본 몫), 해제 대기
        const body = JSON.parse(route.request().postData() ?? '{}') as {
          p_shares: Record<string, number>;
          p_confirm: string;
        };
        if (body.p_confirm !== '연결 해제')
          return json(route, { message: 'confirm_mismatch' }, 400);
        const mine = Number(db.me.monthly_income ?? 0);
        const theirs = Number((db.partner as Record<string, unknown> | null)?.monthly_income ?? 0);
        const pct =
          db.space?.split_mode === 'income' && mine > 0 && theirs > 0
            ? Math.round((mine * 100) / (mine + theirs))
            : 50;
        const plan = db.assets
          .filter((a) => a.owner === 'joint' && !a.deleted_at && Number(a.amount) > 0)
          .sort(
            (a, b) =>
              String(a.side).localeCompare(String(b.side)) ||
              String(a.created_at).localeCompare(String(b.created_at)),
          )
          .map((a) => {
            const amount = Number(a.amount);
            const given = body.p_shares[String(a.id)];
            const def = Math.min(
              Math.max(Math.round((amount * pct) / 1_000_000) * 10_000, 0),
              amount,
            );
            return { asset_id: a.id, name: a.name, amount, mine: given ?? def, side: a.side };
          });
        const row = {
          id: `unlink-${db.unlinks.length + 1}`,
          space_id: 'space-1',
          requested_by: db.me.id,
          requested_at: new Date().toISOString(),
          deadline: '2026-10-21',
          ratio: pct,
          plan,
          status: 'pending',
          cancelled_at: null,
          confirmed_at: null,
        };
        db.unlinks.push(row);
        if (db.space) db.space.couple_state = 'unlink_pending';
        return json(route, row.id);
      }
      if (fn === 'agree_unlink') {
        // 서버 confirm_unlink 흉내: 확정, 혼자 쓰기(새 공간 대신 같은 공간 상태만), 30일 다시 연결
        const u = db.unlinks.find((x) => x.status === 'pending');
        if (u)
          Object.assign(u, {
            status: 'confirmed',
            how: 'agreed',
            final_plan: u.plan,
            confirmed_at: '2026-10-07T01:00:00Z',
            reconnect_until: '2026-11-06T01:00:00Z',
          });
        if (db.space) Object.assign(db.space, { couple_state: 'solo', partner_nickname: null });
        db.partner = null;
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'my_unlink')
        return json(
          route,
          db.space?.couple_state === 'solo'
            ? db.unlinks.filter((x) => x.status === 'confirmed')
            : [],
        );
      if (fn === 'cancel_unlink') {
        const u = db.unlinks.find((x) => x.status === 'pending');
        if (u) u.status = 'cancelled';
        if (db.space) db.space.couple_state = 'connected';
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'create_invite' || fn === 'renew_invite') {
        // 시각을 쓰지 않는 흉내: 만료는 시험이 넣은 값(지난 날짜)으로만. 첫 코드는 늘 K7M2QX
        const past = (i: { expires_at: string }) => i.expires_at < '2026-10-07';
        const open = db.invites.find((i) => !i.used_at && !past(i));
        if (fn === 'create_invite' && open) return json(route, [open]);
        if (open) open.expires_at = '2026-10-01T00:00:00Z';
        const row = {
          code: db.invites.length ? `R${db.invites.length}NEWX`.slice(0, 6) : 'K7M2QX',
          expires_at: '2026-10-22T00:00:00Z',
          used_at: null,
        };
        db.invites.unshift(row);
        return json(route, [row]);
      }
      if (fn === 'delete_minor_account')
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return json(route, { message: `e2e: 모르는 함수 ${fn}` }, 404);
    }
    if (path === '/rest/v1/asset') {
      if (method === 'GET')
        return json(
          route,
          db.assets
            .filter((a) => !a.deleted_at && (a.status ?? 'held') === 'held')
            .sort((a, b) => Number(b.amount) - Number(a.amount)),
        );
      if (method === 'POST') {
        const now = new Date().toISOString();
        const r: Record<string, unknown> = {
          id: `asset-${db.assets.length + 1}`,
          principal: null,
          maturity_date: null,
          monthly_payment: null,
          interest_rate: null,
          rate_estimated: false,
          paid_count: null,
          pay_from: null,
          goal_id: null,
          estimated: false,
          status: 'held',
          created_by: db.me.id,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          ...(req.postDataJSON() as Record<string, unknown>),
        };
        db.assets.push(r);
        db.assetHistory.push({
          id: db.assetHistory.length + 1,
          asset_id: r.id,
          amount: r.amount,
          source: 'manual',
          recorded_at: now,
        });
        return json(route, { id: r.id }, 201);
      }
      if (method === 'PATCH' && url.searchParams.get('id')?.startsWith('in.')) {
        const ids = inIds(url);
        for (const a of db.assets) if (ids.includes(String(a.id))) Object.assign(a, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const a = db.assets.find((x) => x.id === eqId(url));
        const b = body();
        if (a) {
          const now = new Date().toISOString();
          if ('amount' in b && b.amount !== a.amount)
            db.assetHistory.push({
              id: db.assetHistory.length + 1,
              asset_id: a.id,
              amount: b.amount,
              source: 'manual',
              recorded_at: now,
            });
          Object.assign(a, b, { updated_at: now });
        }
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    if (path === '/rest/v1/asset_history') {
      const id = url.searchParams.get('asset_id')?.replace(/^eq\./, '');
      return json(
        route,
        db.assetHistory
          .filter((h) => h.asset_id === id)
          .sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at))),
      );
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
            status: 'active',
            owner: 'together',
            created_at: new Date().toISOString(),
            created_by: db.me.id,
            deleted_at: null,
            ...r,
          });
        }
        // .select('id').single() → 만든 행 하나
        if (url.searchParams.get('select'))
          return json(route, { id: db.goals[db.goals.length - 1]?.id }, 201);
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const ids = url.searchParams.get('id')?.startsWith('in.') ? inIds(url) : [eqId(url)];
        for (const g of db.goals) if (ids.includes(String(g.id))) Object.assign(g, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    // 가족·챙길 날(Y-02, Y-05)
    for (const [tbl, rows, defaults] of [
      [
        'family_member',
        db.family,
        { birth_lunar: false, birth_leap: false, korean_age: true, memo: null },
      ],
      [
        'care_day',
        db.cares,
        {
          member_id: null,
          side: null,
          month: null,
          day: null,
          leap: false,
          once_on: null,
          budget: 0,
          carer: 'together',
          alerts: [30, 7],
          status: 'todo',
          status_on: null,
          memo: null,
          secret: false,
          created_by: db.me.id,
        },
      ],
    ] as const) {
      if (path !== `/rest/v1/${tbl}`) continue;
      if (method === 'GET')
        return json(
          route,
          rows.filter((r) => !r.deleted_at),
        );
      if (method === 'POST') {
        const b = req.postDataJSON() as Record<string, unknown> | Record<string, unknown>[];
        const made = (Array.isArray(b) ? b : [b]).map((r) => {
          const at = (opts.now ?? new Date()).toISOString();
          const row = {
            id: `${tbl}-${rows.length + 1}`,
            deleted_at: null,
            created_at: at,
            updated_at: at,
            ...defaults,
            ...r,
          };
          rows.push(row);
          return row;
        });
        return json(
          route,
          made.map((r) => ({ id: r.id })),
          201,
        );
      }
      if (method === 'PATCH') {
        for (const r of rows) if (r.id === eqId(url)) Object.assign(r, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    // 다른 수입·상여금: 내 것 넣기·고치기, 다른 수입 합계는 서버 트리거처럼 app_user.other_income에
    for (const [tbl, rows] of [
      ['income_item', db.incomeItems],
      ['income_event', db.incomeEvents],
    ] as const) {
      if (path !== `/rest/v1/${tbl}`) continue;
      const resum = () => {
        db.me.other_income = db.incomeItems
          .filter((r) => !r.deleted_at && r.owner_user_id === db.me.id)
          .reduce((t, r) => t + Number(r.monthly_amount), 0);
      };
      if (method === 'GET')
        return json(
          route,
          rows.filter((r) => !r.deleted_at),
        );
      if (method === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown> | Record<string, unknown>[];
        for (const r of Array.isArray(body) ? body : [body])
          rows.push({ id: `${tbl}-${rows.length + 1}`, deleted_at: null, ...r });
        resum();
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (method === 'PATCH') {
        const ids = url.searchParams.get('id')?.startsWith('eq.') ? [eqId(url)] : inIds(url);
        for (const r of rows) if (ids.includes(String(r.id))) Object.assign(r, body());
        resum();
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
        const ids = url.searchParams.get('id')?.startsWith('eq.') ? [eqId(url)] : inIds(url);
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
        kind: 'split',
        sort: i,
        groom_done_at: null,
        groom_done_by: null,
        groom_done_amount: null,
        bride_done_at: null,
        bride_done_by: null,
        bride_done_amount: null,
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
        const kind = url.searchParams.get('kind')?.replace(/^eq\./, '');
        for (const t of db.todos)
          if (kind ? t.kind === kind && t.status !== 'done' : t.id === eqId(url))
            Object.assign(t, body());
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
      // 끝낸 정리 최근 순(F-01 월 정산 요약, F-06): 정리마다 spends/bigs/deposits를 따로 가질 수 있음
      if (method === 'GET' && url.searchParams.get('status') === 'eq.done') {
        const live = (xs: unknown) =>
          ((xs as { deleted_at?: string | null }[] | undefined) ?? []).filter((x) => !x.deleted_at);
        return json(
          route,
          db.closes
            .filter((c) => c.status === 'done' && !c.deleted_at)
            .sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))
            .map((c) => ({
              ...c,
              plan: { label_month: c.label_month ?? db.plans[0]?.args.p_label_month },
              spends: live(c.spends ?? db.spends),
              bigs: live(c.bigs ?? db.bigs),
              deposits: live(c.deposits ?? db.deposits),
            })),
        );
      }
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
    if (path === '/rest/v1/care_record' && method === 'GET')
      return json(
        route,
        [...db.careRecords].sort((a, b) => (String(a.occurs_on) < String(b.occurs_on) ? 1 : -1)),
      );
    if (path === '/rest/v1/goal_use' && method === 'GET') return json(route, db.goalUses);
    if (path === '/rest/v1/holiday' && method === 'GET') return json(route, db.holidays);
    if (path === '/rest/v1/couple_unlink' && method === 'GET')
      return json(
        route,
        db.unlinks.filter((u) => u.status === 'pending'),
      );
    if (path === '/rest/v1/invite' && method === 'GET') return json(route, db.invites.slice(0, 1));
    // 알림: 최신순, lt(더 불러오기), id 하나, 읽지 않은 것 하나(점)
    if (path === '/rest/v1/notification') {
      const rows = [...db.notifications].sort((a, b) =>
        String(a.created_at) < String(b.created_at) ? 1 : -1,
      );
      if (method === 'GET') {
        if (url.searchParams.get('read_at') === 'is.null')
          return json(route, rows.filter((r) => !r.read_at).slice(0, 1));
        if (url.searchParams.get('id')?.startsWith('eq.'))
          return json(route, rows.find((r) => r.id === eqId(url)) ?? null);
        const lt = url.searchParams.get('created_at')?.replace(/^lt\./, '');
        return json(route, rows.filter((r) => !lt || String(r.created_at) < lt).slice(0, 30));
      }
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
