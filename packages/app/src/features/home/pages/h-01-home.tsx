import { fetchMailBounced, fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import {
  addDays,
  daysBetween,
  formatDateWeekday,
  formatMonthDay,
  homeTodo,
  homeUpcoming,
  monthProgress,
  pickTopBanner,
  todayKst,
  type HomeTodo,
} from '@sweetwo/core';
import { Hub, HubBand, HubHero, HubSaving, HubTile, Illustration } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import { sharedCopy } from '../../../shared/copy';
import {
  AddMenu,
  lastAssetsTab,
  LineBand,
  LoadingFrame,
  MainFrame,
  useRank,
  todoText,
  useAssetRealtime,
  useHomeInput,
  useNetWorth,
  useNoticeBand,
} from '../../frame';
import {
  AchieveWatch,
  myChecklist,
  salaryCopy,
  useChecklists,
  useCheckRealtime,
  useSavingItems,
  useSplitRealtime,
  useSplits,
} from '../../salary';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace } from '../data';

// 홈(19, 2026-11-09 홈 허브: GCOO 홈처럼 회색 바탕 위 크기가 다른 흰 상자).
// 위에서부터 큰 상자(다음 월급날까지 + 이번 달 체크 + 체크한 금액 | 모은 금액, → W-02) → 할 일·초대 띠(코코아 채움, 있을 때만, 2026-11-11)
// → 반 칸 타일 둘(월급 계획 → W-01, 오렌지 채운 포인트 상자 / 캘린더 → Y-01) → 저금 상자(목표 금액에 가장 가까운 저금 하나, → W-10)
// → 작은 타일 둘(자산 관리 → F-01, 순위 배지 / 저금 → W-13).
// 본문 맨 위 띠(해제 대기, 공지, 메일 반송)는 하나만(core pickTopBanner, 2026-11-11 D3, 오프라인은 앱 틀이 먼저).
// 상대가 바꾸면 Realtime으로 바로 다시 읽음(월급 계획 salary_split, 체크 pay_check_line, 알림 종류별, 2026-11-11 S4-02).

type Box = 'hero' | 'band' | 'plan' | 'calendar' | 'saving' | 'assets' | 'savings';

/** 할 일 띠 오른쪽 이동 글자(없으면 꺾쇠만) */
const bandGo = (t: HomeTodo) =>
  t.kind === 'check' ? copy.bandCheck : t.kind === 'review' ? copy.bandReview : undefined;

