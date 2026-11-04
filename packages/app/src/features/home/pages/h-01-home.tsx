import { fetchMailBounced, fetchUnlinkPartnerName, qk, sendDesktopLink } from '@sweetwo/api';
import { formatDateWeekday, formatMonthDay, homeTodo, homeUpcoming, todayKst } from '@sweetwo/core';
import { Button, Icon, IconButton, type IconName } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { detectPlatform, isMobile } from '../../../platform';
import {
  AddMenu,
  H06NetWorth,
  LineBand,
  LoadingFrame,
  MainFrame,
  RankBanner,
  todoText,
  upcomingName,
  useHomeInput,
  useNetWorth,
  useNoticeBand,
} from '../../frame';
import {
  goalLineName,
  myChecklist,
  savedOf,
  useChecklists,
  useGoalSaved,
  useSplits,
} from '../../salary';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace } from '../data';
import { GoalsCard, SalaryCard, UpcomingCard, type UpcomingItem } from '../parts';

// 홈(19): 오늘 띠(인사 H-01 + ‘월급 체크하기’) → 할 일 한 줄(H-06) → 왼쪽 목표(H-02)·이번 달 월급(H-03),
// 오른쪽 우리 자산(H-04)·다가오는 일정(H-05). 좁은 창은 한 단. 배우자 활동은 알림 센터.
const PC_BAND = 'sweetwo.pcBandDone';
const pcBandDone = () => {
  try {
    return localStorage.getItem(PC_BAND) === '1';
  } catch {
    return true;
  }
};
const markPcBand = () => {
  try {
    localStorage.setItem(PC_BAND, '1');
  } catch {
    /* 기억 못 하면 다음에 한 번 더 보일 수 있음 */
  }
};

// 할 일 띠 앞 그림(docs/design/components/Banner.md ‘할 일 카드’)
const TODO_ICON: Record<NonNullable<ReturnType<typeof homeTodo>>['kind'], IconName> = {
  unlink: 'link',
  reconnect: 'link',
  review: 'check',
  invite: 'user',
  amount: 'pencil',
  matured: 'piggy-bank',
  care: 'gift',
};

