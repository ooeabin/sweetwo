import {
  CareDaySchema,
  CareRecordSchema,
  RecordCareResultSchema,
  type CareDayRow,
  type CareRecordRow,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace } from './onboarding';

// 캘린더 가족·경조사(24 Y-01~Y-05). 같은 공간이면 같이 보고 고침, 지우기는 휴지통
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

// 응답은 Zod로 검사(2026-11-12 QA 9구간 S9-15, core schemas/care)
export type CareDay = CareDayRow;
export type CareRecord = CareRecordRow;

export async function fetchCareDays(): Promise<CareDay[]> {
  const { data, error } = await supabase().from('care_day').select('*').is('deleted_at', null);
  fail(error);
  return CareDaySchema.array().parse(data ?? []);
}

/** 경조사 여러 개 추가, 만든 id를 넣은 순서대로 */
export async function insertCareDays(
  rows: Omit<TablesInsert<'care_day'>, 'space_id'>[],
): Promise<string[]> {
  if (!rows.length) return [];
  const space_id = await ensureSpace();
  const { data, error } = await supabase()
    .from('care_day')
    .insert(rows.map((r) => ({ ...r, space_id })))
    .select('id');
  fail(error);
  return (data ?? []).map((r) => r.id);
}
export async function updateCareDay(id: string, patch: TablesUpdate<'care_day'>) {
  const { error } = await supabase().from('care_day').update(patch).eq('id', id);
  fail(error);
}
/** 경조사 지우기(휴지통, Y-05 8번). 되살리기는 restoreTrash('care_day', id) */
export async function trashCareDay(id: string) {
  const { error } = await supabase()
    .from('care_day')
    .update({ deleted_at: new Date().toISOString() }) // 지운 사람은 DB 트리거가 기록
    .eq('id', id);
  fail(error);
}

export async function fetchCareRecords(): Promise<CareRecord[]> {
  const { data, error } = await supabase()
    .from('care_record')
    .select('*')
    .is('deleted_at', null)
    .order('occurs_on', { ascending: false });
  fail(error);
  return CareRecordSchema.array().parse(data ?? []);
}

/**
 * Y-08 저장(기록만). 돌려줌: 기록 id(사진 붙일 때).
 * 서버 record_care는 아직 옛 인자(p_paid_from, p_move, 기본값 없음)를 받아 고정값만 보냄(서버는 낸 곳 personal, 줄 0으로 무시)
 */
export async function recordCare(a: {
  careId: string;
  on: string;
  amount: number;
  gifts: string[];
  giftName: string | null;
  memo: string | null;
}): Promise<{ record: string }> {
  const { data, error } = await supabase().rpc('record_care', {
    p_care: a.careId,
    p_on: a.on,
    p_amount: a.amount,
    p_paid_from: 'personal',
    p_gifts: a.gifts,
    p_gift_name: a.giftName ?? '',
    p_memo: a.memo ?? '',
    p_move: 0,
  });
  fail(error);
  return { record: RecordCareResultSchema.parse(data).record };
}

/**
 * 경조사·기록 변경 신호(Realtime care_day, care_record, 2026-11-12 QA 9구간 S9-03, 20261125090000 발행).
 * 읽기 권한은 select 정책 그대로라 볼 수 있는 행만 신호가 옴. 돌려준 함수로 끊음
 */
export function subscribeCares(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`care:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'care_day', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'care_record', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}

export type Holiday = Tables<'holiday'>;
/** 공휴일(앱은 읽기만) */
export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase().from('holiday').select('*').order('date');
  fail(error);
  return data ?? [];
}
