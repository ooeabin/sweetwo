import { AuthCallError } from './auth';
import { supabase } from './client';

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

// 비상금 넣기, 꺼내기(23 F-09, 06 8장). 바로 반영(제안 아님). 기록은 RPC로만
export type EmergencyReason = 'hospital' | 'repair' | 'family_event' | 'living_short' | 'etc';
export interface EmergencyMove {
  id: string;
  kind: 'in' | 'out';
  amount: number;
  reason: EmergencyReason | null;
  moved_on: string;
  created_by: string | null;
}

export async function fetchEmergencyMoves(): Promise<EmergencyMove[]> {
  const { data, error } = await supabase()
    .from('emergency_move')
    .select('id, kind, amount, reason, moved_on, created_by')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as EmergencyMove[];
}

export async function moveEmergency(
  kind: 'in' | 'out',
  amount: number,
  reason?: EmergencyReason | null,
): Promise<string> {
  const { data, error } = await supabase().rpc('move_emergency', {
    p_kind: kind,
    p_amount: amount,
    ...(reason ? { p_reason: reason } : {}),
  });
  fail(error);
  return data as string;
}

export async function undoEmergencyMove(id: string) {
  const { error } = await supabase().rpc('undo_emergency_move', { p_id: id });
  fail(error);
}