export function H01Home() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const lists = useChecklists();
  const splits = useSplits();
  const sums = useGoalSaved();
  const nw = useNetWorth(true);
  // 할 일 한 줄·다가오는 일정은 트레이 위젯과 같은 계산(core homeTodo·homeUpcoming)
  const h = useHomeInput();
  const solo = space.data?.couple_state === 'solo';
  const exName = useQuery({
    queryKey: qk.unlinkPartner,
    queryFn: fetchUnlinkPartnerName,
    enabled: solo && !!h.input?.reconnectFrom,
  });
  // 공지 띠(AD-10): 필독이 먼저, 할 일 한 줄 위
  const notice = useNoticeBand();
  const bounced = useQuery({ queryKey: qk.mailBounced, queryFn: fetchMailBounced });
  // 18 ‘합류 뒤’: 모바일 앱으로 합류한 사람의 첫 홈 띠 1회(PC에서도)
  const [pcBand, setPcBand] = useState(() => isMobile(detectPlatform()) && !pcBandDone());
  if (!me.data || !space.data || !goals.data || lists.isLoading)
    return <LoadingFrame current="month" />;

  // 연결 해제 확정 뒤 처음 열면 해제 안내(25 S-12h)
  if (me.data.onboarding_step === 'S-12H')
    return <Navigate to="/settings/couple/unlinked" replace />;
  // 합류했는데 시작한 사람이 아직 온보딩 중(18 ‘시작한 사람이 아직 온보딩 중’): 월급 계획이 생기면 P-04 → P-06, 그 전엔 홈 대기(상태 변형 4)
  if (me.data.onboarding_step === 'P-WAIT') {
    if (splits.isLoading) return null;
    if (splits.data?.length) return <Navigate to="/join/p-04" replace />;
    const starter = partner.data?.nickname ?? space.data.partner_nickname ?? '';
    return (
      <MainFrame
        current="month"
        columns={[
          <section key="w" className="hg-card hg-stack" aria-label={copy.waitTitle(starter)}>
            <b>{copy.waitTitle(starter)}</b>
            <span className="hg-card__meta">{copy.waitCard(starter)}</span>
          </section>,
        ]}
      />
    );
  }

  const today = todayKst();
  const meId = me.data.id;
  const myName = me.data.nickname ?? '';
  const joined = space.data.couple_state === 'connected';
  const joint = space.data.salary_mode === 'joint';
  const list = myChecklist(lists.data, meId);
  const partnerList =
    !joint && joined ? lists.data?.find((c) => c.owner_user_id === partner.data?.id) : undefined;
  const personName = (id: string | null) =>
    id === meId ? myName : (partner.data?.nickname ?? null);
  const goalName = goalLineName(goals.data, personName, joint);
  const saved = (g: (typeof goals.data)[number]) => savedOf(g, sums.data);

  // H-06 할 일 한 줄(맨 앞 하나, 19 ‘할 일 한 줄 순서’). 초대는 7일, 만기·챙길 날은 그 항목·날짜만 닫힘
  const t0 = h.input ? homeTodo(h.input) : null;
  // 해제 대기 띠가 있으면 같은 할 일 줄은 빼고 띠만
  const t = t0?.kind === 'unlink' && h.unlink ? null : t0;
  const todo = t
    ? {
        text: todoText(t, { partner: partner.data?.nickname ?? '', exPartner: exName.data ?? '' }),
        to: t.to,
        close:
          t.kind === 'invite'
            ? h.closeInvite
            : t.kind === 'matured' ||
                t.kind === 'care' ||
                t.kind === 'review' ||
                t.kind === 'amount'
              ? () => h.closeTodo(t.key)
              : undefined,
      }
    : null;
  const todoBand = todo ? (
    <div className="hg-banner hg-banner--todo hg-body__banner" role="status">
      {/* 띠 전체(그림 + 글자 + 화살표)가 이동 버튼(2026-11-02, 네이버·GCOO 홈처럼). 초대는 ‘코드 복사’가 따로 */}
      <button type="button" className="hg-banner__main" onClick={() => nav(todo.to)}>
        {t?.kind === 'invite' ? (
          // 초대: 빈 자리(점선 +) 하나(2026-11-03, 머리 줄에 내 아바타가 이미 있어 겹치지 않게)
          <span className="hg-banner__pair" aria-hidden="true">
            <span className="hg-banner__slot">
              <Icon name="plus" size={16} />
            </span>
          </span>
        ) : (
          t && (
            <span className="hg-banner__icon" aria-hidden="true">
              <Icon name={TODO_ICON[t.kind]} />
            </span>
          )
        )}
        <span className="hg-banner__text">{todo.text}</span>
        {t?.kind !== 'invite' && <span className="hg-chevron" aria-hidden="true" />}
      </button>
      {t?.kind === 'invite' && (
        // H-06 초대: ‘초대하기’ → 초대 화면 S-12(2026-11-03 ‘코드 복사’ 대신)
        <Button variant="secondary" size="sm" onClick={() => nav(todo.to)}>
          {copy.inviteNow}
        </Button>
      )}
      {todo.close && <IconButton icon="x" label={copy.close} ghost small onClick={todo.close} />}
    </div>
  ) : undefined;
  // 19 홈 상태 3번: 연결 해제 대기 띠(닫기 없음). 요청한 사람 → S-12, 받은 사람 → S-12d. 2026-11-03 공지 띠와 같은 한 줄 파랑
  const unlinkBand = h.unlink ? (
    <LineBand
      icon="link"
      title={copy.unlinkWait}
      sub={copy.unlinkOn(formatMonthDay(h.unlink.deadline))}
      action={{
        label: copy.unlinkCheck,
        onClick: () => nav(h.unlink?.mine ? '/settings/couple' : '/settings/couple/unlink/review'),
      }}
    />
  ) : undefined;
  // 14 ‘알림 메일 반송’: 홈 상단 띠(닫기 없음, 알림 이메일을 바꾸면 사라짐) → S-11b(2026-11-04 이메일 고치는 곳)
  const bounceBand = bounced.data ? (
    <LineBand
      icon="envelope"
      title={copy.mailBounced}
      sub={copy.mailBouncedSub}
      action={{ label: copy.mailCheck, onClick: () => nav('/settings/me/email') }}
    />
  ) : undefined;
  const closePc = () => {
    markPcBand();
    setPcBand(false);
  };
  const pcBandEl =
    pcBand && space.data.created_by && space.data.created_by !== me.data.id ? (
      <LineBand
        icon="info"
        title={copy.pcAlso}
        action={{
          label: copy.pcSend,
          onClick: () =>
            void sendDesktopLink()
              .then(() => toast(copy.pcSent))
              .catch(() => toast(copy.pcFailed))
              .finally(closePc),
        }}
        close={{ label: copy.close, onClick: closePc }}
      />
    ) : undefined;
  const banner =
    notice || todoBand || unlinkBand || bounceBand || pcBandEl ? (
      <>
        {unlinkBand}
        {notice}
        {bounceBand}
        {todoBand}
        {pcBandEl}
      </>
    ) : undefined;

  // H-05 다가오는 일정(30일 안, 날짜순 최대 3개)
  const items: UpcomingItem[] = (h.input ? homeUpcoming(h.input) : []).map((u) => ({
    key: u.key,
    date: u.date,
    label: upcomingName(u, myName),
    dday: u.dday,
    to: u.to,
    kind: u.kind,
  }));

  const go = (to: string) => nav(to);
  // 자산을 하나도 안 적었으면 카드 없음(2026-11-03, ‘자산 추가하기’ 빈 카드가 어색해서. 추가는 우리 자산 탭)
  const assetsCard = nw && !nw.empty ? <H06NetWorth n={nw} /> : null;
  return (
    <MainFrame
      current="month"
      // 2026-11-03 인사 카드(날짜, 인사, 큰 숫자, 진행 막대, ‘월급 체크하기’)를 없애고 맨 위에 이번 달 체크리스트.
      // 인사 문장은 화면 읽기용 제목으로만, 넓은 창은 오른쪽 ‘추가’ 한 줄
      today={{
        plain: true,
        date: formatDateWeekday(today),
        title: copy.homeTitle,
        actions: (
          <>
            {/* ‘추가’는 넓은 창만(Ctrl+N). 좁은 창은 무엇을 추가하는지 알기 어렵고, 목표·자산·캘린더 탭에 + 버튼이 있어서(2026-11-03) */}
            <span className="hg-wide-only">
              <AddMenu />
            </span>
          </>
        ),
      }}
      banner={banner}
      columns={[
        <div key="l" className="hg-stack hg-homecol" style={{ gap: 'var(--space-8)' }}>
          <SalaryCard
            list={list}
            partnerList={partnerList}
            partnerName={partner.data?.nickname ?? ''}
            partnerStarter={!!partner.data && partner.data.id === space.data.created_by}
            goalName={goalName}
            personName={personName}
            meId={meId}
            joint={joint}
            goalTemplate={(id) => goals.data.find((g) => g.id === id)?.template ?? null}
            go={go}
            locked={space.data.couple_state === 'unlink_pending'}
          />
          <GoalsCard
            goals={goals.data}
            savedOf={saved}
            meId={meId}
            joined={joined}
            solo={space.data.couple_state === 'solo'}
            go={go}
          />
        </div>,
        <div key="r" className="hg-stack hg-homecol" style={{ gap: 'var(--space-8)' }}>
          {/* 19 H-01 1a 우리 자산 순위 줄(2026-11-04): 우리 자산(H-04) 바로 위 */}
          <RankBanner entry="home" />
          {assetsCard}
          <UpcomingCard items={items.slice(0, 3)} go={go} />
        </div>,
      ]}
    />
  );
}
