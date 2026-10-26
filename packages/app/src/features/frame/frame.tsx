import { coupleOf, formatDateWeekday, todayKst } from '@sweetwo/core';
import { AppFrame, useNarrow, type AppFrameProps, type AppTab } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../shared/mask';
import { N01Panel, useHasUnread, useNotiPanel, useNotiRealtime } from '../notifications';
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
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  const name = c?.myName ?? '';
  const label: Record<AppTab, string> = {
    month: copy.tabMonth,
    goals: copy.tabGoals,
    assets: copy.tabAssets,
    calendar: copy.tabCalendar,
  };
  const keys: AppTab[] = ['month', 'goals', 'assets', 'calendar'];
  return (
    <>
      <AppFrame
        {...p}
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
        saveState={copy.saved}
      />
      <N01Panel />
    </>
  );
}
