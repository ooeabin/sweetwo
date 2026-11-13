import type { Page, Route } from '@playwright/test';
import { json, rpcError } from './http';
import type { MemDb } from './app-db';
import { SB, YEBIN } from './supabase';

// v2.2 PR 11(공개·관계·설정) 서버 흉내: mockOnboarding 위에 얹음(나중에 건 route가 먼저 받음, 모르면 fallback).
// 관리 형태 요청(request/answer/cancel_mode_change, mode_change_request), 공개 단계 필터(partner_plan_view),
// 분담(propose/answer_split, shared_account), 날짜를 정한 월급 변경(schedule/cancel_salary_change, salary_change),
// 다시 연결(request/answer_reconnect, reconnect_request), 묶음(bundle_view), 자산 공개·순위 동의.
// 계약은 supabase/migrations/20261202090000~20261204090000 머리 주석.

export interface V22SettingsDb {
  modeRequests: Record<string, unknown>[];
  shared: Record<string, unknown>[];
  salaryChanges: Record<string, unknown>[];
  reconnects: Record<string, unknown>[];
  bundles: Record<string, unknown>[];
  rankRequests: Record<string, unknown>[];
  /** 상대(예빈)의 공개 단계·월급(서버만 앎) */
  partnerShare: 'all' | 'saving_only' | 'done_only';
  partnerIncome: number;
  /** 다시 연결 ‘다시 받지 않기’를 고른 상대 */
  blocked: boolean;
  calls: { fn: string; body: Record<string, unknown> }[];
}

const err = rpcError;
const r10k = (v: number) => Math.round(v / 10_000) * 10_000;

