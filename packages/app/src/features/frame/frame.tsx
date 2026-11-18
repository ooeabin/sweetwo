import { coupleOf, formatDateWeekday, formatKstMonthDayTime, todayKst } from '@sweetwo/core';
import {
  AppFrame,
  Drawer,
  useNarrow,
  type AppFrameProps,
  type AppTab,
  type DrawerItem,
} from '@sweetwo/ui';
import { isSaving, subscribeSaving, touchApp } from '@sweetwo/api';
import { useQueryClient } from '@tanstack/react-query';
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
import { FrameCommands, searchKey } from './command';
import { copy } from './copy';
import { useMe, usePartner, useSpace } from './data';
import { LineBand, useNoticeMenu } from './notice-band';
import { onSessionReset } from '../../shared/session-reset';
import { lastAssetsTab } from './assets-tab';

// 자산 관리는 마지막 본 하위 탭으로(lastAssetsTab, 2026-11-12 S8-10)
const hrefOf = (key: AppTab): string | undefined =>
  key === 'assets' ? lastAssetsTab() : HREF[key];
const HREF: Record<AppTab, string | undefined> = {
  month: '/',
  salary: '/salary',
  assets: '/assets',
  calendar: '/calendar',
};

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
    /**
     * 좁은 창 머리 ‹와 안드로이드 뒤로를 ‘홈으로’ 대신 이 동작으로(2026-11-18 W-02 ↔ W-01 링크로 열었을 때).
     * 없으면 홈으로
     */
    onBack?: () => void;
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
  // 소셜 계정에서 직접 지정한 프로필 사진 한 번 가져오기(25 S-11e ‘처음 사진’, 2026-11-18)
  useSocialAvatar(me.data?.id, me.data?.space_id);
  const unread = useHasUnread();
  // 종 화면 읽기 이름: 새 알림 점이 있으면 “알림, 새 알림이 있어요”(2026-11-11 QA 4구간 S4-06)
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
  // 서랍 줄(19 앱 기본 틀 11번, 2026-11-16 2단): 월급·자산 관리·캘린더 + 늘 펼친 하위 줄 / 초대하기(합류 전, 혼자 쓰기) / 공지(볼 공지가 있을 때만), 도움말.
  // ‘홈’ 줄은 없음(서랍은 홈 머리에서만 엶). 문의·버전은 설정 › 도움말(S-20) 안, 알림 종은 홈 머리에 있어 서랍에 두지 않음
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
  const item = (
    key: string,
    label: string,
    to: string,
    on: boolean,
    children?: DrawerItem[],
  ): DrawerItem => ({
    key,
    label,
    current: on,
    onSelect: () => go(to, to !== '/', key),
    children,
  });
  // 날짜 없는 사람(각자)은 W-02 확인 목록이 없어 ‘이번 달 월급 체크’ 줄을 숨김(20 W-02 ‘날짜 없는 사람은 W-02 없음’). ‘월급’ 줄이 그 자리(기간 한 줄)로 감
  const noCheck = !!me.data?.payday_none && space.data?.salary_mode !== 'joint';
  const salarySubs = [
    ...(noCheck ? [] : [item('salary_month', d.salaryMonth, '/salary', path === '/salary')]),
    // 저축·투자 줄은 없앰(2026-11-18): W-01 월급 계획 템플릿 안 ‘저축·투자’ 묶음이 정식 자리
    item('salary_plan', d.salaryPlan, '/salary/plan', path === '/salary/plan'),
    // W-21 지난 달 모아보기(2026-11-17). ‘수입 기록’ 줄은 없앰(W-20b는 W-02 ‘수입’ 묶음에서)
    item('month_archive', d.monthArchive, '/salary/archive', path === '/salary/archive'),
  ];
  const assetSubs = [
    item('asset_items', d.assetItems, '/assets/items', path === '/assets/items'),
    // F-08은 동의 전에도 화면이 있음((나) 또래 가구 중간값, 2026-11-13)이라 늘 보임
    item('asset_rank', d.rank, '/assets/rank', path === '/assets/rank'),
  ];
  const calendarSubs = [
    // 캘린더 첫 화면 = 달력 Y-04(2026-11-17, ‘일정 목록’ Y-01 줄은 없앰)
    item('calendar_month', d.calMonth, '/calendar', path === '/calendar'),
    item('gifts', d.gifts, '/calendar/gifts', path === '/calendar/gifts'),
  ];
  const notices = useNoticeMenu(menu);
  const groups: DrawerItem[][] = [
    [
      // 머리 줄은 그 탭 첫 화면(자산 관리는 마지막 본 하위 탭). 하위 줄이 지금 화면이면 머리 줄은 표시 안 함
      item(
        'salary',
        d.salary,
        '/salary',
        path === '/salary' && !salarySubs.some((x) => x.current),
        salarySubs,
      ),
      item('assets', d.assets, lastAssetsTab(), path === '/assets', assetSubs),
      item(
        'calendar',
        d.calendar,
        '/calendar',
        path === '/calendar' && !calendarSubs.some((x) => x.current),
        calendarSubs,
      ),
    ],
    // 2026-11-16: ‘우리 둘’은 설정 홈(S-10) 안으로. 서랍에는 합류 전·혼자 쓰기일 때만 ‘초대하기’ 한 줄
    // (2026-11-16 혼자 쓰기도). 합류 전은 코드를 바로 만들고, 혼자 쓰기는 S-12의 새로 초대하기·다시 연결
    ...(space.data?.couple_state === 'not_joined'
      ? [[item('invite', d.invite, '/settings/couple?invite=1', false)]]
      : space.data?.couple_state === 'solo'
        ? [[item('invite', d.invite, '/settings/couple', false)]]
        : []),
    [
      // 앱 안 공지 화면 N-04(2026-11-16). 보여 줄 공지가 하나라도 있을 때만, 안 읽은 노출 중 공지가 있으면 새 알림 점
      ...(notices.show
        ? [
            {
              key: 'notice',
              label: d.notice,
              current: path === '/notices',
              dot: notices.unread ? d.noticeNew : undefined,
              onSelect: () => {
                setMenu(false);
                track('menu_item_tapped', { item: 'notice' });
                nav('/notices');
              },
            },
          ]
        : []),
      item('help', d.help, '/settings/help', path === '/settings/help'),
    ],
  ];
  // 좁은 창 홈 밖 메뉴 첫 화면(월급, 자산 관리, 캘린더, 설정 홈): ‹ = 홈으로, 안드로이드 뒤로도 홈으로(2026-11-09)
  const hubSub = !p.sub && p.current !== 'month';
  const online = useOnline();
  useHardwareBack(
    menu
      ? () => {
          setMenu(false);
          return true;
        }
      : narrow && hubSub
        ? () => {
            if (p.onBack) p.onBack();
            else goHome();
            return true;
          }
        : null,
  );
  // 오프라인(13 공통 상태 6·9번): 기기에 둔 데이터가 있으면 “오프라인” + 마지막 저장 시각, 없으면 “연결이 끊겼어요”.
  // 기기 저장(모바일 브리지 cache)이 없어도 이미 받아 둔 화면 데이터가 있으면 9번(마지막으로 받은 시각, 2026-11-12 S6-17)
  const qc = useQueryClient();
  const cachedAt = useCacheInfo((s) => s.savedAt);
  const fetchedAt = online ? 0 : lastFetched(qc);
  const savedAt = cachedAt ?? (fetchedAt ? new Date(fetchedAt).toISOString() : null);
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
        onHome={p.onBack ?? goHome}
        hasNewNoti={!!unread.data}
        onNoti={() => (narrow ? nav('/notifications') : panel.set(!panel.open))}
        onSettings={() => nav('/settings')}
        tabs={keys.map((key) => ({
          key,
          label: label[key],
          href: hrefOf(key),
          disabled: !HREF[key],
        }))}
        onTab={(key) => {
          const to = hrefOf(key);
          if (to) nav(to);
        }}
        date={formatDateWeekday(todayKst())}
        // 머리 제목 = 화면 이름(2026-11-18, 서랍 줄 이름과 같게). 제목 줄(page.title)이 글자면 그것, 없으면 메뉴 이름
        narrowTitle={
          p.narrowTitle ??
          (typeof p.page?.title === 'string'
            ? p.page.title
            : p.current
              ? label[p.current]
              : copy.settings)
        }
        labels={{
          search: copy.search,
          searchKey: searchKey(),
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
          onClose={() => setMenu(false)}
        />
      )}
    </FrameCommands>
  );
}

/** 받아 둔 화면 데이터 중 가장 최근에 받은 때(ms, 없으면 0) */
function lastFetched(qc: ReturnType<typeof useQueryClient>) {
  let at = 0;
  for (const q of qc.getQueryCache().getAll())
    if (q.state.status === 'success' && q.state.dataUpdatedAt > at) at = q.state.dataUpdatedAt;
  return at;
}
