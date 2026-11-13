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
  NOTI_PAGE,
  qk,
  registerPushDevice,
  subscribeNotifications,
  type Notification,
} from '@sweetwo/api';
import { coupleOf, notiCursor, type NotiCursor } from '@sweetwo/core';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { onSessionReset } from '../../shared/session-reset';
import { notiKeys } from './noti-keys';
import { landingScreen } from './landing';
import { track } from '../../shared/analytics';

// 알림 센터 데이터: 목록(30개씩), 읽지 않음 점, Realtime(새 알림 → 목록·점), 모바일 푸시, 누르면 읽음 + 그 화면.

/** 넓은 창 패널(N-01) 열림 */
export const useNotiPanel = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));
onSessionReset(() => useNotiPanel.setState({ open: false }));

export function useNotiList(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: undefined as NotiCursor | undefined,
    // (만든 때, id) 커서: 같은 시각 알림이 30개 경계에 걸려도 빠지지 않음(S10-13)
    getNextPageParam: (last) => notiCursor(last, NOTI_PAGE),
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

/** 알림 대상(저금 항목·자산·경조사)이 지금 없는지: 휴지통에 있으면 deleted, 아예 안 보이면 hidden */
async function targetGone(
  target: string,
  qc: ReturnType<typeof useQueryClient>,
): Promise<'deleted' | 'hidden' | null> {
  // 지난 알림의 /goals/<id>도 저금 항목(2026-11-08 ADR 0007)
  const m = /^\/(goals|salary\/items|assets|calendar\/day)\/([0-9a-f-]{36})(?:[/?]|$)/.exec(target);
  if (!m) return null;
  const [, kind, id] = m;
  const rows: { id: string }[] =
    kind === 'goals' || kind === 'salary/items'
      ? await qc.fetchQuery({ queryKey: qk.goals, queryFn: fetchGoals })
      : kind === 'assets'
        ? await qc.fetchQuery({ queryKey: qk.assets, queryFn: fetchAssets })
        : await qc.fetchQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  if (rows.some((r) => r.id === id && !(r as { deleted_at?: string | null }).deleted_at))
    return null;
  const trash = await qc.fetchQuery({ queryKey: qk.trash, queryFn: fetchTrash });
  return trash.some((t) => t.id === id) ? 'deleted' : 'hidden';
}

// ── 읽음 보내기: 오프라인이거나 실패하면 모아 두었다가 연결되면 보냄(14 N-01 오프라인, 2026-11-12 S10-14) ──
const pendingRead = new Set<string>();
let pendingAll = false;
onSessionReset(() => {
  pendingRead.clear();
  pendingAll = false;
});
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** 목록 캐시에 바로 읽음 표시(오프라인에서도 줄이 읽음으로 보임) */
function markLocal(qc: ReturnType<typeof useQueryClient>, ids?: string[]) {
  const at = new Date().toISOString();
  qc.setQueryData<{ pages: Notification[][]; pageParams: unknown[] }>(qk.notifications, (d) =>
    d
      ? {
          ...d,
          pages: d.pages.map((pg) =>
            pg.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: at } : n)),
          ),
        }
      : d,
  );
  if (!ids) qc.setQueryData(qk.hasUnread, false);
}

/** 읽음(ids가 없으면 모두). 못 보내면 모아 둠 */
export async function markRead(qc: ReturnType<typeof useQueryClient>, ids?: string[]) {
  markLocal(qc, ids);
  try {
    if (isOffline()) throw new Error('offline');
    await markNotificationsRead(ids);
  } catch {
    if (ids) for (const id of ids) pendingRead.add(id);
    else pendingAll = true;
    return;
  }
  await qc.invalidateQueries({ queryKey: qk.notifications });
}

/** 모아 둔 읽음 보내기(연결되면) */
async function flushRead(qc: ReturnType<typeof useQueryClient>) {
  if (isOffline() || (!pendingAll && !pendingRead.size)) return;
  const all = pendingAll;
  const ids = [...pendingRead];
  pendingAll = false;
  pendingRead.clear();
  try {
    await markNotificationsRead(all ? undefined : ids);
  } catch {
    if (all) pendingAll = true;
    for (const id of ids) pendingRead.add(id);
    return;
  }
  await qc.invalidateQueries({ queryKey: qk.notifications });
}

