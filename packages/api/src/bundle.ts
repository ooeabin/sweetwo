import { BundleViewListSchema, type BundleViewResponse } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 같이 모으기 묶음(20 W-15·W-15a, 06 5-6, 서버 20261203090000_v22_saving_together 계약 4).
// 읽기는 bundle_view(합계만·각자 금액·퍼센트만을 서버가 잘라 보냄), 쓰기는 RPC로만.

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 묶음을 만들거나 고칠 수 없음: 합쳐서 엔진, 연결 전, 목표 금액 없이 퍼센트만, 이미 묶은 저금, 내 저금이 아님 */
export type BundleBlockReason =
  | 'joint_engine'
  | 'not_connected'
  | 'no_target'
  | 'already_bundled'
  | 'not_owner'
  | 'not_found'
  | 'unlink_pending';
export class BundleBlocked extends Error {
  constructor(readonly reason: BundleBlockReason) {
    super(reason);
  }
}
const REASONS: BundleBlockReason[] = [
  'joint_engine',
  'not_connected',
  'no_target',
  'already_bundled',
  'not_owner',
  'not_found',
  'unlink_pending',
];
const failBundle = (e: { message?: string } | null) => {
  const r = REASONS.find((x) => e?.message?.includes(x));
  if (r) throw new BundleBlocked(r);
  fail(e);
};

/** 내 공간의 닫히지 않은 묶음(bundle_view). id를 주면 그 묶음만 */
export async function fetchBundles(id?: string): Promise<BundleViewResponse[]> {
  const { data, error } = await supabase().rpc('bundle_view', { p_bundle: id });
  fail(error);
  return BundleViewListSchema.parse(data ?? []);
}

/**
 * 묶음 만들기(W-15, 각자 엔진 + 연결만): 내 저금 하나로 시작. 이름 없으면 그 저금 이름, 목표 금액 처음 값은 서버(Q11).
 * deadline = 'YYYY-MM'(그 달 1일로). 새 묶음 id
 */
export async function createBundle(o: {
  goalId: string;
  name?: string;
  target?: number | null;
  deadline?: string | null;
}): Promise<string> {
  const { data, error } = await supabase().rpc('bundle_create', {
    p_goal: o.goalId,
    p_name: o.name,
    p_target: o.target ?? undefined,
    p_deadline: o.deadline ? `${o.deadline.slice(0, 7)}-01` : undefined,
  });
  failBundle(error);
  if (typeof data !== 'string') throw new AuthCallError('unknown');
  return data;
}

/** 상대 묶음에 내 저금 넣기(띠 13번 → W-15) */
export async function joinBundle(bundle: string, goalId: string) {
  const { error } = await supabase().rpc('bundle_join', { p_bundle: bundle, p_goal: goalId });
  failBundle(error);
}

/** 이름·목표 금액·기한 고치기(누구나 바로, 상대 알림). clearDeadline = 기한 지우기 */
export async function updateBundle(
  bundle: string,
  o: { name?: string; target?: number | null; deadline?: string | null; clearDeadline?: boolean },
) {
  const { error } = await supabase().rpc('bundle_update', {
    p_bundle: bundle,
    p_name: o.name,
    p_target: o.target ?? undefined,
    p_deadline: o.deadline ? `${o.deadline.slice(0, 7)}-01` : undefined,
    p_clear_deadline: o.clearDeadline ?? false,
  });
  failBundle(error);
}

/** 내 저금을 묶음에서 빼기(‘그만할게요’는 각자 자기 줄만) */
export async function leaveBundle(bundle: string) {
  const { error } = await supabase().rpc('bundle_leave', { p_bundle: bundle });
  failBundle(error);
}

/** 내 쪽 보이기 설정(W-15a): 각자 금액 보여 주기, 퍼센트만 보여 주기(목표 금액이 있을 때만). 생략하면 그대로 */
export async function setBundleVisibility(
  bundle: string,
  o: { showEach?: boolean; percentOnly?: boolean },
) {
  const { error } = await supabase().rpc('bundle_set_visibility', {
    p_bundle: bundle,
    p_show_each: o.showEach,
    p_percent_only: o.percentOnly,
  });
  failBundle(error);
}

/** 묶음 달성 축하를 이번에 처음 보나(achieve_bundle, 두 사람 모두 W-12 한 번) */
export async function achieveBundle(bundle: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('achieve_bundle', { p_bundle: bundle });
  fail(error);
  return data === true;
}

/** 묶음 변경 신호(Realtime saving_bundle). 받으면 bundleKeys 무효화 */
export function subscribeBundles(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`saving_bundle:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'saving_bundle', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
