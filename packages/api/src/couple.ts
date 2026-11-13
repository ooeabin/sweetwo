import {
  AnswerResult,
  ModeChangeRequestRowSchema,
  ModeChangeResult,
  MyManageStyleSchema,
  PartnerPlanViewSchema,
  type ManagerAnswer,
  type ModeChangeRequestRow,
  type MyManageStyle,
  type PartnerPlanViewResponse,
  type PlanShare,
  type Tables,
} from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// S-12 우리 둘 정보: 초대 코드 보기, 새 코드 받기. 초대 코드는 우리 둘 공간 사람만 봄(RLS), 만들기는 함수로만
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type LatestInvite = {
  code: string;
  expiresAt: string;
  usedAt: string | null;
  /** 합류하는 중(누가 ‘합류하기’를 눌러 24시간 잡아 둠)이면 그 기한(D1) */
  reservedUntil: string | null;
};

/** 가장 최근 초대 코드(없으면 null). 만료됐는지는 화면이 expiresAt으로 판단 */
export async function fetchLatestInvite(): Promise<LatestInvite | null> {
  const { data, error } = await supabase()
    .from('invite')
    .select('code, expires_at, used_at, used_by, reserved_by, reserved_until')
    .order('created_at', { ascending: false })
    .limit(1);
  fail(error);
  const row = data?.[0];
  if (!row) return null;
  const now = Date.now();
  const reserved =
    !row.used_at &&
    ((row.reserved_by && row.reserved_until && Date.parse(row.reserved_until) > now) ||
      !!row.used_by);
  return {
    code: row.code,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    reservedUntil: reserved ? (row.reserved_until ?? null) : null,
  };
}

/** 초대 취소(S-12 ‘합류하는 중’): 합류하는 중인 사람을 풀고 지금 코드도 못 쓰게 */
export async function cancelInvite() {
  const { error } = await supabase().rpc('cancel_invite');
  fail(error);
}

/** 다시 연결할 수 있는지(서버 기준, S3-20) */
export async function fetchReconnectOk(): Promise<boolean> {
  const { data, error } = await supabase().rpc('my_reconnect_ok');
  fail(error);
  return data === true;
}

/** 새 코드 받기: 이전 코드는 바로 못 씀 */
export async function renewInvite(): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await supabase().rpc('renew_invite');
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new AuthCallError('unknown');
  return { code: row.code, expiresAt: row.expires_at };
}

export type Unlink = Tables<'couple_unlink'>;

/** 진행 중인 연결 해제 요청(없으면 null) */
export async function fetchUnlink(): Promise<Unlink | null> {
  const { data, error } = await supabase()
    .from('couple_unlink')
    .select('*')
    .eq('status', 'pending')
    .limit(1);
  fail(error);
  return data?.[0] ?? null;
}

/** S-12c 연결 해제 요청(같이 쓰던 데이터는 나누지 않고 확정 때 모두 지움). confirm = “연결 해제” */
export async function requestUnlink(confirm: string) {
  const { error } = await supabase().rpc('request_unlink', { p_confirm: confirm });
  fail(error);
}

/** 요청 취소(요청한 사람, 상대 응답 전) */
export async function cancelUnlink() {
  const { error } = await supabase().rpc('cancel_unlink');
  fail(error);
}

/** S-12d ‘확인했어요’(받은 사람): 바로 해제 확정 */
export async function agreeUnlink() {
  const { error } = await supabase().rpc('agree_unlink');
  fail(error);
}

/** 지금 공간이 해제로 만든 공간이면 그 해제(S-12h, 혼자 쓰기) */
export async function fetchMyUnlink(): Promise<Unlink | null> {
  const { data, error } = await supabase().rpc('my_unlink');
  fail(error);
  return (Array.isArray(data) ? data[0] : null) ?? null;
}

/** S-12h ‘시작하기’: 혼자 쓰기 온보딩 O-11부터 */
export async function startAfterUnlink() {
  const { error } = await supabase().rpc('start_after_unlink');
  fail(error);
}

/** 다시 연결 요청을 못 보냄: 7일 안에 이미 보냄, 연결할 수 없는 상태(상대 탈퇴, 누가 이미 연결됨) */
export class ReconnectBlocked extends Error {
  constructor(readonly reason: 'too_soon' | 'reconnect_closed' | 'no_request') {
    super(reason);
  }
}
const failReconnect = (e: { message?: string } | null) => {
  for (const r of ['too_soon', 'reconnect_closed', 'no_request'] as const)
    if (e?.message?.includes(r)) throw new ReconnectBlocked(r);
  fail(e);
};

/**
 * S-12 “다시 연결하기”(v2.2 D10: 복구 없는 새 연결 요청, 마지막 해제 상대에게 7일에 1번).
 * 상대가 ‘다시 받지 않기’를 골랐으면 서버가 조용히 거절(오류 없음)
 */
export async function requestReconnect() {
  const { error } = await supabase().rpc('request_reconnect');
  failReconnect(error);
}

/**
 * S-12g 답: true = 다시 연결할게요(요청한 사람 공간의 초대 코드를 돌려줌, 앱이 그 코드로 합류),
 * false = 괜찮아요, block = ‘다시 받지 않기’. 거절이면 null
 */
export async function answerReconnect(accept: boolean, block = false): Promise<string | null> {
  const { data, error } = await supabase().rpc('answer_reconnect', {
    p_accept: accept,
    p_block: block,
  });
  failReconnect(error);
  return typeof data === 'string' && data ? data : null;
}

