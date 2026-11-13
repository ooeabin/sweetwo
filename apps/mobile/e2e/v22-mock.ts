import type { Route } from '@playwright/test';

// v2.2(ADR 0009) 가짜 Supabase 응답: 홈 v2.2(H-10·H-11·H-06)와 월급날 확인(W-02·W-05·W-01·W-01d)이 부르는 새 표·RPC.
// onboarding-mock의 route가 맨 먼저 handleV22를 부르고, 여기서 처리하지 않으면(false) 예전 흉내로 넘어간다.
// 서버 계약은 supabase/migrations/20261201090000_v22_check_loop.sql ~ 20261203090000_v22_saving_together.sql.

export interface V22Db {
  /** 닫거나 끝낸 띠 키(home_task_state) */
  tasks: string[];
  bundles: Record<string, unknown>[];
  /** money_in_period 응답(날짜 없는 사람). 없으면 none */
  period: Record<string, unknown> | null;
  moneyIns: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  modeRequests: Record<string, unknown>[];
  rankRequests: Record<string, unknown>[];
  salaryChanges: Record<string, unknown>[];
  moves: Record<string, unknown>[];
  /** confirm_payday·split_lines_configure·dismiss_home_task 호출 기록 */
  calls: { fn: string; body: Record<string, unknown> }[];
  /** v2.2 서버처럼 확인 목록을 소급해 만들지 않음(start_checklist가 지금 목록만 돌려줌) */
  noRetro?: boolean;
}

export const emptyV22 = (): V22Db => ({
  tasks: [],
  bundles: [],
  period: null,
  moneyIns: [],
  notes: [],
  accounts: [],
  modeRequests: [],
  rankRequests: [],
  salaryChanges: [],
  moves: [],
  calls: [],
});

type Db = {
  me: Record<string, unknown>;
  space: Record<string, unknown> | null;
  splits: { id: string; owner_user_id: string | null; split_line: Record<string, unknown>[] }[];
  checklists: Record<string, unknown>[];
  v22?: V22Db;
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
const ok = (route: Route) =>
  route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });

/** 예전 시드에 v2.2 열 채우기(줄 설정 기본: 체크리스트에 넣기 켬, 자동 끔) */
function normalize(db: Db) {
  for (const s of db.splits)
    for (const l of s.split_line) {
      l.in_checklist ??= true;
      l.auto_pay ??= false;
      l.auto_day ??= null;
      l.shared_account_id ??= null;
    }
  for (const c of db.checklists) {
    c.confirmed_at ??= null;
    c.confirmed_by ??= null;
    for (const l of c.pay_check_line as Record<string, unknown>[]) {
      l.auto ??= false;
      l.auto_due ??= null;
      l.late ??= false;
      l.split_line_id ??= String(l.id).replace(/-c$/, '');
    }
  }
}

