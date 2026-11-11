import { fetchMailBounced, fetchPastChecklists, fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import {
  addDays,
  daysBetween,
  formatDateWeekday,
  formatMonthDay,
  homeTodo,
  homeUpcoming,
  monthProgress,
  todayKst,
  type HomeTodo,
} from '@sweetwo/core';
import { Hub, HubBand, HubHero, HubSaving, HubTile } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import {
  AddMenu,
  LineBand,
  LoadingFrame,
  MainFrame,
  RankBanner,
  todoText,
  useHomeInput,
  useNetWorth,
  useNoticeBand,
} from '../../frame';
import {
  AchieveWatch,
  myChecklist,
  salaryCopy,
  useChecklists,
  useSavingItems,
  useSplits,
} from '../../salary';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace } from '../data';

// 홈(19, 2026-11-09 홈 허브: GCOO 홈처럼 회색 바탕 위 크기가 다른 흰 상자).
// 위에서부터 큰 상자(다음 월급날까지 + 이번 달 보낸 줄 + 보낸 금액 | 모은 금액, → W-02) → 할 일·초대 띠(코코아 채움, 있을 때만, 2026-11-11)
// → 반 칸 타일 둘(월급 계획 → W-01, 오렌지 채운 포인트 상자 / 캘린더 → Y-01) → 저금 상자(목표 금액에 가장 가까운 저금 하나, → W-10)
// → 작은 타일 둘(자산 관리 → F-01, 저금 → W-13) → 자산 순위 줄. 공지·해제 대기·메일 반송 띠는 맨 위 옅은 띠 그대로.

type Box = 'hero' | 'band' | 'plan' | 'calendar' | 'saving' | 'assets' | 'savings';

/** 할 일 띠 오른쪽 이동 글자(없으면 꺾쇠만) */
const bandGo = (t: HomeTodo) =>
  t.kind === 'check' ? copy.bandCheck : t.kind === 'review' ? copy.bandReview : undefined;

