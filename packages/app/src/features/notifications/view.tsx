import { maskMoney, notiGroup, notiTime } from '@sweetwo/core';
import { leadOf, NotificationPanel } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRevertibleNotifications, qk, revertPartnerChange, RevertGone } from '@sweetwo/api';
import { track } from '../../shared/analytics';
import { toast } from '../../shared/toast';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../shared/mask';
import { copy } from './copy';
import { markRead, useNotiList, useNotiPeople, useOpenNotification } from './data';

/** N-01·N-02 공통 내용: 묶음(오늘·이번 주·이전), 줄, 모두 읽음, 더 불러오기, 실패·오프라인 */
export function NotiView({ variant, onClose }: { variant: 'sheet' | 'page'; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useNotiList();
  const person = useNotiPeople();
  const open = useOpenNotification();
  const { masked } = useMask();
  // R-08: 같이 쓰는 것을 상대가 바꾼 알림 중 지금 돌릴 수 있는 것(서버가 고름: 그 뒤 안 바뀜, 같이 쓰는 항목만)
  const revertible = useQuery({
    queryKey: qk.revertibleNotis,
    queryFn: fetchRevertibleNotifications,
  });
  const [reverting, setReverting] = useState<string | null>(null);
  const revert = async (id: string, createdAt: string) => {
    if (reverting) return;
    setReverting(id);
    try {
      await revertPartnerChange(id);
      track('partner_change_reverted', {
        hours_since_change: Math.max(
          0,
          Math.floor((Date.now() - Date.parse(createdAt)) / 3_600_000),
        ),
      });
      toast(copy.reverted);
      // 돌린 값이 화면 여기저기(저금, 월급 계획, 캘린더)에 있어 모두 다시 읽음
      await qc.invalidateQueries();
    } catch (e) {
      toast(e instanceof RevertGone ? copy.revertGone : copy.revertFailed);
      void revertible.refetch();
    } finally {
      setReverting(null);
    }
  };
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  // 0.3초 넘게 걸릴 때만 Skeleton
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!list.isLoading) return setSlow(false);
    timer.current = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(timer.current);
  }, [list.isLoading]);

  const rows = (list.data?.pages ?? []).flat();
  const now = new Date();
  const item = (n: (typeof rows)[number]) => ({
    id: n.id,
    msg: masked ? maskMoney(n.title) : n.title,
    time: notiTime(n.created_at, now),
    read: !!n.read_at,
    // 아이콘이 있는 알림(목표 금액 달성 등)은 사람이 있어도 아이콘 자리(14 ‘센터 표시’, 2026-11-12 S10-05)
    person: n.icon ? undefined : person(n.actor_id),
    // 알림 아이콘(기획서 14 ‘센터 표시’ Phosphor 이름 → lead-kinds.ts noti 표, 모르는 것은 종)
    ...leadOf('noti', n.icon),
    ...(revertible.data?.includes(n.id)
      ? {
          action: {
            label: copy.revert,
            busy: reverting === n.id,
            onClick: () => void revert(n.id, n.created_at),
          },
        }
      : {}),
  });
  const groups = (['today', 'week', 'earlier'] as const).map((key) => ({
    key,
    label: copy.groups[key],
    items: rows.filter((n) => notiGroup(n.created_at, now) === key).map(item),
  }));

  return (
    <NotificationPanel
      variant={variant}
      labels={{
        title: copy.title,
        readAll: copy.readAll,
        settings: copy.settings,
        close: copy.close,
        back: copy.back,
        emptyTitle: copy.empty,
        unread: copy.unread,
      }}
      groups={groups}
      loading={list.isLoading && slow}
      error={
        list.isError && !rows.length
          ? { text: copy.loadFailed, retry: copy.retry, onRetry: () => void list.refetch() }
          : undefined
      }
      notice={
        online ? undefined : (
          <p className="hg-help" style={{ margin: 0, padding: 'var(--space-2) var(--space-5)' }}>
            {copy.offline}
          </p>
        )
      }
      onItem={(id) => {
        const n = rows.find((x) => x.id === id);
        if (n) void open(n);
      }}
      onReadAll={() => void markRead(qc)}
      onSettings={() => {
        onClose();
        nav('/settings/notifications');
      }}
      onClose={onClose}
      onEnd={list.hasNextPage ? () => void list.fetchNextPage() : undefined}
      more={list.isFetchingNextPage}
    />
  );
}
