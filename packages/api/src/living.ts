import { AuthCallError } from './auth';
import { supabase } from './client';

// 생활비 체크(20 W-03). 켜기는 부부 단위, 답은 플랜마다 하나(한 명이 답하면 둘 다 끝). 쓰기는 함수로만
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type LivingAnswer = 'enough' | 'just' | 'over';
export type LivingCover = 'goal' | 'allowance' | 'next_month';
export type LivingCheck = {
  id: string;
  answer: LivingAnswer;
  overAmount: number | null;
  coverFrom: LivingCover | null;
  allowanceSide: 'groom' | 'bride' | null;
  allowanceCut: number | null;
  answeredBy: string | null;
};

/** 이 플랜의 답(없으면 null) */
export async function fetchLivingCheck(planId: string): Promise<LivingCheck | null> {
  const { data, error } = await supabase()
    .from('living_check')
    .select('*')
    .eq('plan_id', planId)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    id: data.id,
    answer: data.answer as LivingAnswer,
    overAmount: data.over_amount,
    coverFrom: data.cover_from as LivingCover | null,
    allowanceSide: data.allowance_side,
    allowanceCut: data.allowance_cut,
    answeredBy: data.answered_by,
  };
}

/** S-14 켜기·끄기(부부 둘 다) */
export async function setLivingCheck(on: boolean) {
  const { error } = await supabase().rpc('set_living_check', { p_on: on });
  fail(error);
}

/** W-03 답하기. 돌려주는 값 = 답 id(되돌리기용) */
export async function answerLivingCheck(
  planId: string,
  answer: LivingAnswer,
  over?: number,
  cover?: LivingCover,
): Promise<string> {
  const { data, error } = await supabase().rpc('answer_living_check', {
    p_plan: planId,
    p_answer: answer,
    ...(over !== undefined ? { p_over: over } : {}),
    ...(cover ? { p_cover: cover } : {}),
  });
  fail(error);
  return data as string;
}

/** 토스트 ‘되돌리기’(답한 사람, 10분 안) */
export async function undoLivingCheck(id: string) {
  const { error } = await supabase().rpc('undo_living_check', { p_id: id });
  fail(error);
}