/** 혼자 쓰기 → 새로 초대하기(미합류로) */
export async function startNewInvite() {
  const { error } = await supabase().rpc('start_new_invite');
  fail(error);
}

/** 해제 뒤 상대 호칭 */
export async function fetchUnlinkPartnerName(): Promise<string> {
  const { data, error } = await supabase().rpc('unlink_partner_name');
  fail(error);
  return typeof data === 'string' ? data : '';
}

// ─────────────────────────── v2.2 관리 형태(08 2장, 서버 20261202090000_v22_manage_share) ───────────────────────────

/** 관리 형태를 바꿀 수 없음: 해제 대기, 생활비 ‘네’인데 관리 답 없음 */
export class ModeChangeBlocked extends Error {
  constructor(readonly reason: 'unlink_pending' | 'need_manager' | 'no_space') {
    super(reason);
  }
}

/** 지금 공간의 관리 형태(my_manage_style, 이름 코드 포함). 공간이 없으면 null */
export async function fetchManageStyle(): Promise<MyManageStyle | null> {
  const { data, error } = await supabase().rpc('my_manage_style');
  fail(error);
  const row = (data ?? [])[0];
  return row ? MyManageStyleSchema.parse(row) : null;
}

/**
 * 관리 형태 저장·바꾸기(request_mode_change, O-30·30b·30c, S-11f, P-04 ‘보내요’).
 * 수락이 필요 없으면 바로 적용 'applied', 상대 ‘좋아요’가 필요하면 'requested'(7일, 공간마다 열린 요청 1개).
 * phrase: P-04 ‘월급은 대부분 …보내요’ = p04_send, S-11f 합치기 = s11f_combine, 관리 넘기기 = s11f_manager
 */
export async function requestModeChange(o: {
  sharedLiving: boolean;
  sharedSaving: boolean;
  manager: ManagerAnswer | null;
  phrase?: 'p04_send' | 's11f_combine' | 's11f_manager';
}): Promise<'applied' | 'requested'> {
  const { data, error } = await supabase().rpc('request_mode_change', {
    p_shared_living: o.sharedLiving,
    p_shared_saving: o.sharedSaving,
    // 생활비 ‘아니요’면 서버가 관리 답을 보지 않음
    p_manager: o.manager ?? '',
    p_phrase: o.phrase,
  });
  for (const r of ['unlink_pending', 'need_manager', 'no_space'] as const)
    if (error?.message?.includes(r)) throw new ModeChangeBlocked(r);
  fail(error);
  return ModeChangeResult.parse(data);
}

/** S-11j 답(answer_mode_change): ‘좋아요’ / ‘지금처럼 할게요’. 만료면 'expired'(그대로) */
export async function answerModeChange(id: string, accept: boolean): Promise<AnswerResult> {
  const { data, error } = await supabase().rpc('answer_mode_change', {
    p_request: id,
    p_accept: accept,
  });
  if (error?.message?.includes('not_open')) return 'expired';
  if (error?.message?.includes('unlink_pending')) throw new ModeChangeBlocked('unlink_pending');
  fail(error);
  return AnswerResult.parse(data);
}

/** 보낸 사람이 요청 취소(cancel_mode_change) */
export async function cancelModeChange(id: string) {
  const { error } = await supabase().rpc('cancel_mode_change', { p_request: id });
  fail(error);
}

/** 우리 공간의 열린 관리 형태 요청(없으면 null). 만료 판단은 core pickTopTask(expires_at) */
export async function fetchOpenModeRequest(): Promise<ModeChangeRequestRow | null> {
  const { data, error } = await supabase()
    .from('mode_change_request')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
  fail(error);
  const row = (data ?? [])[0];
  return row ? ModeChangeRequestRowSchema.parse(row) : null;
}

/** 요청 하나(S-11j). 없거나 못 읽으면 null */
export async function fetchModeRequest(id: string): Promise<ModeChangeRequestRow | null> {
  const { data, error } = await supabase()
    .from('mode_change_request')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  fail(error);
  return data ? ModeChangeRequestRowSchema.parse(data) : null;
}

/** 관리 형태 요청 신호(Realtime mode_change_request). 받으면 manageKeys 무효화 */
export function subscribeModeRequests(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`mode_change_request:${spaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mode_change_request',
        filter: `space_id=eq.${spaceId}`,
      },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}

// ─────────────────────────── v2.2 공개 단계(S-13 ①, S-13p) ───────────────────────────

/** 내 월급 계획 공개 단계(app_user.plan_share): 모두 / 저금만(기본) / 했어요만 */
export async function setPlanShare(userId: string, share: PlanShare) {
  const { error } = await supabase()
    .from('app_user')
    .update({ plan_share: share })
    .eq('id', userId);
  fail(error);
}

/**
 * 상대에게 보이는 월급 계획(partner_plan_view, 서버 필터 하나). viewer 생략 = 내가 상대 것을 봄,
 * viewer = 상대 id = S-13p ‘{파트너}님에게 보이는 모습’(내 것을 상대로서). 상대가 없으면 null
 */
export async function fetchPartnerPlanView(viewer?: string): Promise<PartnerPlanViewResponse> {
  const { data, error } = await supabase().rpc('partner_plan_view', { p_viewer: viewer });
  fail(error);
  return PartnerPlanViewSchema.parse(data ?? null);
}
