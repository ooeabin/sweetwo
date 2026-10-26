import {
  fetchAssets,
  fetchCareDays,
  fetchGoals,
  fetchHasUnread,
  fetchMe,
  fetchNotification,
  fetchNotifications,
  fetchPartner,
  fetchSpace,
  fetchTrash,
  markNotificationsRead,
  qk,
  subscribeNotifications,
  type Me,
  type Notification,
} from '@sweetwo/api';
import { coupleOf, inQuiet, notiPrefs, pushAllowed } from '@sweetwo/core';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../shared/toast';
import { copy } from './copy';

// 알림 센터 데이터: 목록(30개씩), 읽지 않음 점, Realtime(새 알림 → 목록·점, 데스크톱이면 OS 알림), 누르면 읽음 + 그 화면.

/** 넓은 창 패널(N-01) 열림 */
export const useNotiPanel = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));

export function useNotiList(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === 30 ? last[last.length - 1]?.created_at : undefined,
    enabled,
  });
}
export const useHasUnread = () => useQuery({ queryKey: qk.hasUnread, queryFn: fetchHasUnread });

/** 사람 Avatar(시작한 사람 1, 합류한 사람 2)와 이름 */
export function useNotiPeople() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  const starterId = c ? (c.starter ? me.data?.id : partner.data?.id) : undefined;
  return (actor: string | null) => {
    if (!actor || !c) return undefined;
    const name = actor === me.data?.id ? c.myName : c.partnerName;
    return { name, no: actor === starterId ? (1 as const) : (2 as const) };
  };
}

/** 지금 한국 시간 시(0~23) */
export const kstHour = (now = new Date()) => (now.getUTCHours() + 9) % 24;

/** 알림 대상(목표·자산·챙길 날)이 지금 없는지: 휴지통에 있으면 deleted, 아예 안 보이면 hidden */
async function targetGone(
  target: string,
  qc: ReturnType<typeof useQueryClient>,
): Promise<'deleted' | 'hidden' | null> {
  const m = /^\/(goals|assets|calendar\/day)\/([0-9a-f-]{36})(?:[/?]|$)/.exec(target);
  if (!m) return null;
  const [, kind, id] = m;
  const rows: { id: string }[] =
    kind === 'goals'
      ? await qc.fetchQuery({ queryKey: qk.goals, queryFn: fetchGoals })
      : kind === 'assets'
        ? await qc.fetchQuery({ queryKey: qk.assets, queryFn: fetchAssets })
        : await qc.fetchQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  if (rows.some((r) => r.id === id && !(r as { deleted_at?: string | null }).deleted_at))
    return null;
  const trash = await qc.fetchQuery({ queryKey: qk.trash, queryFn: fetchTrash });
  return trash.some((t) => t.id === id) ? 'deleted' : 'hidden';
}

/** 누르면: 읽음 + 그 화면 */
export function useOpenNotification() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const close = useNotiPanel((s) => s.set);
  return async (n: Pick<Notification, 'id' | 'target' | 'read_at'>) => {
    close(false);
    // 대상 항목이 지워졌거나 볼 수 없으면 이동 없이 Toast(14 N-01 예외)
    const gone = await targetGone(n.target, qc).catch(() => null);
    if (gone) toast(gone === 'deleted' ? copy.targetDeleted : copy.targetHidden);
    else nav(n.target);
    if (!n.read_at) {
      await markNotificationsRead([n.id]).catch(() => undefined);
      await qc.invalidateQueries({ queryKey: qk.notifications });
    }
  };
}

/** 앱 틀에 한 번: Realtime 구독, 데스크톱 OS 알림과 그 클릭 */
export function useNotiRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  const open = useOpenNotification();
  useEffect(() => {
    if (!userId) return;
    const bridge = typeof window !== 'undefined' ? window.sweetwo : undefined;
    const off = subscribeNotifications(userId, (ev) => {
      void qc.invalidateQueries({ queryKey: qk.notifications });
      // 연결 해제 요청·취소: 부부 상태가 바뀜. 확정이면 공간이 바뀌어 전부 다시 읽음
      if (
        ev.type === 'insert' &&
        (ev.row.kind === 'unlink_confirmed' || ev.row.kind === 'reconnected')
      )
        void qc.invalidateQueries();
      else if (ev.type === 'insert' && /^(access|inquiry)_/.test(ev.row.kind))
        void qc.invalidateQueries({ queryKey: qk.inquiries });
      else if (ev.type === 'insert' && ev.row.kind === 'reconnect_requested')
        void qc.invalidateQueries({ queryKey: qk.myUnlink });
      else if (ev.type === 'insert' && ev.row.kind.startsWith('unlink_')) {
        void qc.invalidateQueries({ queryKey: qk.space });
        void qc.invalidateQueries({ queryKey: qk.unlink });
      }
      if (ev.type !== 'insert' || !bridge?.notify) return;
      const n = ev.row;
      // S-14 설정: 받는 방법·묶음 토글·방해 금지(그때는 센터에만)
      const me = qc.getQueryData<Me | null>(qk.me);
      const prefs = notiPrefs(me?.noti_prefs);
      // 방해 금지만 아니면 띄울 알림은 끝나는 시각에(14 규칙): 미뤄 두고 1분마다 확인
      if (!pushAllowed(prefs, n.topic, { hour: 0, start: 0, end: 0 })) return;
      const quiet = { hour: kstHour(), start: me?.quiet_start ?? 22, end: me?.quiet_end ?? 8 };
      if (!pushAllowed(prefs, n.topic, quiet)) {
        deferred.push(n);
        return;
      }
      show(n);
    });
    const show = (n: Notification) =>
      void bridge?.notify?.show({
        id: n.id,
        title: n.push_title ?? n.title,
        ...(n.push_hidden || !n.body ? {} : { body: n.body }),
      });
    const deferred: Notification[] = [];
    const tick = setInterval(() => {
      if (!deferred.length) return;
      const me = qc.getQueryData<Me | null>(qk.me);
      if (inQuiet(kstHour(), me?.quiet_start ?? 22, me?.quiet_end ?? 8)) return;
      deferred.splice(0).forEach(show);
    }, 60_000);
    const offOpen = bridge?.notify?.onOpen((id) => {
      void fetchNotification(id).then((n) => n && open(n));
    });
    return () => {
      off();
      offOpen?.();
      clearInterval(tick);
    };
    // open은 매 렌더 새로 만들어지지만 구독은 사람마다 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, qc]);
}