export function H01Home() {
  const nav = useNavigate();
  const qc = useQueryClient();
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
  // H-04 자산 관리 타일 제목 아래 “상위 38%”(2026-11-11, 홈 순위 줄 1a 대신): 순위를 본 적이 있을 때만
  const rank = useRank();
  const rankPct =
    rank && (rank.state.kind === 'seen' || rank.state.kind === 'stale') ? rank.state.pct : null;
  // P-WAIT 대기(시작한 사람이 월급 계획을 만들면 P-04로)와 합쳐서 모드 상대 체크를 바로 받음
  useSplitRealtime(space.data?.id);
  useCheckRealtime(space.data?.id);
  useAssetRealtime(space.data?.id);
  // 체크리스트는 처음 받을 때만 기다림. 한 번 실패한 뒤 다시 받는 동안은 홈을 그대로 두고 큰 상자만 오류 카드
  // (데이터가 없는 쿼리는 다시 받을 때 pending으로 돌아가 불러오는 중 틀 ↔ 홈이 계속 바뀌지 않게, S4-01)
  const listsFirstLoad = lists.isLoading && lists.errorUpdateCount === 0;
  if (!me.data || !space.data || !goals.data || listsFirstLoad)
    return <LoadingFrame current="month" />;

  // 연결 해제 확정 뒤 처음 열면 해제 안내(25 S-12h)
  if (me.data.onboarding_step === 'S-12H')
    return <Navigate to="/settings/couple/unlinked" replace />;
  // 합류했는데 시작한 사람이 아직 온보딩 중(18 ‘시작한 사람이 아직 온보딩 중’): 월급 계획이 생기면 P-04 → P-06, 그 전엔 홈 대기(상태 변형 4)
  if (me.data.onboarding_step === 'P-WAIT') {
    if (splits.isLoading) return <LoadingFrame current="month" />;
    if (splits.data?.length) return <Navigate to="/join/p-04" replace />;
    const starter = partner.data?.nickname ?? space.data.partner_nickname ?? '';
    // 2026-11-11 S3-32: 96px 그림 자리(그림이 들어올 때까지 회색 빈 자리). 2026-11-11 사용자 결정: 카드 없이 화면 가운데(다른 상태 화면처럼, hg-hubwait).
    // 시작한 사람이 월급 계획을 만들면 Realtime(salary_split, plan_ready 알림)으로 splits가 다시 읽혀 P-04로 넘어감
    return (
      <MainFrame
        current="month"
        columns={[
          <section
            key="w"
            className="hg-hubwait"
            role="status"
            aria-label={copy.waitTitle(starter)}
          >
            <Illustration name="status-waiting" className="hg-auth__art" />
            <b className="hg-hubwait__title">{copy.waitTitle(starter)}</b>
            <span className="hg-hubwait__sub">{copy.waitCard(starter)}</span>
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
        // 월급 전 확인은 홈에서 왔다고 남김(32 month_check_viewed entry)
        nav(t.kind === 'review' ? `${t.to}${t.to.includes('?') ? '&' : '?'}from=home` : t.to);
      }}
    />
  ) : null;
  // 19 홈 상태 3번: 연결 해제 대기 띠(닫기 없음). 요청한 사람 “연결 해제를 기다리고 있어요” → S-12,
  // 받은 사람 “{이름}님이 연결 해제를 요청했어요” → S-12d(2026-11-11 D5). 아래 줄은 둘 다 “{날짜}에 해제돼요”
  // 맨 위 띠는 하나만(2026-11-11 D3): 해제 대기 > 필독 공지 > 메일 반송 > 일반 공지
  const top = pickTopBanner({
    unlink: !!h.unlink,
    must_notice: !!notice?.must,
    mail_bounced: !!bounced.data,
    notice: !!notice && !notice.must,
  });
  const unlinkBand = h.unlink ? (
    <LineBand
      icon="link"
      title={h.unlink.mine ? copy.unlinkWait : copy.unlinkRequested(partner.data?.nickname ?? '')}
      sub={copy.unlinkOn(formatMonthDay(h.unlink.deadline))}
      action={{
        label: copy.unlinkCheck,
        onClick: () => {
          track('home_banner_tapped', { banner: 'unlink', action: 'open' });
          nav(h.unlink?.mine ? '/settings/couple' : '/settings/couple/unlink/review');
        },
      }}
    />
  ) : undefined;
  // 14 ‘알림 메일 반송’: 홈 상단 띠(닫기 없음, 알림 이메일을 바꾸면 사라짐) → S-11b
  const bounceBand = bounced.data ? (
    <LineBand
      icon="envelope"
      title={copy.mailBounced}
      sub={copy.mailBouncedSub}
      action={{
        label: copy.mailCheck,
        onClick: () => {
          track('home_banner_tapped', { banner: 'mail_bounced', action: 'open' });
          nav('/settings/me/email');
        },
      }}
    />
  ) : undefined;
  const banner =
    top === 'unlink'
      ? unlinkBand
      : top === 'mail_bounced'
        ? bounceBand
        : top === 'must_notice' || top === 'notice'
          ? notice?.node
          : undefined;

  // 1. 큰 상자: 다음 월급날까지 + 이번 달 체크(W-02와 같은 셈) + 체크한 금액 | 모은 금액(내 저금, 합쳐서면 공동)
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
  // 월급 없음(19 상태 변형 2): 내(합쳐서면 두 사람) 월급이 0원이거나 없음(O-31 ‘지금은 월급이 없어요’)
  const noSalary = joint
    ? !me.data.monthly_income && !partner.data?.monthly_income
    : !me.data.monthly_income;
  let hero;
  if (list && !lists.isError) {
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
  } else if (noSalary) {
    // 월급 없음(19 상태 변형 2): 큰 상자 자리에 흰 카드 + ‘월급 알려 주기’. 월급이 있는데 체크리스트가 없으면 아래 오류 카드(2026-11-11 S4-01)
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
  } else {
    // 체크리스트를 못 불러옴(실패, 또는 월급이 있는데 이번 사이클 체크리스트가 없음): 13 공통 상태 7번 문구 + ‘다시 시도’(2026-11-11 S4-01)
    hero = (
      <section className="hg-card hg-card--fill hg-stack hg-hub__wide" role="status">
        <p className="hg-card__title">{sharedCopy.errorTitle}</p>
        <p className="hg-card__meta">{sharedCopy.errorBody}</p>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            track('home_box_tapped', { box: 'retry' });
            void qc.invalidateQueries({ queryKey: ['pay_checklist'] });
            void qc.invalidateQueries({ queryKey: qk.splits });
          }}
        >
          {sharedCopy.retry}
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
  // 4. 저금 상자: 목표 금액에 가장 가까운 저금(달성 전, 비율이 가장 높은 것). 목표 금액이 있는 저금이 없으면 없음.
  // 파트너 저금이면 이름 옆 파트너 이름 배지(애칭, 없으면 ‘파트너’, 2026-11-11 D4)
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
                badge={near.owner === 'partner' ? copy.ownerBadge(near.ownerName) : undefined}
                percent={near.pct ?? 0}
                sub={salaryCopy.itemProgress(m(near.saved), m(near.target ?? 0))}
                bar={near.bar}
                label={copy.savingLabel(
                  near.owner === 'partner'
                    ? `${near.goal.name}, ${copy.ownerBadge(near.ownerName)}`
                    : near.goal.name,
                  near.pct ?? 0,
                  salaryCopy.itemProgress(m(near.saved), m(near.target ?? 0)),
                )}
                onClick={() => go('saving', `/salary/items/${near.goal.id}`)}
              />
            )}
            <HubTile
              small
              title={copy.assetsTile}
              // 자산·부채가 하나도 없으면 “아직 없어요”(저금 타일과 같음, 2026-11-11 D5)
              sub={nw?.empty ? copy.noAssets : undefined}
              value={nw && !nw.empty ? m(nw.nw.net) : undefined}
              badge={rankPct === null || nw?.empty ? undefined : copy.rankBadge(rankPct)}
              label={
                nw && !nw.empty
                  ? copy.assetsTileLabel(
                      m(nw.nw.net),
                      rankPct === null ? null : copy.rankBadge(rankPct),
                    )
                  : undefined
              }
              // 자산 관리 마지막 본 하위 탭으로(2026-11-12 S8-10)
              onClick={() => go('assets', lastAssetsTab())}
            />
            <HubTile
              small
              title={copy.savingsTile}
              sub={liveAll.length ? copy.savingCount(liveAll.length) : copy.noSavings}
              value={liveAll.length ? m(savedAll) : undefined}
              onClick={() => go('savings', '/salary/items?from=home')}
            />
          </Hub>
        </div>,
      ]}
    />
  );
}
