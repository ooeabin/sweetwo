import {
  fetchHasUnread,
  fetchMe,
  fetchNotification,
  fetchNotifications,
  fetchPartner,
  fetchSpace,
  markNotificationsRead,
  qk,
  subscribeNotifications,
  type Me,
  type Notification,
} from '@sweetwo/api';
import { coupleOf, notiPrefs, pushAllowed } from '@sweetwo/core';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';

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

/** 누르면: 읽음 + 그 화면 */
export function useOpenNotification() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const close = useNotiPanel((s) => s.set);
  return async (n: Pick<Notification, 'id' | 'target' | 'read_at'>) => {
    close(false);
    nav(n.target);
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
      if (ev.type !== 'insert' || !bridge?.notify) return;
      const n = ev.row;
      // S-14 설정: 받는 방법·묶음 토글·방해 금지(그때는 센터에만)
      const me = qc.getQueryData<Me | null>(qk.me);
      const ok = pushAllowed(notiPrefs(me?.noti_prefs), n.topic, {
        hour: kstHour(),
        start: me?.quiet_start ?? 22,
        end: me?.quiet_end ?? 8,
      });
      if (!ok) return;
      void bridge.notify.show({
        id: n.id,
        title: n.push_title ?? n.title,
        ...(n.push_hidden || !n.body ? {} : { body: n.body }),
      });
    });
    const offOpen = bridge?.notify?.onOpen((id) => {
      void fetchNotification(id).then((n) => n && open(n));
    });
    return () => {
      off();
      offOpen?.();
    };
    // open은 매 렌더 새로 만들어지지만 구독은 사람마다 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, qc]);
}
