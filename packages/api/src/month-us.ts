import { MonthUsCardSchema, type MonthUsCard } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 이번 달 우리 둘 카드(19 H-14, 서버 month_us_card·dismiss_month_us, 20261216090000 계약 4)
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 내 가장 최근 카드(보낸 지 14일 안, 닫지 않음) 또는 null. 했어요만 공개면 금액 null */
export async function fetchMonthUsCard(): Promise<MonthUsCard> {
  const { data, error } = await supabase().rpc('month_us_card', {});
  fail(error);
  return MonthUsCardSchema.parse(data ?? null);
}

/** 카드 닫기(내 것만) */
export async function dismissMonthUs(id: string): Promise<void> {
  const { error } = await supabase().rpc('dismiss_month_us', { p_id: id });
  fail(error);
}
