import { coupleOf, formatDateWeekday, formatKstMonthDayTime, todayKst } from '@sweetwo/core';
import {
  AppFrame,
  Drawer,
  IconButton,
  useNarrow,
  type AppFrameProps,
  type AppTab,
  type DrawerItem,
} from '@sweetwo/ui';
import { isSaving, subscribeSaving, touchApp } from '@sweetwo/api';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { track } from '../../shared/analytics';
import { useMask } from '../../shared/mask';
import { usePeopleArt, useSocialAvatar } from '../../shared/person';
import { useCacheInfo } from '../../shared/offline-cache';
import { useOnline } from '../../shared/online';
import {
  N01Panel,
  useHasUnread,
  useNotiPanel,
  useNotiRealtime,
  usePushRegistration,
} from '../notifications';
import { FrameCommands } from './command';
import { copy } from './copy';
import { useMe, usePartner, useSpace } from './data';
import { LineBand } from './notice-band';
import { onSessionReset } from '../../shared/session-reset';

const HREF: Record<AppTab, string | undefined> = {
  month: '/',
  salary: '/salary',
  assets: '/assets',
  calendar: '/calendar',
};

/** 웹사이트 페이지 열기(앱은 앱 안 브라우저, 웹은 새 창). 서랍 ‘공지’ → L-03 */
const openSite = (path: string) => {
  const url = `${SITE}${path}`;
  const b = window.sweetwo;
  if (b?.openUrl) void b.openUrl(url);
  else window.open(url, '_blank', 'noopener');
};
const SITE = 'https://sweetwo.kr';

const useMenuStore = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));
onSessionReset(() => useMenuStore.setState({ open: false }));

/** 홈이 마지막으로 그려졌을 때의 기록 위치(react-router history.state.idx). ‹·하드웨어 뒤로가 홈 바로 다음이면 뒤로 가기 */
let homeIdx: number | null = null;
const histIdx = () => {
  const st: unknown = window.history.state;
  return st && typeof st === 'object' && 'idx' in st && typeof st.idx === 'number' ? st.idx : null;
};

/** 안드로이드 뒤로(하드웨어) 처리 순서: 나중에 붙은 것이 먼저. true면 처리함 */
const backHandlers: (() => boolean)[] = [];
let backBound = false;
function useHardwareBack(fn: (() => boolean) | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ref.current) return;
    const h = () => ref.current?.() ?? false;
    backHandlers.push(h);
    const b = window.sweetwo;
    if (!backBound && b?.onBack) {
      backBound = true;
      b.onBack(() => [...backHandlers].reverse().some((h) => h()));
    }
    return () => {
      const i = backHandlers.indexOf(h);
      if (i >= 0) backHandlers.splice(i, 1);
    };
  }, [!!fn]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * 메뉴 첫 화면 틀(AppFrame): 넓은 창은 탭 4개 사이드바, 좁은 창(2026-11-09)은 홈 머리 ☰ 메뉴 서랍 + 홈 밖 메뉴 ‘‹ 홈으로’.
 * 홈은 제목 줄(today), 다른 메뉴는 화면 제목 줄(page).
 */
