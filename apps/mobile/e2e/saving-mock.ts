import type { Page, Route } from '@playwright/test';
import type { MemDb } from './onboarding-mock';
import { SB } from './supabase-mock';

// v2.2 같이 모으기와 돈 기록 가짜 서버(20261203090000_v22_saving_together, 20261207090000_v22_saving_undo 흉내).
// mockOnboarding 뒤에 붙여 그 메모리 DB(goals, checklists)를 같이 쓰고, 이 파일이 맡지 않은 요청은 그대로 넘김(route.fallback).
// 두 계정(찬우·예빈)은 같은 SavingDb를 나눠 쓰고, 페이지마다 보는 사람(viewer)만 다름.

type Row = Record<string, unknown>;
export interface SavingDb {
  bundles: Row[];
  moves: Row[];
  notes: Row[];
  moneyIns: Row[];
  /** 사람마다 받은 인앱 알림(kind, title, actor) */
  noti: { to: string; kind: string; title: string; actor: string | null }[];
  /** split_lines_configure로 받은 줄 설정 */
  lineSettings: Row[];
  reconciledAt: Record<string, string>;
}
export const newSavingDb = (): SavingDb => ({
  bundles: [],
  moves: [],
  notes: [],
  moneyIns: [],
  noti: [],
  lineSettings: [],
  reconciledAt: {},
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
const fail = (route: Route, message: string) =>
  json(route, { message, code: message === 'not_owner' ? '42501' : '22023' }, 400);

export async function mockSaving(page: Page, db: MemDb, s: SavingDb, viewer: string) {
  const lineSaved = (id: string) => {
    let v = Number(db.goals.find((g) => g.id === id)?.start_saved ?? 0);
    for (const c of db.checklists)
      for (const l of c.pay_check_line as Row[])
        if (l.goal_id === id && l.kind === 'saving' && l.state === 'checked')
          v += Number(l.actual ?? l.planned);
    return v;
  };
  // 모은 금액(계약 1): 이미 모은 금액 + 체크한 줄 + reason_code가 있는 움직임
  const saved = (id: string) =>
    lineSaved(id) +
    s.moves
      .filter((m) => m.goal_id === id && !m.deleted_at)
      .reduce((t, m) => t + (m.kind === 'in' ? Number(m.amount) : -Number(m.amount)), 0);
  const goalOf = (id: unknown) => db.goals.find((g) => g.id === id && !g.deleted_at);
  const editable = (g: Row | undefined) =>
    !!g &&
    (g.owner_user_id === viewer ||
      (!g.bundle_id &&
        (g.owner_user_id == null ||
          (g.visibility === 'all' && db.space?.salary_mode === 'joint'))));
  const together = (g: Row) =>
    g.owner_user_id == null || !!g.bundle_id || db.space?.salary_mode === 'joint';
  const other = () => (viewer === db.me.id ? String(db.partner?.id ?? '') : String(db.me.id));
  const bundleGoals = (b: Row) => db.goals.filter((g) => g.bundle_id === b.id && !g.deleted_at);
  const total = (b: Row) => bundleGoals(b).reduce((t, g) => t + saved(String(g.id)), 0);
  const refresh = (b: Row) => {
    if (!b.target_amount || b.status === 'closed') return;
    const t = total(b);
    if (b.status === 'active' && t >= Number(b.target_amount)) {
      Object.assign(b, { status: 'achieved', achieved_seen: [] });
      for (const u of [b.member_a, b.member_b].filter(Boolean))
        s.noti.push({
          to: String(u),
          kind: 'bundle_achieved',
          title: `${String(b.name)} 다 모았어요!`,
          actor: null,
        });
    } else if (b.status === 'achieved' && t < Number(b.target_amount)) b.status = 'active';
  };
  const afterChange = (gid: unknown) => {
    const g = goalOf(gid);
    const b = s.bundles.find((x) => x.id === g?.bundle_id);
    if (b) refresh(b);
  };
  const view = (b: Row) => {
    const isA = viewer === b.member_a;
    const pctOnly = !!(b.percent_only_a || b.percent_only_b);
    const each = !!(b.show_each_a && b.show_each_b);
    const gs = bundleGoals(b);
    const mine = gs
      .filter((g) => g.owner_user_id === viewer)
      .reduce((t, g) => t + saved(String(g.id)), 0);
    const theirs = gs
      .filter((g) => g.owner_user_id !== viewer)
      .reduce((t, g) => t + saved(String(g.id)), 0);
    const t = mine + theirs;
    const target = b.target_amount == null ? null : Number(b.target_amount);
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      deadline: b.deadline ?? null,
      paused: false,
      percent_only: pctOnly,
      show_each: each,
      my_show_each: !!(isA ? b.show_each_a : b.show_each_b),
      my_percent_only: !!(isA ? b.percent_only_a : b.percent_only_b),
      pct: target ? Math.min(100, Math.floor((t * 100) / target)) : null,
      total: pctOnly ? null : t,
      target: pctOnly ? null : target,
      mine: pctOnly ? null : mine,
      partner: pctOnly || !each ? null : theirs,
      goals: gs.map((g) => ({ id: g.id, mine: g.owner_user_id === viewer, name: g.name })),
    };
  };
  const adjust = (o: {
    goal: string;
    delta: number;
    code: string;
    reason?: string | null;
    hide?: boolean;
    note?: string | null;
    moneyIn?: string | null;
  }): string | { err: string } => {
    const g = goalOf(o.goal);
    if (!editable(g) || !g) return { err: 'not_owner' };
    if (saved(o.goal) + o.delta < 0) return { err: 'below_zero' };
    const id = `mv-${s.moves.length + 1}`;
    s.moves.push({
      id,
      space_id: 'space-1',
      goal_id: o.goal,
      kind: o.delta > 0 ? 'in' : 'out',
      amount: Math.abs(o.delta),
      created_by: viewer,
      created_at: new Date().toISOString(),
      reason_code: o.code,
      reason: o.reason ?? null,
      hide_from_summary: !!o.hide,
      money_in_id: o.moneyIn ?? null,
      note_id: o.note ?? null,
      deleted_at: null,
    });
    // 같이 모으는 저금이면 상대에게 사람·금액·사유 없는 한 줄(계약 3)
    if (together(g))
      s.noti.push({
        to: other(),
        kind: `saving_adjusted:${id}`,
        title: o.delta < 0 ? '같이 모으기에서 꺼내 썼어요' : '같이 모으기에 더했어요',
        actor: null,
      });
    afterChange(o.goal);
    return id;
  };

  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const body = () => (req.postDataJSON() ?? {}) as Row;
    const fn = path.startsWith('/rest/v1/rpc/') ? path.slice('/rest/v1/rpc/'.length) : null;

    if (fn === 'goal_saved_sums')
      return json(
        route,
        db.goals
          .filter((g) => !g.deleted_at)
          .filter((g) => {
            const b = s.bundles.find((x) => x.id === g.bundle_id);
            return (
              !b ||
              g.owner_user_id === viewer ||
              (b.show_each_a && b.show_each_b && !(b.percent_only_a || b.percent_only_b))
            );
          })
          .map((g) => ({ goal_id: g.id, saved: saved(String(g.id)) })),
      );
    if (fn === 'bundle_view') {
      const p = body().p_bundle;
      return json(
        route,
        s.bundles.filter((b) => b.status !== 'closed' && (!p || b.id === p)).map(view),
      );
    }
    if (fn === 'bundle_create') {
      const b0 = body();
      const g = goalOf(b0.p_goal);
      if (!g || g.owner_user_id !== viewer) return fail(route, 'not_owner');
      if (db.space?.salary_mode !== 'separate') return fail(route, 'joint_engine');
      if (g.bundle_id) return fail(route, 'already_bundled');
      const id = `bundle-${s.bundles.length + 1}`;
      s.bundles.push({
        id,
        name: b0.p_name ?? g.name,
        target_amount: b0.p_target ?? g.target_amount ?? null,
        deadline: b0.p_deadline ?? null,
        status: 'active',
        member_a: viewer,
        member_b: other(),
        show_each_a: false,
        show_each_b: false,
        percent_only_a: false,
        percent_only_b: false,
        achieved_seen: [],
      });
      g.bundle_id = id;
      s.noti.push({
        to: other(),
        kind: 'bundle_created',
        title: `${String(g.name)}에 같이 모을까요?`,
        actor: viewer,
      });
      return json(route, id);
    }
    if (fn === 'bundle_join') {
      const b0 = body();
      const b = s.bundles.find((x) => x.id === b0.p_bundle);
      const g = goalOf(b0.p_goal);
      if (!b) return fail(route, 'not_found');
      if (!g || g.owner_user_id !== viewer) return fail(route, 'not_owner');
      g.bundle_id = b.id;
      refresh(b);
      return json(route, null);
    }
    if (fn === 'bundle_set_visibility') {
      const b0 = body();
      const b = s.bundles.find((x) => x.id === b0.p_bundle);
      if (!b) return fail(route, 'not_found');
      if (b0.p_percent_only && !b.target_amount) return fail(route, 'no_target');
      const sfx = viewer === b.member_a ? 'a' : 'b';
      if (b0.p_show_each != null) b[`show_each_${sfx}`] = b0.p_show_each;
      if (b0.p_percent_only != null) b[`percent_only_${sfx}`] = b0.p_percent_only;
      return json(route, null);
    }
    if (fn === 'bundle_update') {
      const b0 = body();
      const b = s.bundles.find((x) => x.id === b0.p_bundle);
      if (!b) return fail(route, 'not_found');
      if (b0.p_name) b.name = b0.p_name;
      if (b0.p_target != null) b.target_amount = b0.p_target;
      if (b0.p_clear_deadline) b.deadline = null;
      else if (b0.p_deadline) b.deadline = b0.p_deadline;
      refresh(b);
      return json(route, null);
    }
    if (fn === 'bundle_leave') {
      const b = s.bundles.find((x) => x.id === body().p_bundle);
      if (!b) return fail(route, 'not_found');
      for (const g of db.goals) if (g.bundle_id === b.id) g.bundle_id = null;
      b.status = 'closed';
      return json(route, null);
    }
    if (fn === 'achieve_bundle') {
      const b = s.bundles.find((x) => x.id === body().p_bundle);
      const seen = (b?.achieved_seen as string[] | undefined) ?? [];
      if (b?.status === 'achieved' && !seen.includes(viewer)) {
        b.achieved_seen = [...seen, viewer];
        return json(route, true);
      }
      return json(route, false);
    }
    if (fn === 'adjust_saving') {
      const b0 = body();
      const r = adjust({
        goal: String(b0.p_goal),
        delta: Number(b0.p_delta),
        code: String(b0.p_reason_code ?? 'fix'),
        reason: (b0.p_reason as string) ?? null,
        hide: !!b0.p_hide_from_summary,
      });
      return typeof r === 'string' ? json(route, r) : fail(route, r.err);
    }
    if (fn === 'undo_saving_adjust') {
      const m = s.moves.find(
        (x) => x.id === body().p_move && x.created_by === viewer && !x.deleted_at,
      );
      if (!m) return fail(route, 'not_found');
      m.deleted_at = new Date().toISOString();
      s.noti = s.noti.filter((n) => n.kind !== `saving_adjusted:${String(m.id)}`);
      const n = s.notes.find((x) => x.id === m.note_id);
      if (n) Object.assign(n, { paid: false, paid_move_id: null, paid_at: null });
      afterChange(m.goal_id);
      return json(route, null);
    }
    if (fn === 'goal_move_reasons') {
      const gid = body().p_goal;
      return json(
        route,
        s.moves
          .filter((m) => m.goal_id === gid && m.created_by === viewer && m.reason && !m.deleted_at)
          .map((m) => ({ id: m.id, reason: m.reason })),
      );
    }
    if (fn === 'reconcile_savings') {
      let n = 0;
      for (const it of body().p_items as Row[]) {
        const d = Number(it.actual) - saved(String(it.goal_id));
        if (d !== 0) {
          const r = adjust({ goal: String(it.goal_id), delta: d, code: 'reconcile' });
          if (typeof r !== 'string') return fail(route, r.err);
          n += 1;
        }
      }
      s.reconciledAt[viewer] = new Date().toISOString();
      return json(route, n);
    }
    if (fn === 'mark_note_paid') {
      const b0 = body();
      const n = s.notes.find((x) => x.id === b0.p_note && !x.deleted_at);
      if (!n) return fail(route, 'not_found');
      if (n.paid) return fail(route, 'already_paid');
      let mid: string | null = null;
      if (b0.p_subtract && Number(n.amount ?? 0) > 0) {
        const gid =
          (n.goal_id as string | null) ??
          String(
            db.goals.find((g) => g.bundle_id === n.bundle_id && g.owner_user_id === viewer)?.id ??
              '',
          );
        const r = adjust({
          goal: gid,
          delta: -Number(n.amount),
          code: 'note_paid',
          reason: String(n.name),
          note: String(n.id),
        });
        if (typeof r !== 'string') return fail(route, r.err);
        mid = r;
      }
      Object.assign(n, { paid: true, paid_at: new Date().toISOString(), paid_move_id: mid });
      return json(route, mid);
    }
    if (fn === 'unpay_saving_note') {
      const n = s.notes.find((x) => x.id === body().p_note);
      if (!n) return fail(route, 'not_found');
      const m = s.moves.find((x) => x.id === n.paid_move_id);
      if (m) {
        m.deleted_at = new Date().toISOString();
        afterChange(m.goal_id);
      }
      Object.assign(n, { paid: false, paid_at: null, paid_move_id: null });
      return json(route, null);
    }
    if (fn === 'log_money_in') {
      const b0 = body();
      const id = `in-${s.moneyIns.length + 1}`;
      s.moneyIns.push({
        id,
        space_id: 'space-1',
        owner_user_id: viewer,
        amount: b0.p_amount,
        received_on: b0.p_received_on ?? new Date().toISOString().slice(0, 10),
        kind: b0.p_kind ?? 'etc',
        created_at: new Date().toISOString(),
        deleted_at: null,
      });
      return json(route, id);
    }
    if (fn === 'distribute_money_in') {
      const b0 = body();
      const mi = s.moneyIns.find((x) => x.id === b0.p_money_in);
      if (!mi) return fail(route, 'not_found');
      const items = (b0.p_items as Row[]).filter((i) => Number(i.amount) > 0);
      const used = s.moves
        .filter((m) => m.money_in_id === mi.id && !m.deleted_at)
        .reduce((t, m) => t + Number(m.amount), 0);
      if (used + items.reduce((t, i) => t + Number(i.amount), 0) > Number(mi.amount))
        return fail(route, 'over');
      for (const i of items) {
        const r = adjust({
          goal: String(i.goal_id),
          delta: Number(i.amount),
          code: 'custom',
          moneyIn: String(mi.id),
        });
        if (typeof r !== 'string') return fail(route, r.err);
      }
      return json(route, items.length);
    }
    if (fn === 'split_lines_configure') {
      s.lineSettings.push(...(body().p_items as Row[]));
      return json(route, null);
    }
    if (path === '/rest/v1/goal_move_public' && method === 'GET') {
      const gid = url.searchParams.get('goal_id')?.replace(/^eq\./, '');
      return json(
        route,
        s.moves
          .filter((m) => m.goal_id === gid && !m.deleted_at)
          .map((m) => {
            const out = { ...m };
            delete out.reason;
            delete out.deleted_at;
            return out;
          })
          .reverse(),
      );
    }
    if (path === '/rest/v1/money_in' && method === 'GET')
      return json(
        route,
        s.moneyIns.filter((m) => m.owner_user_id === viewer && !m.deleted_at).reverse(),
      );
    if (path === '/rest/v1/saving_note') {
      if (method === 'GET') {
        const gid = url.searchParams.get('goal_id')?.replace(/^eq\./, '');
        const bid = url.searchParams.get('bundle_id')?.replace(/^eq\./, '');
        return json(
          route,
          s.notes.filter(
            (n) =>
              !n.deleted_at &&
              (!gid || n.goal_id === gid) &&
              (!bid || n.bundle_id === bid) &&
              (url.searchParams.get('paid') !== 'eq.false' || !n.paid),
          ),
        );
      }
      if (method === 'POST') {
        const r = body();
        const id = `note-${s.notes.length + 1}`;
        s.notes.push({
          id,
          paid: false,
          paid_at: null,
          paid_move_id: null,
          created_by: viewer,
          created_at: new Date().toISOString(),
          deleted_at: null,
          goal_id: null,
          bundle_id: null,
          ...r,
        });
        return json(route, { id }, 201);
      }
      if (method === 'PATCH') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const n = s.notes.find((x) => x.id === id);
        if (n) Object.assign(n, body());
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }
    return route.fallback();
  });
}

/** 사람(to)에게 간 알림 제목들 */
export const notiTitles = (s: SavingDb, to: string) =>
  s.noti.filter((n) => n.to === to).map((n) => n.title);
