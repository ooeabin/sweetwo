import { AuthCallError } from './auth';
import { supabase } from './client';

// 휴지통(25 S-21): 지운 지 30일 안의 내 명의·공동 항목. 되살리기·영구 삭제는 함수로만
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type TrashKind = 'asset' | 'goal' | 'family' | 'care_day';
export type TrashRow = {
  kind: TrashKind;
  id: string;
  name: string;
  /** 자산이면 'asset' | 'debt' */
  sub: string | null;
  deletedAt: string;
  deletedBy: string | null;
};

export async function fetchTrash(): Promise<TrashRow[]> {
  const { data, error } = await supabase().rpc('trash_rows');
  fail(error);
  return (data ?? []).map((r) => ({
    kind: r.kind as TrashKind,
    id: r.id,
    name: r.name,
    sub: r.sub,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
  }));
}

/** 되살리기. 연결된 부부의 목표면 'needs_proposal'(제안으로 보냄) */
export async function restoreTrash(
  kind: TrashKind,
  id: string,
): Promise<'restored' | 'needs_proposal'> {
  const { error } = await supabase().rpc('restore_trash', { p_kind: kind, p_id: id });
  if (error?.message?.includes('needs_proposal')) return 'needs_proposal';
  fail(error);
  return 'restored';
}

/** 영구 삭제(kind, id) 또는 비우기(인자 없음). 지운 개수 */
export async function purgeTrash(kind?: TrashKind, id?: string): Promise<number> {
  const { data, error } = await supabase().rpc(
    'purge_trash',
    kind && id ? { p_kind: kind, p_id: id } : {},
  );
  fail(error);
  return typeof data === 'number' ? data : 0;
}