type OpenArg = Pick<Notification, 'id' | 'target' | 'read_at'> &
  Partial<Pick<Notification, 'kind' | 'created_at'>>;

/** 누르면: 읽음 + 그 화면. channel = 알림 센터(inapp) / 푸시(os), 분석 notification_opened */
export function useOpenNotification() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const close = useNotiPanel((s) => s.set);
  return async (n: OpenArg, channel: 'inapp' | 'os' = 'inapp') => {
    close(false);
    // 대상 항목이 지워졌거나 볼 수 없으면 이동 없이 Toast(14 N-01 예외)
    const gone = await targetGone(n.target, qc).catch(() => null);
    if (gone) toast(gone === 'deleted' ? copy.targetDeleted : copy.targetHidden);
    // 알림에서 왔음(분석 entry, 예: W-05 month_check_viewed)
    else nav(n.target, { state: { from: 'notification' } });
    const made = n.created_at ? Date.parse(n.created_at) : NaN;
    track('notification_opened', {
      type: n.kind ?? 'unknown',
      channel,
      minutes_to_open: Number.isNaN(made)
        ? null
        : Math.max(0, Math.floor((Date.now() - made) / 60000)),
      landing_screen: gone ? 'none' : landingScreen(n.target),
    });
    // 진행 소식(14, G13): 손 줄이 없는 달 월급날 푸시(금액 없이 %), 열람률(32 0-4 progress_news_opened)
    if (n.kind === 'progress_news') track('progress_news_opened', {});
    if (!n.read_at) await markRead(qc, [n.id]);
  };
}

/** 앱 틀에 한 번: Realtime 구독, 모바일 푸시를 눌러 들어옴·앱이 떠 있을 때 온 푸시 */
export function useNotiRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  const open = useOpenNotification();
  useEffect(() => {
    if (!userId) return;
    const bridge = typeof window !== 'undefined' ? window.sweetwo : undefined;
    const off = subscribeNotifications(userId, (ev) => {
      void qc.invalidateQueries({ queryKey: qk.notifications });
      if (ev.type !== 'insert') return;
      const keys = notiKeys(ev.row.kind);
      // 확정·다시 연결이면 공간이 바뀌어 전부 다시 읽음
      if (keys === 'all') void qc.invalidateQueries();
      else for (const k of keys) void qc.invalidateQueries({ queryKey: [...k] });
    });
    // 모바일 푸시를 눌러 들어옴: 그 알림을 읽음 + 그 화면(알림이 없으면 받은 경로로)
    const offPushOpen = bridge?.push?.onOpen((p) => {
      void fetchNotification(p.id)
        .catch(() => null)
        .then((n) =>
          n ? open(n, 'os') : open({ id: p.id, target: p.target, read_at: 'x' }, 'os'),
        );
    });
    // 연결되면 모아 둔 읽음 보내기(S10-14)
    const onOnline = () => void flushRead(qc);
    window.addEventListener('online', onOnline);
    void flushRead(qc);
    // 앱이 떠 있을 때 온 푸시: OS 알림 대신 앱 안 토스트
    const offPushIn = bridge?.push?.onReceive((p) => p.title && toast(p.title));
    return () => {
      off();
      window.removeEventListener('online', onOnline);
      offPushOpen?.();
      offPushIn?.();
    };
    // open은 매 렌더 새로 만들어지지만 구독은 사람마다 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, qc]);
}

/** 모바일 푸시 기기 등록(로그인한 뒤 한 번, 허용돼 있을 때만). 허용 묻기는 합류 직후(P-11 뒤)와 S-14 토글 */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    const b = typeof window !== 'undefined' ? window.sweetwo : undefined;
    const platform = b?.platform;
    if (!userId || !b?.push || (platform !== 'ios' && platform !== 'android')) return;
    void b.push
      .token()
      .then((t) => (t ? registerPushDevice(platform, t, b.appVersion) : undefined))
      .catch(() => undefined);
  }, [userId]);
}
