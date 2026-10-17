import type { Json, Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 문의(25 S-19a)와 관리자 열람 동의(S-19b). 내 문의만(RLS), 보내기·답은 함수로만
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type InquiryCategory = Tables<'inquiry'>['category'];
export type Inquiry = Tables<'inquiry'> & {
  inquiry_message: Tables<'inquiry_message'>[];
  access_request: Tables<'access_request'>[];
};

export async function fetchInquiries(): Promise<Inquiry[]> {
  const { data, error } = await supabase()
    .from('inquiry')
    .select('*, inquiry_message(*), access_request(*)')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as Inquiry[];
}

/** 보내기. 돌려주는 값 = 문의 번호(“A-10234”) */
export async function createInquiry(category: InquiryCategory, body: string, attach: Json | null) {
  const { data, error } = await supabase().rpc('create_inquiry', {
    p_category: category,
    p_body: body,
    p_attach: attach ?? undefined,
  });
  fail(error);
  return String(data);
}

export async function addInquiryMessage(id: string, body: string) {
  const { error } = await supabase().rpc('add_inquiry_message', { p_inquiry: id, p_body: body });
  fail(error);
}

export async function answerAccessRequest(id: string, accept: boolean) {
  const { error } = await supabase().rpc('answer_access_request', { p_id: id, p_accept: accept });
  fail(error);
}

export async function stopAccess(id: string) {
  const { error } = await supabase().rpc('stop_access', { p_id: id });
  fail(error);
}