export function MainFrame(
  p: Pick<AppFrameProps, 'current' | 'today' | 'page' | 'columns' | 'banner' | 'tone'> & {
    /**
     * 메뉴 첫 화면이 아닌 화면. detail = 저금 항목 상세, 항목 상세 같은 안쪽 화면. settings = 설정 하위·알림 화면.
     * 둘 다 좁은 창은 앱 머리 없이 ‘‹ 제목’ 한 줄(2026-11-04)
     */
    sub?: 'detail' | 'settings';
    /** 좁은 창 앱 머리 제목(메뉴 밖 화면, 예: N-02 “알림”). 없으면 메뉴 이름, 메뉴가 없으면 “설정” */
    narrowTitle?: string;
  },
) {
  const nav = useNavigate();
  const loc = useLocation();
  // 서랍 열림은 틀 밖에 둠(불러오는 중 틀 → 홈 틀로 바뀌어도 열린 채)
  const { open: menu, set: setMenu } = useMenuStore();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  // 알림(14): 종 점, 넓은 창 패널 / 좁은 창 화면, Realtime, 푸시
  useNotiRealtime(me.data?.id);
  usePushRegistration(me.data?.id);
  // 소셜 계정 프로필 사진 한 번 가져오기(25 S-11e ‘처음 사진’, 2026-11-05)
  useSocialAvatar(me.data?.id, me.data?.space_id);
  const unread = useHasUnread();
  // 종 화면 읽기 이름: 새 알림 점이 있으면 “알림, 새 알림 있음”(2026-11-11 QA 4구간 S4-06)
  const notiLabel = unread.data ? copy.notiNew : copy.noti;
  const panel = useNotiPanel();
  const narrow = useNarrow();
  // 서랍은 좁은 창만: 열린 채 넓은 창(태블릿 가로 돌림 등)이 되면 닫음(2026-11-11 S4-15)
  useEffect(() => {
    if (!narrow && useMenuStore.getState().open) setMenu(false);
  }, [narrow, setMenu]);
  const { masked, toggle } = useMask();
  // 6번 툴팁: 쓰기가 진행 중이면 “저장 중”
  const saving = useSyncExternalStore(subscribeSaving, isSaving);
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  const name = c?.myName ?? '';
  // 두 사람 그림(올린 사진 → 지정 아바타 그림, 없으면 첫 글자. 2026-11-03)
  const art = usePeopleArt();
  const mySrc = art(me.data?.id);
  const partnerSrc = art(partner.data?.id);
  const label: Record<AppTab, string> = {
    month: copy.tabMonth,
    salary: copy.tabSalary,
    assets: copy.tabAssets,
    calendar: copy.tabCalendar,
  };
  const keys: AppTab[] = ['month', 'salary', 'assets', 'calendar'];
  const [palette, setPalette] = useState(false);
  // 앱 접속 신호(14 규칙: 10분 넘게 없고 푸시 기기도 없으면 서버가 월급 전 확인 알림을 메일로 대신 보냄)
  const signedIn = !!me.data;
  useEffect(() => {
    if (!signedIn || !window.sweetwo) return;
    void touchApp().catch(() => undefined);
    const t = setInterval(() => void touchApp().catch(() => undefined), 5 * 60_000);
    return () => clearInterval(t);
  }, [signedIn]);
  // 서랍 줄(19 앱 기본 틀 11번): 메뉴 4개 / 내 정보, 설정 / 우리 둘(+ 초대하기, 파트너 합류 전만) / 공지, 문의, 도움말
  const go = (to: string, replace = false, key?: string) => {
    setMenu(false);
    if (key) track('menu_item_tapped', { item: key });
    // 홈 밖 메뉴끼리 옮길 때는 바꿔치기(뒤로가 늘 홈으로 오게, 2026-11-09)
    nav(to, { replace: replace && loc.pathname !== '/' });
  };
  const path = loc.pathname;
  if (path === '/') homeIdx = histIdx();
  // ‹(홈으로): 홈에서 바로 왔으면 뒤로(기록이 쌓이지 않게), 아니면 홈으로 바꿔치기
  const goHome = () => {
    const i = histIdx();
    if (homeIdx !== null && i !== null && i === homeIdx + 1) nav(-1);
    else nav('/', { replace: true });
  };
  const d = copy.drawer;
  const item = (key: string, label: string, to: string, on: boolean): DrawerItem => ({
    key,
    label,
    current: on,
    onSelect: () => go(to, to !== '/', key),
  });
  const groups: DrawerItem[][] = [
    [
      item('home', d.home, '/', path === '/'),
      item('salary', d.salary, '/salary', path === '/salary'),
      item('assets', d.assets, '/assets', path === '/assets' || path === '/assets/items'),
      item('calendar', d.calendar, '/calendar', path === '/calendar/list'),
    ],
    [
      item('me', d.me, '/settings/me', path === '/settings/me'),
      item('settings', d.settings, '/settings', path === '/settings'),
    ],
    [
      item('couple', d.couple, '/settings/couple', path === '/settings/couple'),
      ...(space.data?.couple_state === 'not_joined'
        ? [item('invite', d.invite, '/settings/couple?invite=1', false)]
        : []),
    ],
    [
      {
        key: 'notice',
        label: d.notice,
        onSelect: () => {
          setMenu(false);
          track('menu_item_tapped', { item: 'notice' });
          openSite('/releases');
        },
      },
      item('inquiry', d.inquiry, '/settings/help/inquiries', path === '/settings/help/inquiries'),
      item('help', d.help, '/settings/help', path === '/settings/help'),
    ],
  ];
  const version =
    window.sweetwo?.appVersion ?? (import.meta.env.VITE_APP_VERSION as string | undefined);
  // 좁은 창 홈 밖 메뉴 첫 화면(월급, 자산 관리, 캘린더, 설정 홈): ‹ = 홈으로, 안드로이드 뒤로도 홈으로(2026-11-09)
  const hubSub = !p.sub && p.current !== 'month';
  useHardwareBack(
    menu
      ? () => {
          setMenu(false);
          return true;
        }
      : narrow && hubSub
        ? () => {
            goHome();
            return true;
          }
        : null,
  );
  const online = useOnline();
  // 오프라인(13 공통 상태 6·9번): 기기에 둔 데이터가 있으면 “오프라인” + 마지막 저장 시각, 없으면 “연결이 끊겼어요”
  const savedAt = useCacheInfo((s) => s.savedAt);
  // 회색 띠(LineBand). 맨 위 띠는 하나만이고 오프라인이 가장 먼저(core pickTopBanner, 2026-11-11 D3): 오프라인이면 화면이 준 띠는 숨김
  const offline = !online && (
    <LineBand
      icon="circle-alert"
      title={savedAt ? copy.offlineCached : copy.offlineTitle}
      sub={savedAt ? copy.lastSaved(formatKstMonthDayTime(savedAt)) : copy.offlineBody}
    />
  );
  return (
    <FrameCommands
      current={p.current}
      narrow={narrow}
      paletteOpen={palette}
      setPaletteOpen={setPalette}
    >
      <AppFrame
        current={p.current}
        today={p.today}
        page={p.page}
        columns={p.columns}
        sub={!!p.sub}
        tone={p.tone}
        banner={offline || p.banner || undefined}
        onSearch={() => setPalette(true)}
        // 2026-11-09 좁은 창 + 버튼(FAB)과 하단 탭 막대 없앰: 추가는 화면 안 ‘+ … 추가’ 줄, 메뉴는 홈 머리 ☰ 서랍
        onMenu={() => setMenu(true)}
        menuOpen={menu}
        onHome={goHome}
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
        narrowTitle={p.narrowTitle ?? (p.current ? label[p.current] : copy.settings)}
        labels={{
          search: copy.search,
          mask: copy.mask,
          noti: notiLabel,
          settings: copy.settings,
          menu: copy.menu,
          home: copy.home,
          me: copy.me,
          stats: copy.stats,
        }}
        masked={masked}
        onMask={toggle}
        // 사람 색은 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
        people={
          c && !c.starter
            ? [
                { name: c.partnerName, no: 1, src: partnerSrc },
                { name, no: 2, src: mySrc },
              ]
            : [
                { name, no: 1, src: mySrc },
                { name: c?.partnerName ?? '', no: 2, empty: !c?.joined, src: partnerSrc },
              ]
        }
        saveState={saving ? copy.saving : copy.saved}
      />
      <N01Panel />
      {menu && (
        <Drawer
          label={copy.menu}
          navLabel={copy.menuList}
          closeLabel={copy.close}
          groups={groups}
          tools={
            <IconButton
              icon="bell"
              label={notiLabel}
              ghost
              dot={!!unread.data}
              onClick={() => go('/notifications')}
            />
          }
          foot={version ? copy.version(version) : undefined}
          onClose={() => setMenu(false)}
        />
      )}
    </FrameCommands>
  );
}
