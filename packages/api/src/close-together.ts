import { AuthCallError } from './auth';
import { supabase } from './client';

// 함께 모드(21 W-04a 4~8번). 같이 하기·나감·함께 정하기 확정은 서버 함수, 접속·단계 맞추기는 Realtime(접속 표시 + 알림).
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export async function joinCloseTogether(closeId: string) {
  const { error } = await supabase().rpc('join_close_together', { p_close: closeId });
  fail(error);
}

export async function leaveCloseTogether(closeId: string) {
  const { error } = await supabase().rpc('leave_close_together', { p_close: closeId });
  fail(error);
}

export async function confirmTogether(closeId: string, proposalId: string) {
  const { error } = await supabase().rpc('confirm_together', {
    p_close: closeId,
    p_id: proposalId,
  });
  fail(error);
}

export interface ClosePresence {
  user: string;
  step: string;
  /** 입력 중인 칸(“예빈님이 입력 중”) */
  field: string | null;
  mode: 'closer' | 'together' | 'view';
}

/**
 * 정리 채널: 내 접속(단계·입력 칸)을 알리고, 상대 접속 목록과 단계 이동을 받음. 돌려준 객체로 알리기·끊기.
 * Realtime에 못 붙으면(오프라인 등) 아무것도 오지 않음.
 */
export function joinCloseChannel(
  closeId: string,
  me: ClosePresence,
  on: { sync: (others: ClosePresence[]) => void; step: (step: string, from: string) => void },
) {
  let cur = me;
  const ch = supabase().channel(`close:${closeId}`, { config: { presence: { key: me.user } } });
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState<ClosePresence>();
    on.sync(
      Object.values(st)
        .flat()
        .filter((p) => p.user !== me.user),
    );
  })
    .on('broadcast', { event: 'step' }, ({ payload }) => {
      const p = payload as { step?: string; from?: string };
      if (p.step && p.from && p.from !== me.user) on.step(p.step, p.from);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void ch.track(cur);
    });
  return {
    update: (p: Partial<ClosePresence>) => {
      cur = { ...cur, ...p };
      void ch.track(cur);
    },
    move: (step: string) => {
      cur = { ...cur, step };
      void ch.track(cur);
      void ch.send({ type: 'broadcast', event: 'step', payload: { step, from: me.user } });
    },
    close: () => {
      void supabase().removeChannel(ch);
    },
  };
}