const kstToday = (now: Date) => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
/** 늦은 확인 마지막 날(서버 late_check_until 흉내): 끝 + 한 달 */
const lateUntil = (end: string) => {
  const d = new Date(`${end}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

/** v2.2 요청이면 응답하고 true */
export async function handleV22(
  route: Route,
  db: Db,
  path: string,
  method: string,
  url: URL,
  now: Date,
): Promise<boolean> {
  normalize(db);
  const v = (db.v22 ??= emptyV22());
  const req = route.request();
  const body = () => (req.postData() ? (req.postDataJSON() as Record<string, unknown>) : {});
  const today = kstToday(now);
  const meId = String(db.me.id);

  if (path === '/rest/v1/home_task_state' && method === 'GET') {
    await json(
      route,
      v.tasks.map((k) => ({
        user_id: meId,
        task_key: k,
        state: 'dismissed',
        at: now.toISOString(),
      })),
    );
    return true;
  }
  const tables: [string, Record<string, unknown>[]][] = [
    ['/rest/v1/mode_change_request', v.modeRequests],
    ['/rest/v1/shared_account', v.accounts],
    ['/rest/v1/salary_change', v.salaryChanges],
    ['/rest/v1/money_in', v.moneyIns],
  ];
  for (const [p, rows] of tables)
    if (path === p && method === 'GET') {
      const st = url.searchParams.get('status')?.replace(/^eq\./, '');
      await json(route, st ? rows.filter((r) => r.status === st) : rows);
      return true;
    }
  if (path === '/rest/v1/saving_note' && method === 'GET') {
    const gte = url.searchParams.get('due_on')?.replace(/^gte\./, '');
    const goal = url.searchParams.get('goal_id')?.replace(/^eq\./, '');
    const bundle = url.searchParams.get('bundle_id')?.replace(/^eq\./, '');
    await json(
      route,
      v.notes.filter(
        (n) =>
          (!goal || n.goal_id === goal) &&
          (!bundle || n.bundle_id === bundle) &&
          (!gte || (n.due_on && String(n.due_on) >= gte && !n.paid)),
      ),
    );
    return true;
  }
  if (path === '/rest/v1/goal_move_public' && method === 'GET') {
    const goal = url.searchParams.get('goal_id')?.replace(/^eq\./, '');
    await json(
      route,
      v.moves.filter((m) => m.goal_id === goal),
    );
    return true;
  }
  if (!path.startsWith('/rest/v1/rpc/')) return false;
  const fn = path.slice('/rest/v1/rpc/'.length);
  if (fn === 'bundle_view') {
    await json(route, v.bundles);
    return true;
  }
  if (fn === 'money_in_period') {
    await json(
      route,
      v.period ?? {
        status: 'none',
        start: null,
        end: null,
        day: null,
        received: 0,
        needed: null,
        gap_days: null,
      },
    );
    return true;
  }
  if (fn === 'dismiss_home_task') {
    const b = body();
    v.calls.push({ fn, body: b });
    if (!v.tasks.includes(String(b.p_key))) v.tasks.push(String(b.p_key));
    await ok(route);
    return true;
  }
  if (fn === 'start_checklist' && v.noRetro) {
    // 소급 없음(07 3-1): 지금 사이클 목록이 이미 있으면 그것, 없으면 null(첫 목록은 다음 월급날 예약 작업이)
    const b = body() as { p_owner?: string };
    const c = db.checklists.find(
      (x) =>
        x.owner_user_id === (b.p_owner ?? null) &&
        String(x.cycle_start) <= today &&
        String(x.cycle_end) >= today,
    );
    await json(route, c?.id ?? null);
    return true;
  }
  if (fn === 'split_lines_configure') {
    const b = body() as {
      p_items: {
        id: string;
        in_checklist?: boolean;
        auto_pay?: boolean;
        auto_day?: number | null;
      }[];
    };
    v.calls.push({ fn, body: b });
    for (const it of b.p_items)
      for (const s of db.splits) {
        const l = s.split_line.find((x) => x.id === it.id);
        if (!l) continue;
        if (it.in_checklist !== undefined) l.in_checklist = it.in_checklist;
        if (it.auto_pay !== undefined) l.auto_pay = it.auto_pay;
        if (it.auto_day !== undefined) l.auto_day = it.auto_day;
        // 이번 사이클 체크 안 한 줄도 따라 바뀜(sync_checklist)
        for (const c of db.checklists)
          for (const cl of c.pay_check_line as Record<string, unknown>[])
            if (cl.split_line_id === it.id && cl.state === 'wait') {
              cl.auto = !!l.auto_pay;
              cl.auto_due = l.auto_pay ? c.cycle_start : null;
            }
      }
    await ok(route);
    return true;
  }
  const findLine = (id: string) => {
    for (const c of db.checklists) {
      const l = (c.pay_check_line as Record<string, unknown>[]).find((x) => x.id === id);
      if (l) return { c, l };
    }
    return null;
  };
  if (fn === 'check_pay_line') {
    const b = body() as { p_line: string; p_state: string; p_actual?: number };
    const f = findLine(b.p_line);
    // 예전 흉내가 맡는 것: 지금 사이클의 손 줄
    if (!f || (!f.l.auto && String(f.c.cycle_end) >= today)) return false;
    const late = String(f.c.cycle_end) < today;
    if (late && today > lateUntil(String(f.c.cycle_end))) {
      await json(route, { message: 'closed', code: '22023' }, 400);
      return true;
    }
    const to =
      b.p_state === 'checked' && b.p_actual === 0
        ? 'skipped'
        : b.p_state === 'wait' && late
          ? 'skipped'
          : b.p_state;
    f.l.state = to;
    f.l.actual = b.p_state === 'checked' && b.p_actual ? b.p_actual : null;
    f.l.checked_by = to === 'wait' || (b.p_state === 'wait' && late) ? null : meId;
    f.l.checked_at = f.l.checked_by ? now.toISOString() : null;
    f.l.late = late && b.p_state !== 'wait';
    await ok(route);
    return true;
  }
  if (fn === 'confirm_payday') {
    const b = body() as { p_checklist: string };
    v.calls.push({ fn, body: b });
    const c = db.checklists.find((x) => x.id === b.p_checklist);
    if (!c) {
      await json(route, { message: 'no_checklist', code: '42501' }, 403);
      return true;
    }
    if (c.owner_user_id && c.owner_user_id !== meId) {
      await json(route, { message: 'not_owner', code: '42501' }, 403);
      return true;
    }
    const late = String(c.cycle_end) < today;
    let n = 0;
    for (const l of c.pay_check_line as Record<string, unknown>[]) {
      if (l.auto) continue;
      if (!(l.state === 'wait' || (late && l.state === 'skipped' && !l.checked_by))) continue;
      if (c.owner_user_id === null && l.kind === 'allowance' && l.user_id && l.user_id !== meId)
        continue;
      Object.assign(l, {
        state: 'checked',
        actual: null,
        checked_by: meId,
        checked_at: now.toISOString(),
        late,
      });
      n += 1;
    }
    c.confirmed_at = now.toISOString();
    c.confirmed_by = meId;
    await json(route, n);
    return true;
  }
  if (fn === 'late_check_until') {
    const b = body() as { p_checklist: string };
    const c = db.checklists.find((x) => x.id === b.p_checklist);
    await json(route, c ? lateUntil(String(c.cycle_end)) : null);
    return true;
  }
  return false;
}