export async function mockV22Settings(page: Page, db: MemDb, now: Date): Promise<V22SettingsDb> {
  const v: V22SettingsDb = {
    modeRequests: [],
    shared: [],
    salaryChanges: [],
    reconnects: [],
    bundles: [],
    rankRequests: [],
    partnerShare: 'saving_only',
    partnerIncome: 2_500_000,
    blocked: false,
    calls: [],
  };
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const meRow = db.me as Record<string, unknown>;
  if (meRow.plan_share === undefined) meRow.plan_share = 'saving_only';
  if (meRow.push_kinds === undefined) meRow.push_kinds = {};
  if (meRow.rank_consent === undefined) meRow.rank_consent = false;
  if (meRow.asset_share_default === undefined) meRow.asset_share_default = null;

  /** 2-5 표(resolve_manage_style) */
  const resolve = (living: boolean, saving: boolean | null, manager: string) => {
    if (!living) return { mode: 'separate', manager: null as string | null };
    if (manager === 'me' || manager === 'partner') return { mode: 'joint', manager };
    if (manager === 'together') return { mode: 'joint', manager: null };
    return { mode: 'separate', manager: null };
  };
  const apply = (
    living: boolean,
    saving: boolean | null,
    mode: string,
    managerId: string | null,
  ) => {
    Object.assign(db.space ?? {}, {
      shared_living: living,
      shared_saving: saving,
      salary_mode: mode,
      manager_user_id: managerId,
    });
  };

  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') return route.fallback();
    const url = new URL(req.url());
    const path = url.pathname;
    const body = () => (req.postData() ? (req.postDataJSON() as Record<string, unknown>) : {});
    const eq = (k: string) => url.searchParams.get(k)?.replace(/^eq\./, '');

    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length);
      const b = body();
      // ── 관리 형태 ──
      if (fn === 'request_mode_change') {
        v.calls.push({ fn, body: b });
        if (db.space?.couple_state === 'unlink_pending')
          return err(route, 'unlink_pending', '42501');
        const living = b.p_shared_living === true;
        const saving = (b.p_shared_saving as boolean | null) ?? null;
        const r = resolve(living, saving, String(b.p_manager ?? ''));
        const managerId: string | null =
          r.manager === 'me' ? String(db.me.id) : r.manager === 'partner' ? YEBIN : null;
        const connected = db.space?.couple_state === 'connected';
        const needs =
          connected &&
          ((db.space?.salary_mode === 'separate' && r.mode === 'joint') ||
            (r.mode === 'joint' && managerId === YEBIN && db.space?.manager_user_id !== YEBIN));
        if (!needs) {
          apply(living, saving, r.mode, managerId);
          return json(route, 'applied');
        }
        for (const x of v.modeRequests) if (x.status === 'open') x.status = 'cancelled';
        v.modeRequests.push({
          id: `mr-${v.modeRequests.length + 1}`,
          space_id: db.space?.id,
          from_user: db.me.id,
          to_mode: r.mode,
          to_manager: managerId,
          to_shared_living: living,
          to_shared_saving: saving,
          phrase: b.p_phrase ?? 's11f_combine',
          status: 'open',
          created_at: now.toISOString(),
          expires_at: new Date(now.getTime() + 7 * 86400_000).toISOString(),
          answered_at: null,
        });
        return json(route, 'requested');
      }
      if (fn === 'answer_mode_change') {
        v.calls.push({ fn, body: b });
        const q = v.modeRequests.find((x) => x.id === b.p_request);
        if (!q || q.status !== 'open') return err(route, 'not_open');
        if (Date.parse(String(q.expires_at)) < now.getTime()) {
          q.status = 'expired';
          return json(route, 'expired');
        }
        q.status = b.p_accept ? 'accepted' : 'declined';
        if (b.p_accept)
          apply(
            q.to_shared_living as boolean,
            q.to_shared_saving as boolean | null,
            String(q.to_mode),
            (q.to_manager as string | null) ?? null,
          );
        return json(route, q.status);
      }
      if (fn === 'cancel_mode_change') {
        v.calls.push({ fn, body: b });
        const q = v.modeRequests.find((x) => x.id === b.p_request);
        if (q) q.status = 'cancelled';
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      // ── 공개 단계 필터(같은 함수를 상대로서 부르면 S-13p) ──
      if (fn === 'partner_plan_view') {
        v.calls.push({ fn, body: b });
        if (!db.partner) return json(route, null);
        const asPartner = b.p_viewer === YEBIN; // 내 것을 상대로서
        const joint = db.space?.salary_mode === 'joint';
        const owner = asPartner ? db.me.id : YEBIN;
        const share = (asPartner ? meRow.plan_share : v.partnerShare) as string;
        const income = asPartner ? (db.me.monthly_income as number) : v.partnerIncome;
        if (db.space?.couple_state === 'unlink_pending')
          return json(route, {
            owner,
            nickname: asPartner ? db.me.nickname : '예빈',
            share,
            mode: db.space?.salary_mode,
            hidden: true,
            income: null,
            payday: null,
            lines: [],
          });
        const sp = db.splits.find((x) => x.owner_user_id === (joint ? null : owner));
        const list = db.checklists.find((x) => x.owner_user_id === (joint ? null : owner));
        const lines = (sp?.split_line ?? [])
          .filter(
            (l) =>
              joint ||
              share === 'all' ||
              (share === 'saving_only' && ['saving', 'shared_account'].includes(String(l.kind))) ||
              (share === 'done_only' && l.kind === 'saving'),
          )
          .map((l) => ({
            id: l.id,
            kind: l.kind,
            goal_id: l.goal_id ?? null,
            // 했어요만(각자)은 이름도 없이(서버 20261208090000 계약 1)
            name:
              !joint && share === 'done_only'
                ? null
                : l.kind === 'saving'
                  ? ((db.goals.find((g) => g.id === l.goal_id)?.name as string | undefined) ?? null)
                  : ((l.name as string | null) ?? null),
            user_id: l.user_id ?? null,
            amount: joint || share !== 'done_only' ? l.amount : null,
            in_checklist: l.in_checklist ?? l.kind !== 'living',
            auto_pay: l.auto_pay ?? false,
            state:
              ((list?.pay_check_line as Record<string, unknown>[] | undefined) ?? []).find(
                (x) => x.goal_id === l.goal_id && l.kind === 'saving',
              )?.state ?? null,
          }));
        return json(route, {
          owner,
          nickname: asPartner ? db.me.nickname : '예빈',
          share,
          mode: db.space?.salary_mode ?? 'separate',
          hidden: false,
          income: joint || share === 'all' ? income : null,
          payday: joint || share === 'all' ? (asPartner ? db.me.payday : 10) : null,
          lines,
        });
      }
      // ── 분담 ──
      if (fn === 'propose_split') {
        v.calls.push({ fn, body: b });
        if (db.space?.couple_state !== 'connected') return err(route, 'not_connected');
        const total = Number(b.p_monthly_total);
        if (!total || total % 10_000) return err(route, 'bad_amount');
        let a: number;
        if (b.p_rule === 'half') a = r10k(total / 2);
        else if (b.p_rule === 'income_ratio') {
          if (meRow.plan_share !== 'all' || v.partnerShare !== 'all')
            return err(route, 'not_allowed', '42501');
          const mine = Number(db.me.monthly_income);
          a = r10k((total * mine) / (mine + v.partnerIncome));
        } else a = Number(b.p_share_mine);
        for (const x of v.shared) if (x.status === 'proposed') x.status = 'cancelled';
        const id = `sa-${v.shared.length + 1}`;
        v.shared.push({
          id,
          space_id: db.space?.id,
          name: String(b.p_name).trim(),
          monthly_total: total,
          rule: b.p_rule,
          member_a: db.me.id,
          member_b: YEBIN,
          share_a: a,
          share_b: total - a,
          ratio_a: Math.round((a * 100) / total),
          status: 'proposed',
          proposed_by: db.me.id,
          expires_at: new Date(now.getTime() + 7 * 86400_000).toISOString(),
          answered_at: null,
          created_at: now.toISOString(),
        });
        return json(route, id);
      }
      if (fn === 'answer_split') {
        v.calls.push({ fn, body: b });
        const a = v.shared.find((x) => x.id === b.p_id);
        if (!a || a.status !== 'proposed') return err(route, 'not_open');
        a.status = b.p_accept ? 'accepted' : 'declined';
        if (b.p_accept) {
          const sp = db.splits.find((x) => x.owner_user_id === db.me.id);
          sp?.split_line.push({
            id: `${sp.id}-sa-${String(a.id)}`,
            split_id: sp.id,
            kind: 'shared_account',
            goal_id: null,
            user_id: null,
            name: null,
            amount: a.member_b === db.me.id ? a.share_b : a.share_a,
            sort: sp.split_line.length,
            in_checklist: true,
            auto_pay: true,
          });
        }
        return json(route, a.status);
      }
      // ── 월급 변경 ──
      if (fn === 'schedule_salary_change') {
        v.calls.push({ fn, body: b });
        const from = String(b.p_from);
        if (from.slice(0, 7) < today.slice(0, 7)) return err(route, 'bad_month');
        const id = `00000000-0000-4000-8000-${String(v.salaryChanges.length + 1).padStart(12, '0')}`;
        // 적용일 = 그 달의 사이클 시작일(월급날, 말일·짧은 달은 그 달 끝). 오늘 이전이면 바로(서버 salary_change_day)
        const y = Number(from.slice(0, 4));
        const m = Number(from.slice(5, 7));
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const pd = db.me.payday_last ? last : Math.min(Number(db.me.payday ?? 1), last);
        const applyDay = `${from.slice(0, 7)}-${String(pd).padStart(2, '0')}`;
        // ‘이번 달부터’는 월급날 전이어도 바로(서버 20261208090000 계약 2)
        const nowApply = from.slice(0, 7) === today.slice(0, 7) || applyDay <= today;
        const row: Record<string, unknown> = {
          id,
          user_id: db.me.id,
          space_id: db.space?.id,
          amount: b.p_amount,
          effective_from: from,
          until_month: b.p_until ?? null,
          revert_amount: nowApply ? db.me.monthly_income : null,
          applied_at: nowApply ? now.toISOString() : null,
          reverted_at: null,
          cancelled_at: null,
          created_at: now.toISOString(),
        };
        if (nowApply) db.me.monthly_income = Number(b.p_amount);
        v.salaryChanges.push(row);
        return json(route, id);
      }
      if (fn === 'cancel_salary_change') {
        v.calls.push({ fn, body: b });
        const c = v.salaryChanges.find((x) => x.id === b.p_id);
        if (c?.applied_at) return err(route, 'already_applied');
        if (c) c.cancelled_at = now.toISOString();
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      // ── 다시 연결(복구 없는 새 요청, 7일 1번) ──
      if (fn === 'request_reconnect') {
        v.calls.push({ fn, body: b });
        const mine = v.reconnects.filter((x) => x.from_user === db.me.id);
        if (mine.some((x) => now.getTime() - Date.parse(String(x.created_at)) < 7 * 86400_000))
          return err(route, 'too_soon', 'P0001');
        v.reconnects.push({
          id: `rc-${v.reconnects.length + 1}`,
          from_user: db.me.id,
          to_user: YEBIN,
          created_at: now.toISOString(),
          status: v.blocked ? 'silenced' : 'open',
          blocked: v.blocked,
          answered_at: null,
          invite_code: null,
        });
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'answer_reconnect') {
        v.calls.push({ fn, body: b });
        const r = v.reconnects.find((x) => x.to_user === db.me.id && x.status === 'open');
        if (!r) return err(route, 'no_request', 'P0001');
        if (!b.p_accept) {
          Object.assign(r, { status: 'declined', blocked: b.p_block === true });
          return json(route, null);
        }
        Object.assign(r, { status: 'accepted', invite_code: 'K7M2QX' });
        return json(route, 'K7M2QX');
      }
      // ── 묶음·자산 공개·순위 ──
      if (fn === 'bundle_view') return json(route, v.bundles);
      if (fn === 'bundle_set_visibility') {
        v.calls.push({ fn, body: b });
        const x = v.bundles.find((y) => y.id === b.p_bundle);
        if (x && typeof b.p_show_each === 'boolean') x.my_show_each = b.p_show_each;
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'set_asset_share_default') {
        meRow.asset_share_default = b.p_vis;
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (fn === 'request_rank_consent') {
        v.calls.push({ fn, body: b });
        meRow.rank_consent = true;
        const id = `rr-${v.rankRequests.length + 1}`;
        v.rankRequests.push({
          id,
          space_id: db.space?.id,
          from_user: db.me.id,
          status: 'open',
          created_at: now.toISOString(),
          expires_at: new Date(now.getTime() + 7 * 86400_000).toISOString(),
          answered_at: null,
        });
        return json(route, id);
      }
      if (fn === 'set_rank_consent') {
        v.calls.push({ fn, body: b });
        meRow.rank_consent = b.p_on === true;
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return route.fallback();
    }
    // ── 표 읽기 ──
    if (path === '/rest/v1/mode_change_request' && method === 'GET') {
      const id = eq('id');
      if (id) return json(route, v.modeRequests.find((x) => x.id === id) ?? null);
      return json(
        route,
        v.modeRequests.filter((x) => !eq('status') || x.status === eq('status')).reverse(),
      );
    }
    if (path === '/rest/v1/shared_account' && method === 'GET')
      return json(route, [...v.shared].reverse());
    if (path === '/rest/v1/salary_change' && method === 'GET')
      return json(route, [...v.salaryChanges].reverse());
    if (path === '/rest/v1/reconnect_request' && method === 'GET')
      return json(route, v.reconnects.filter((x) => x.status !== 'silenced').reverse());
    if (path === '/rest/v1/rank_consent_request' && method === 'GET')
      return json(route, v.rankRequests.filter((x) => x.status === 'open').reverse());
    return route.fallback();
  });
  return v;
}
