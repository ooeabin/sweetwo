import {
  JoinContextSchema,
  TERMS_VERSION,
  type JoinContext,
  type Json,
  type SplitLineDraft,
} from '@sweetwo/core';
export type { JoinContext } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 파트너 합류 서버 호출(docs/spec/18-partner-join.md, 15 A-07)
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type InviteStatus = 'ok' | 'invalid' | 'expired' | 'used' | 'unavailable' | 'locked';

// 이 기기를 가리키는 임의 값(로그인과 상관없음). 서버가 sha256으로 바꿔 미리보기 시도 수를 셈(31 보안 3장, D2)
const DEVICE_KEY = 'sweetwo.inviteDevice';
function inviteDevice(): string | null {
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) {
      v =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(DEVICE_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

/** 로그인 전에도: 초대한 사람 호칭과 상태. 같은 기기·접속 주소에서 10분에 너무 많이 물으면 'locked' */
export async function invitePreview(
  code: string,
): Promise<{ inviter: string | null; status: InviteStatus }> {
  const { data, error } = await supabase().rpc('invite_preview', {
    p_code: code,
    p_device: inviteDevice() ?? '',
  });
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  return {
    inviter: (row?.inviter_nickname as string | null) ?? null,
    status: (row?.status as InviteStatus | undefined) ?? 'invalid',
  };
}

export type JoinResult =
  | 'joined'
  | 'resume'
  | 'invalid'
  | 'locked'
  | 'expired'
  | 'used'
  | 'unavailable'
  | 'own_code'
  | 'already_connected'
  | 'has_records';
/** ‘합류하기’: 코드를 내 몫으로 24시간 잡아 둠(공간에는 합류를 마칠 때 들어감, D1) */
export async function joinSpace(code: string): Promise<JoinResult> {
  const { data, error } = await supabase().rpc('join_space', { p_code: code });
  fail(error);
  return data as JoinResult;
}

/** P-02a ‘안 옮겨요’ 개수: 저금 항목, 월급 계획, 체크리스트 */
export async function fetchRecordCounts(): Promise<{
  goals: number;
  splits: number;
  lists: number;
}> {
  const db = supabase();
  const [g, sp, l] = await Promise.all([
    db.from('goal').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('salary_split').select('id', { count: 'exact', head: true }),
    db.from('pay_checklist').select('id', { count: 'exact', head: true }),
  ]);
  fail(g.error ?? sp.error ?? l.error);
  return { goals: g.count ?? 0, splits: sp.count ?? 0, lists: l.count ?? 0 };
}

/** P-02a 혼자 쓰던 기록 옮기기 + 합류. vis = 내 명의 자산 id → 공개 범위(기본 금액만) */
export async function joinMovingRecords(
  code: string,
  vis: Record<string, 'all' | 'sum' | 'private'>,
): Promise<JoinResult> {
  const { data, error } = await supabase().rpc('join_moving_records', {
    p_code: code,
    p_vis: vis,
  });
  fail(error);
  return data as JoinResult;
}

/**
 * 합류 완료(18): P-06 월급 계획 저장 + 첫 체크리스트 + 연결 + 코드 사용됨. lines 없으면 대기(시작한 사람이 아직 온보딩 중, P-05).
 * version = P-06을 열 때 공동 월급 계획 버전(합쳐서). 그 사이 바뀌었으면 'split_changed'
 */
export async function completeJoin(
  lines?: SplitLineDraft[],
  version?: number,
): Promise<'ok' | 'split_changed'> {
  const p_lines = lines
    ? (lines.map((l) => ({
        kind: l.kind,
        amount: l.amount,
        goal_id: l.goalId ?? null,
        user_id: l.userId ?? null,
        name: l.name ?? null,
      })) as unknown as Json)
    : undefined;
  const { error } = await supabase().rpc('complete_join', { p_lines, p_version: version });
  if (error?.message?.includes('split_changed')) return 'split_changed';
  fail(error);
  return 'ok';
}

/** P-04: 합류 중 관리 방식 바꾸기(바로 적용, 시작한 사람 알림) */
export async function setJoinSalaryMode(mode: 'separate' | 'joint') {
  const { error } = await supabase().rpc('set_join_salary_mode', { p_mode: mode });
  fail(error);
}

/** 사전 입력 확인(P-02b) 동의 기록 */
export async function recordPrefillConsent(userId: string) {
  const { error } = await supabase().from('consent').insert({
    user_id: userId,
    kind: 'space_sharing',
    terms_version: TERMS_VERSION,
    agreed: true,
    source: 'prefill_review',
  });
  fail(error);
}

/** P-02b ‘지우고 새로 입력할게요’: 시작한 사람이 대신 입력한 내 명의 항목을 휴지통으로 */
export async function discardPrefill() {
  const { error } = await supabase().rpc('discard_prefill');
  fail(error);
}

/**
 * 합류 흐름에 필요한 것만(18, D1): 합류를 마치기 전에는 공간 구성원이 아니라 공간 데이터를 직접 못 읽음.
 * 시작한 사람 호칭, 관리 방식, 시작한 사람 월급 계획이 있는지, 대신 입력한 내 명의 항목, 합쳐서면 다시 채울 공동 월급 계획.
 * 합류 중이 아니면(취소, 기한 지남) null
 */
export async function fetchJoinContext(): Promise<JoinContext | null> {
  const { data, error } = await supabase().rpc('join_context');
  fail(error);
  return JoinContextSchema.parse(data ?? null);
}
