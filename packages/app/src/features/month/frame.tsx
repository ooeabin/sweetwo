import { coupleOf, formatDateWeekday, todayKst } from '@sweetwo/core';
import { AppFrame, type AppFrameProps, type AppTab } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../shared/mask';
import { openReceived, proposalCopy, useApplyDue, useProposals } from '../proposals';
import { copy } from './copy';
import { useMe, usePartner, useSpace } from './data';

const HREF: Record<AppTab, string | undefined> = {
  month: '/',
  goals: '/goals',
  assets: undefined, // 우리 자산, 캘린더는 다음 단계
  calendar: undefined,
};

/**
 * 메뉴 첫 화면 틀(AppFrame): 탭 4개(받은 제안 숫자 알약), 도구, 두 사람 아바타, 금액 가리기.
 * 이번 달은 오늘 띠(today), 다른 메뉴는 화면 제목 줄(page).
 */
export function MainFrame(
  p: Pick<AppFrameProps, 'current' | 'today' | 'page' | 'columns' | 'banner'>,
) {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const proposals = useProposals();
  useApplyDue();
  const { masked, toggle } = useMask();
  const received = openReceived(proposals.data ?? [], me.data?.id);
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
    <AppFrame
      {...p}
      tabs={keys.map((key) => ({
        key,
        label: label[key],
        href: HREF[key],
        disabled: !HREF[key],
        ...(key === 'month'
          ? { badge: received.length, badgeLabel: proposalCopy.receivedCount(received.length) }
          : {}),
      }))}
      onTab={(key) => {
        const to = HREF[key];
        if (to) nav(to);
      }}
      date={formatDateWeekday(todayKst())}
      narrowTitle={label[p.current]}
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
  );
}
