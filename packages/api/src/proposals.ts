import type { Json, ProposalItem, Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 제안 서버 호출(docs/spec/08-couple-proposal-permission.md 6장). 바꾸기는 모두 서버 함수로.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type Proposal = Tables<'proposal'>;
export type ProposalStatus = Proposal['status'];

/** 최근 제안(열린 것과 지난 것). 화면이 상태로 거른다 */
export async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase()
    .from('proposal')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  fail(error);
  return data ?? [];
}

/** 제안 보내기. 목표 항목은 target = 목표 id */
export async function propose(item: ProposalItem, after: Json, applyOn: string, target?: string) {
  const { data, error } = await supabase().rpc('propose', {
    p_item: item,
    p_after: after,
    p_apply_on: applyOn,
    ...(target ? { p_target: target } : {}),
  });
  fail(error);
  return data as string;
}

export async function respondProposal(id: string, response: 'like' | 'oppose') {
  const { data, error } = await supabase().rpc('respond_proposal', {
    p_id: id,
    p_response: response,
  });
  fail(error);
  return data as ProposalStatus;
}

export async function withdrawProposal(id: string) {
  const { data, error } = await supabase().rpc('withdraw_proposal', { p_id: id });
  fail(error);
  return data as ProposalStatus;
}

export async function markProposalSeen(id: string) {
  const { error } = await supabase().rpc('mark_proposal_seen', { p_id: id });
  fail(error);
}

/** 적용일이 지난 제안 적용(앱을 열 때) */
export async function applyDueProposals() {
  const { data, error } = await supabase().rpc('apply_due_proposals');
  fail(error);
  return (data as number | null) ?? 0;
}
