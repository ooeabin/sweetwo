import { coupleOf, formatDateWeekday, todayKst } from '@sweetwo/core';
import { AppFrame, useNarrow, type AppFrameProps, type AppTab } from '@sweetwo/ui';
import { isSaving, subscribeSaving, touchApp } from '@sweetwo/api';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../shared/mask';
import { useOnline } from '../../shared/online';
import { N01Panel, useHasUnread, useNotiPanel, useNotiRealtime } from '../notifications';
import { addFor, FrameCommands } from './command';
import { copy } from './copy';
import { useTraySync } from './tray-sync';
import { useMe, usePartner, useSpace } from './data';

const HREF: Record<AppTab, string | undefined> = {
  month: '/',
  goals: '/goals',
  assets: '/assets',
  calendar: '/calendar',
};

/**
 * 메뉴 첫 화면 틀(AppFrame): 탭 4개, 도구, 두 사람 아바타, 금액 가리기.
 * 이번 달은 오늘 띠(today), 다른 메뉴는 화면 제목 줄(page).
 */
export function MainFrame(
  p: Pick<AppFrameProps, 'current' | 'today' | 'page' | 'columns' | 'banner'>,
) {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  // 트레이 위젯 값(데스크톱만)
  useTraySync();
  // 알림(14): 종 점, 넓은 창 패널 / 좁은 창 화면, Realtime(데스크톱 OS 알림)
  useNotiRealtime(me.data?.id);
  const unread = useHasUnread();
  const panel = useNotiPanel();
  const narrow = useNarrow();
  const { masked, toggle } = useMask();
  // 6번 툴팁: 쓰기가 진행 중이면 “저장 중”
  const saving = useSyncExternalStore(subscribeSaving, isSaving);
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  const name = c?.myName ?? '';
  const label: Record<AppTab, string> = {
    month: copy.tabMonth,
    goals: copy.tabGoals,
    assets: copy.tabAssets,
    calendar: copy.tabCalendar,
  };
  const keys: AppTab[] = ['month', 'goals', 'assets', 'calendar'];
  const [palette, setPalette] = useState(false);
  // 데스크톱 앱 접속 신호(14 규칙: 10분 넘게 없으면 서버가 알림을 메일로 대신 보냄)
  const signedIn = !!me.data;
  useEffect(() => {
    if (!signedIn || !window.sweetwo) return;
    void touchApp().catch(() => undefined);
    const t = setInterval(() => void touchApp().catch(() => undefined), 5 * 60_000);
    return () => clearInterval(t);
  }, [signedIn]);
  const online = useOnline();
  const offline = !online && (
    <div className="hg-banner hg-banner--info" role="status">
      <b>{copy.offlineTitle}</b>
      <span>{copy.offlineBody}</span>
    </div>
  );
  return (
    <FrameCommands
      current={p.current}
      narrow={narrow}
      paletteOpen={palette}
      setPaletteOpen={setPalette}
    >
      <AppFrame
        {...p}
        banner={
          offline || p.banner ? (
            <>
              {offline}
              {p.banner}
            </>
          ) : undefined
        }
        onSearch={() => setPalette(true)}
        // 좁은 창 + 버튼: 그 화면에 맞는 추가(설정에서는 숨김)
        onAdd={p.current ? () => nav(addFor(p.current)) : undefined}
        hasNewNoti={!!unread.data}
        onNoti={() => (narrow ? nav('/notifications') : panel.set(!panel.open))}
        onSettings={() => nav('/settings')}
        tabs={keys.map((key) => ({
          key,
          label: label[key],
          href: HREF[key],
          disabled: !HREF[key],
        }))}
        onTab={(key) => {
          const to = HREF[key];
          if (to) nav(to);
        }}
        date={formatDateWeekday(todayKst())}
        narrowTitle={p.current ? label[p.current] : copy.settings}
        labels={{
          search: copy.search,
          mask: copy.mask,
          noti: copy.noti,
          settings: copy.settings,
          add: copy.add,
          me: copy.me,
          stats: copy.stats,
        }}
        masked={masked}
        onMask={toggle}
        // 사람 색은 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
        people={
          c && !c.starter
            ? [
                { name: c.partnerName, no: 1 },
                { name, no: 2 },
              ]
            : [
                { name, no: 1 },
                { name: c?.partnerName ?? '', no: 2, empty: !c?.joined },
              ]
        }
        saveState={saving ? copy.saving : copy.saved}
      />
      <N01Panel />
    </FrameCommands>
  );
}
