import { markNotificationsRead, qk } from '@sweetwo/api';
import { maskMoney, notiGroup, notiTime } from '@sweetwo/core';
import { NotificationPanel, type IconName } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useMask } from '../../shared/mask';
import { copy } from './copy';
import { useNotiList, useNotiPeople, useOpenNotification } from './data';

// 알림 아이콘(기획서 14 ‘센터 표시’ Phosphor 이름 → 앱 아이콘 모음). 없는 것은 종
const ICON: Record<string, IconName> = {
  gift: 'gift',
  'calendar-check': 'calendar',
  'clipboard-text': 'check',
  wallet: 'wallet',
  'piggy-bank': 'piggy-bank',
  'shield-check': 'shield-check',
  heart: 'gift',
  house: 'house',
};

/** N-01·N-02 공통 내용: 묶음(오늘·이번 주·이전), 줄, 모두 읽음, 더 불러오기, 실패·오프라인 */
export function NotiView({ variant, onClose }: { variant: 'sheet' | 'page'; onClose: () => void }) {
  const qc = useQueryClient();
  const list = useNotiList();
  const person = useNotiPeople();
  const open = useOpenNotification();
  const { masked } = useMask();
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
    person: person(n.actor_id),
    icon: ICON[n.icon ?? ''] ?? ('bell' as const),
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
        emptySub: copy.emptySub,
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
      onReadAll={async () => {
        await markNotificationsRead().catch(() => undefined);
        await qc.invalidateQueries({ queryKey: qk.notifications });
      }}
      // 알림 설정(S-14)은 설정 화면과 함께
      onSettings={undefined}
      onClose={onClose}
      onEnd={list.hasNextPage ? () => void list.fetchNextPage() : undefined}
      more={list.isFetchingNextPage}
    />
  );
}