export function H01Home() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const lists = useChecklists();
  const splits = useSplits();
  const saving = useSavingItems();
  const nw = useNetWorth(true);
  const { masked } = useMask();
  // 할 일 한 줄·일정은 core homeTodo·homeUpcoming
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
  // H-01 1a 순위 줄은 첫 체크 뒤에만(2026-11-09 round 3): 이번 달 체크리스트에 체크·못 함 줄이 있거나 지난 체크리스트가 있으면
  const checkedAny = (lists.data ?? []).some((c) =>
    c.pay_check_line.some((l) => l.state !== 'wait'),
  );
  const mineNow =
    me.data && space.data
      ? myChecklist(lists.data, space.data.salary_mode === 'joint' ? undefined : me.data.id)
      : undefined;
  const pastOwner = space.data?.salary_mode === 'joint' ? null : (me.data?.id ?? null);
  const pastLists = useQuery({
    queryKey: qk.pastChecklists(pastOwner, mineNow?.cycle_start ?? ''),
    queryFn: () => fetchPastChecklists(pastOwner, mineNow?.cycle_start ?? ''),
    enabled: !checkedAny && !!mineNow,
  });
  // 체크할 체크리스트가 없으면(월급 없음) 그대로 보임
  const showRank = !mineNow || checkedAny || (pastLists.data?.length ?? 0) > 0;
  if (!me.data || !space.data || !goals.data || lists.isLoading)
    return <LoadingFrame current="month" />;

  // 연결 해제 확정 뒤 처음 열면 해제 안내(25 S-12h)
  if (me.data.onboarding_step === 'S-12H')
    return <Navigate to="/settings/couple/unlinked" replace />;
  // 합류했는데 시작한 사람이 아직 온보딩 중(18 ‘시작한 사람이 아직 온보딩 중’): 월급 계획이 생기면 P-04 → P-06, 그 전엔 홈 대기(상태 변형 4)
  if (me.data.onboarding_step === 'P-WAIT') {
    if (splits.isLoading) return <LoadingFrame current="month" />;
    if (splits.data?.length) return <Navigate to="/join/p-04" replace />;
    const starter = partner.data?.nickname ?? space.data.partner_nickname ?? '';
    return (
      <MainFrame
        current="month"
        tone="alt"
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
  const joint = space.data.salary_mode === 'joint';
  const joined =
    space.data.couple_state === 'connected' || space.data.couple_state === 'unlink_pending';
  const list = myChecklist(lists.data, meId);
  const m = (v: number) => money(v, masked);
  const go = (box: Box, to: string) => {
    track('home_box_tapped', { box });
    nav(to);
  };

  // H-06 할 일(맨 앞 하나, 19 ‘할 일 한 줄 순서’). 초대와 다른 할 일 모두 큰 상자 아래 코코아 띠(2026-11-11)
  const t0 = h.input ? homeTodo(h.input) : null;
  // 해제 대기 띠가 있으면 같은 할 일 줄은 빼고 띠만
  const t = t0?.kind === 'unlink' && h.unlink ? null : t0;
  const todoLabel = t
    ? todoText(t, { partner: partner.data?.nickname ?? '', exPartner: exName.data ?? '' })
    : '';
  // 2026-11-11 초대 띠도 할 일 띠와 같은 코코아 띠(HubBand), 큰 상자 바로 아래. “초대하기 ›” → S-12. 할 일은 한 번에 하나라 둘이 같이 나오지 않음.
  // 닫기(✕) 없음(2026-11-11): 할 일은 끝내거나 기간이 지나면 사라지고, 초대는 다른 할 일이 없을 때만(순서 맨 끝)
  const todoBand = t ? (
    <HubBand
      text={todoLabel}
      go={t.kind === 'invite' ? copy.inviteNow : bandGo(t)}
      onClick={() => {
        track('home_box_tapped', { box: 'band', todo: t.kind });
        nav(t.to);
      }}
    />
  ) : null;
  // 19 홈 상태 3번: 연결 해제 대기 띠(닫기 없음). 요청한 사람 → S-12, 받은 사람 → S-12d
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
  // 14 ‘알림 메일 반송’: 홈 상단 띠(닫기 없음, 알림 이메일을 바꾸면 사라짐) → S-11b
  const bounceBand = bounced.data ? (
    <LineBand
      icon="envelope"
      title={copy.mailBounced}
      sub={copy.mailBouncedSub}
      action={{ label: copy.mailCheck, onClick: () => nav('/settings/me/email') }}
    />
  ) : undefined;
  const banner =
    notice || unlinkBand || bounceBand ? (
      <>
        {unlinkBand}
        {notice}
        {bounceBand}
      </>
    ) : undefined;

  // 1. 큰 상자: 다음 월급날까지 + 이번 달 보낸 줄(W-02와 같은 셈) + 보낸 금액 | 모은 금액(내 저금, 합쳐서면 공동)
  const ready = saving.ready ? saving : null;
  const mySavings = ready
    ? ready.live.filter((i) => (ready.joint ? i.owner === 'ours' : i.owner === 'mine'))
    : [];
  const savedMine = mySavings.reduce((s, i) => s + i.saved, 0);
  const people = (
    <span className="hg-avatars" aria-hidden="true">
      {(() => {
        const starter = space.data.created_by;
        const meDot = (
          <PersonDot
            key="me"
            name={me.data.nickname ?? ''}
            starter={starter === meId}
            userId={meId}
          />
        );
        if (!joined || !partner.data) return meDot;
        const pDot = (
          <PersonDot
            key="p"
            name={partner.data.nickname ?? ''}
            starter={starter === partner.data.id}
            userId={partner.data.id}
          />
        );
        return starter === meId ? [meDot, pDot] : [pDot, meDot];
      })()}
    </span>
  );
  let hero;
  if (list) {
    const p = monthProgress({ income: 0, lines: list.pay_check_line });
    const next = addDays(list.cycle_end, 1);
    const left = Math.max(0, daysBetween(today, next));
    const caption = copy.untilPayday(formatMonthDay(next));
    const title = left === 0 ? copy.paydayToday : copy.daysLeft(left);
    hero = (
      <HubHero
        caption={caption}
        title={title}
        people={people}
        percent={p.total ? Math.round((p.done / p.total) * 100) : 0}
        meterLabel={copy.sentLines}
        done={p.done}
        total={p.total}
        split={[
          [copy.sentAmount, m(p.sent)],
          [copy.savedAmount, m(savedMine)],
        ]}
        label={copy.heroLabel({
          caption,
          title,
          total: p.total,
          done: p.done,
          sent: m(p.sent),
          saved: m(savedMine),
        })}
        onClick={() => go('hero', '/salary')}
      />
    );
  } else {
    // 월급 없음(19 상태 변형 2): 큰 상자 자리에 빈 카드 + ‘월급 알려 주기’
    hero = (
      <section className="hg-card hg-card--fill hg-stack hg-hub__wide">
        <p className="hg-card__meta">{copy.noSalary}</p>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav('/settings/me')}
        >
          {copy.tellSalary}
        </button>
      </section>
    );
  }

  // 3. 반 칸 타일: 월급 계획(매달 며칠) / 캘린더(가장 가까운 경조사)
  const dayOf = (u: { payday: number | null; payday_last: boolean } | null | undefined) =>
    !u ? null : u.payday_last ? copy.paydayLast : u.payday ? copy.payday(u.payday) : null;
  const jointDay = space.data.joint_cycle_day;
  const planDay =
    joint && jointDay !== null
      ? jointDay === 31
        ? copy.paydayLast
        : copy.payday(jointDay)
      : dayOf(me.data);
  const care = (h.input ? homeUpcoming(h.input, 365) : []).find((u) => u.kind === 'care');
  // 4. 저금 상자: 목표 금액에 가장 가까운 저금(달성 전, 비율이 가장 높은 것). 목표 금액이 있는 저금이 없으면 없음
  const near = ready?.withTarget
    .filter((i) => i.state === 'saving' && i.target !== null && i.target > 0 && i.saved < i.target)
    .sort((a, b) => b.saved / (b.target ?? 1) - a.saved / (a.target ?? 1))[0];
  // 5. 작은 타일: 순자산 / 저금(저금 목록 W-13과 같은 범위: 그만 모은 것 빼고 모두)
  const liveAll = ready?.live ?? [];
  const savedAll = liveAll.reduce((s, i) => s + i.saved, 0);

  return (
    <MainFrame
      current="month"
      tone="alt"
      // 넓은 창은 제목 줄 “홈” + 오른쪽 ‘추가’, 좁은 창은 제목을 화면 읽기용으로만
      today={{
        plain: true,
        date: formatDateWeekday(today),
        title: copy.homeTitle,
        actions: (
          <span className="hg-wide-only">
            <AddMenu />
          </span>
        ),
      }}
      banner={banner}
      columns={[
        <div key="hub" className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <AchieveWatch />
          <Hub label={copy.hubLabel}>
            {hero}
            {todoBand}
            <HubTile
              title={copy.planTile}
              sub={planDay ? copy.everyMonth(planDay) : undefined}
              art
              point
              onClick={() => go('plan', '/salary?view=plan')}
            />
            <HubTile
              title={copy.calendarTile}
              sub={care ? `${care.name} ${copy.dday(care.dday)}` : copy.noCare}
              art
              onClick={() => go('calendar', '/calendar')}
            />
            {near && (
              <HubSaving
                name={near.goal.name}
                percent={near.pct ?? 0}
                sub={salaryCopy.itemProgress(m(near.saved), m(near.target ?? 0))}
                bar={near.bar}
                label={copy.savingLabel(
                  near.goal.name,
                  near.pct ?? 0,
                  salaryCopy.itemProgress(m(near.saved), m(near.target ?? 0)),
                )}
                onClick={() => go('saving', `/salary/items/${near.goal.id}`)}
              />
            )}
            <HubTile
              small
              title={copy.assetsTile}
              sub={copy.netWorth}
              value={nw ? m(nw.nw.net) : undefined}
              onClick={() => go('assets', '/assets')}
            />
            <HubTile
              small
              title={copy.savingsTile}
              sub={liveAll.length ? copy.savingCount(liveAll.length) : copy.noSavings}
              value={liveAll.length ? m(savedAll) : undefined}
              onClick={() => go('savings', '/salary/items?from=home')}
            />
            {/* 19 H-01 1a 자산 순위 줄: 타일 아래(2026-11-09) */}
            {showRank && (
              <div className="hg-hub__full">
                <RankBanner entry="home" />
              </div>
            )}
          </Hub>
        </div>,
      ]}
    />
  );
}
