import { dismissHomeTask, fetchMailBounced, fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import {
  addDays,
  autoPickTaskOpen,
  daysBetween,
  formatDateWeekday,
  formatMonthDay,
  homeUpcoming,
  kstDateOf,
  leftover,
  lineIsMine,
  pickHeroes,
  pickMonthLine,
  pickTopBanner,
  pickTopTasks,
  bundleInviteGoal,
  PUSH_KINDS,
  pushKindOn,
  pushReaskOpen,
  reconcileTask,
  savingsTotal,
  todayKst,
  type BundleView,
  type HeroGoal,
  type MarriageStatus,
  type TopTask,
} from '@sweetwo/core';
import { Hub, HubBand, HubTile, Illustration } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track, type AnalyticsEvent } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import { toast } from '../../../shared/toast';
import { sharedCopy } from '../../../shared/copy';
import { WaitNudge } from '../../pairing';
import {
  AddMenu,
  lastAssetsTab,
  LineBand,
  LoadingFrame,
  MainFrame,
  homeText,
  useRank,
  useAssetRealtime,
  useHomeInput,
  useNetWorth,
  useNoticeBand,
} from '../../frame';
import {
  AchieveWatch,
  baseDayOf,
  firstPaydayOf,
  useShownPayday,
  myChecklist,
  salaryChangedDay,
  useChecklists,
  useCheckRealtime,
  useGoalRealtime,
  useSavingItems,
  useSplitRealtime,
  useSplits,
} from '../../salary';
import { copy } from '../copy';
import {
  useBundles,
  useGoals,
  useHeroMoves,
  useHeroNotes,
  useHomeRealtime,
  useHomeTasks,
  useMe,
  useModeRequest,
  useRankRequest,
  useMoneyInPeriod,
  usePartner,
  usePreviousChecklist,
  useSalaryChanges,
  useSharedAccounts,
  useSpace,
  useUpcomingNotes,
} from '../data';
import { H10SaveTogether } from './h-10-save-together';
import { useWidgetSync, widgetNext, widgetSave } from '../widget-sync';
import { H11MonthLine } from './h-11-month-line';
import { H12Wedding } from './h-12-wedding';

// 홈 v2.2(19 ‘홈 v2.2’, ADR 0009 결정 1): 회색 바탕 위 흰 상자.
// 좁은 창: H-10 같이 모으기(주인공) → H-11 이번 달 한 줄(날짜 없는 사람 H-13) → H-06 할 일 띠(16순서, core pickTopTask)
// → H-07 월급 계획(포인트 상자, + 여유 자금)·H-08 캘린더 → H-12 결혼 준비(결혼 준비 중만) → H-04 자산 관리·H-09 저금.
// 넓은 창(1100px 이상 4열)은 CSS 격자가 띠를 맨 위, H-10을 두 칸 두 줄로(HomeHub v2.2). H-02·H-03은 없앰.
// 본문 맨 위 띠(해제 대기, 공지, 메일 반송)는 하나만(core pickTopBanner). 상대가 바꾸면 Realtime으로 바로 다시 읽음.

type Box = Extract<AnalyticsEvent, { name: 'home_box_tapped' }>['props']['box'];

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
  const today = todayKst();
  // 경조사·자산(만기)·해제 기록·온보딩 끝난 날은 frame 재료(19 띠 14번, H-08)
  const h = useHomeInput();
  const sp = space.data;
  const joint = sp?.salary_mode === 'joint';
  const joined = sp?.couple_state === 'connected' || sp?.couple_state === 'unlink_pending';
  const solo = sp?.couple_state === 'solo';
  const paydayNone = !!me.data?.payday_none;
  const bundles = useBundles(!!sp && !joint);
  const tasks = useHomeTasks();
  const period = useMoneyInPeriod(today, paydayNone);
  const modeReq = useModeRequest(joined);
  const rankReq = useRankRequest(joined);
  const accounts = useSharedAccounts(joined);
  const changes = useSalaryChanges();
  // 월급날 앞당기기(07 1장): 첫 월급날·늦은 확인 마지막 날도 W-02와 같은 날(2026-11-14 R3)
  const shownPayday = useShownPayday();
  const notes = useUpcomingNotes(today, addDays(today, 365));
  const exName = useQuery({
    queryKey: qk.unlinkPartner,
    queryFn: fetchUnlinkPartnerName,
    enabled: solo && !!h.input?.reconnectFrom,
  });
  // 공지 띠(AD-10), 메일 반송, 순위 배지
  const notice = useNoticeBand();
  const bounced = useQuery({ queryKey: qk.mailBounced, queryFn: fetchMailBounced });
  const rank = useRank();
  // 띠 10번 알림 다시 묻기: 이 기기 알림이 아직 묻기 전(‘나중에 할게요’)일 때만(브라우저는 브리지가 없어 없음)
  const [pushPrompt, setPushPrompt] = useState(false);
  useEffect(() => {
    let on = true;
    void window.sweetwo?.push
      ?.status()
      .then((s) => on && setPushPrompt(s === 'prompt'))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);
  useSplitRealtime(sp?.id);
  useCheckRealtime(sp?.id);
  useGoalRealtime(sp?.id);
  useAssetRealtime(sp?.id);
  useHomeRealtime(sp?.id);

  const meId = me.data?.id;
  const list = myChecklist(lists.data, meId);
  const prev = usePreviousChecklist(
    list ? list.owner_user_id : undefined,
    list?.cycle_start ?? null,
  );
  // 대표 저금(core pickHeroes): 묶음(달성 전) → 같이 계열 공동 → 내 것(목표 금액에 가까운 순) → 목표 금액 없는 것
  const heroGoals: HeroGoal[] = saving.ready
    ? saving.live.map((i) => ({
        id: i.goal.id,
        name: i.goal.name,
        status: i.goal.status,
        closed_at: i.goal.closed_at,
        deleted_at: i.goal.deleted_at,
        owner_user_id: i.goal.owner_user_id,
        bundle_id: i.goal.bundle_id,
        target_amount: i.target,
        deadline: i.goal.deadline,
        saved: i.saved,
      }))
    : [];
  const heroes =
    meId && sp
      ? pickHeroes({
          meId,
          joint,
          goals: heroGoals,
          bundles: (bundles.data ?? []) as BundleView[],
        })
      : [];
  const heroIds = heroes.flatMap((x) =>
    x.kind === 'bundle' ? x.bundle.goals.map((g) => g.id) : [x.goal.id],
  );
  const moves = useHeroMoves(heroIds);
  const first = heroes[0];
  const engaged = sp?.marriage_status === 'engaged';
  const heroNotes = useHeroNotes(
    engaged && first
      ? first.kind === 'bundle'
        ? { bundleId: first.bundle.id }
        : { goalId: first.goal.id }
      : null,
  );

  // 홈 화면 위젯(26 v2.2): H-10 첫 칸과 H-08 다가오는 날을 금액 없이 브리지로(모바일 앱만, 값이 바뀔 때만)
  useWidgetSync(!!meId && !!sp && saving.ready && !bundles.isLoading && !!notes.data && !!h.input, {
    save: widgetSave({
      hero: first,
      savedOf: (id) => (saving.ready ? (saving.byId(id)?.saved ?? 0) : 0),
    }),
    next: widgetNext({
      today,
      care: (h.input ? homeUpcoming(h.input, 365) : []).find((u) => u.kind === 'care'),
      note: (notes.data ?? []).find((n) => !n.paid && n.due_on),
    }),
  });

  // 처음 받을 때만 기다림(다시 받는 동안은 홈을 그대로, S4-01)
  const listsFirstLoad = lists.isLoading && lists.errorUpdateCount === 0;
  // 모은 금액·묶음 합계도 처음 받을 때까지 기다림(2026-11-14 R7: 먼저 0원·옛 숫자를 2초쯤 보였다가 바뀌었음)
  const sumsFirstLoad = (saving.ready && saving.savedLoading) || bundles.isLoading;
  if (!me.data || !sp || !goals.data || listsFirstLoad || sumsFirstLoad)
    return <LoadingFrame current="month" />;

  // 연결 해제 확정 뒤 처음 열면 해제 안내(25 S-12h)
  if (me.data.onboarding_step === 'S-12H')
    return <Navigate to="/settings/couple/unlinked" replace />;
  // 합류했는데 시작한 사람이 아직 온보딩 중(18, 상태 변형 v2.2 ‘시작한 사람을 기다림’): 월급 계획이 생기면 P-04, 그 전엔 대기
  if (me.data.onboarding_step === 'P-WAIT') {
    if (splits.isLoading) return <LoadingFrame current="month" />;
    // 줄이 있는 월급 계획만(관리 형태를 고를 때 생긴 빈 공동 월급 계획은 아직 없는 것, 2026-11-13 PR 8)
    if (splits.data?.some((x) => x.split_line.length)) return <Navigate to="/join/p-04" replace />;
    const starter = partner.data?.nickname ?? sp.partner_nickname ?? '';
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
            {/* 2026-11-13 v2.2 ‘알려 주기’(시작한 사람에게 알림, 24시간에 1번) */}
            <WaitNudge starter={starter} />
          </section>,
        ]}
      />
    );
  }

  const myId = me.data.id;
  const m = (v: number) => money(v, masked);
  const go = (box: Box, to: string) => {
    track('home_box_tapped', { box });
    nav(to);
  };
  const partnerName = partner.data?.nickname ?? sp.partner_nickname ?? '';
  const myName = me.data.nickname ?? '';
  const marriage = (sp.marriage_status ?? null) as MarriageStatus | null;
  const base = baseDayOf(me.data, sp);
  const mySplit = (splits.data ?? []).find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === myId,
  );
  const closed = tasks.data ?? [];

  // ── H-11 이번 달 한 줄(core pickMonthLine) ──
  const noSalary = joint
    ? !me.data.monthly_income && !partner.data?.monthly_income
    : !me.data.monthly_income;
  const firstPayday = list ? null : firstPaydayOf(mySplit, base, today, shownPayday);
  const nonManager = joint && !!sp.manager_user_id && sp.manager_user_id !== myId;
  // 내가 확인을 맡은 손 줄만 셈(한 사람 관리형·합쳐서 남의 용돈 줄 빼고, core lineIsMine = 서버 pay_line_mine)
  const mineOnly = <
    T extends { state: string; auto: boolean; kind: string; user_id: string | null },
  >(
    ls: T[],
  ) =>
    ls.filter(
      (l) =>
        l.auto ||
        lineIsMine(l, {
          joint,
          ownerId: list?.owner_user_id ?? null,
          meId: myId,
          managerId: sp.manager_user_id,
        }),
    );
  const monthLine = pickMonthLine({
    today,
    shift: shownPayday,
    error: lists.isError && !lists.data,
    noSalary,
    paydayNone,
    nonManager,
    period: period.data ?? null,
    current: list
      ? {
          id: list.id,
          cycle_start: list.cycle_start,
          cycle_end: list.cycle_end,
          lines: mineOnly(list.pay_check_line),
        }
      : null,
    previous: prev.data
      ? {
          id: prev.data.id,
          cycle_start: prev.data.cycle_start,
          cycle_end: prev.data.cycle_end,
          // 늦은 확인은 닫을 때 서버가 건너뜀으로 바꾼 줄만(checked_by 없음). 사람이 직접 건너뛴 줄은 빼고 셈(confirm_payday와 같음)
          lines: mineOnly(
            prev.data.pay_check_line.filter((l) => !(l.state === 'skipped' && l.checked_by)),
          ),
        }
      : null,
    base,
    firstPayday,
  });

  // ── H-06 할 일 띠(core pickTopTask 16순서) ──
  const splitLines = mySplit?.split_line ?? [];
  const live = saving.ready ? saving.live : [];
  const mine = live.filter((i) => (joint ? true : i.owner !== 'partner'));
  const activeBundles = (bundles.data ?? []).filter((b) => b.status === 'active');
  const proposal = (accounts.data ?? []).find(
    (a) => a.status === 'proposed' && a.proposed_by !== myId,
  );
  const firstSavingOn =
    mine
      .map((i) => kstDateOf(i.goal.created_at))
      .sort()
      .find(Boolean) ?? null;
  // 띠 10번 기간: 다가오는 월급날 3일 전 ~ 당일(날짜 없음은 온보딩 7일 뒤부터, core pushReaskOpen)
  const nextPayday = list
    ? today === list.cycle_start
      ? list.cycle_start
      : addDays(list.cycle_end, 1)
    : (firstPayday ?? null);
  // 상대 저금 같이 모으기 권유(띠 13). 내 저금이 0개면 띠 대신 H-10 빈 상태가 한 번만 보여 줌(2026-11-14 R4)
  const inviteGoal =
    mine.length + activeBundles.length === 0
      ? bundleInviteGoal({
          joint,
          coupleState: sp.couple_state,
          today,
          partnerGoals: live
            .filter((i) => i.owner === 'partner')
            .map((i) => ({
              id: i.goal.id,
              name: i.goal.name,
              created_at: i.goal.created_at,
              bundle_id: i.goal.bundle_id,
            })),
        })
      : null;
  const tasks0: TopTask[] = h.input
    ? pickTopTasks({
        today,
        now: new Date().toISOString(),
        meId: myId,
        coupleState: sp.couple_state,
        joint,
        unlinkRequestedBy: h.input.unlinkRequestedBy,
        reconnectFrom: h.input.reconnectFrom,
        modeRequest: modeReq.data
          ? {
              id: modeReq.data.id,
              from: modeReq.data.from_user,
              status: modeReq.data.status,
              expires_at: modeReq.data.expires_at,
              phrase: modeReq.data.phrase,
            }
          : null,
        splitProposal: proposal
          ? {
              id: proposal.id,
              from: proposal.proposed_by,
              status: 'open',
              expires_at: proposal.expires_at,
              name: proposal.name,
            }
          : null,
        rankRequest: rankReq.data
          ? {
              id: rankReq.data.id,
              from: rankReq.data.from_user,
              status: rankReq.data.status,
              expires_at: rankReq.data.expires_at,
            }
          : null,
        // 한 사람 관리형 관리하지 않는 쪽은 ‘보내기’가 서버에서 다시 계산돼 맞출 게 없음(2026-11-13 UX B M5)
        salaryChanged: nonManager
          ? null
          : { appliedDay: salaryChangedDay(changes.data, myId, base), done: false },
        onboardedOn: h.input.onboardedOn,
        savingCount: mine.length + activeBundles.length,
        sharedLiving: sp.shared_living,
        hasSplit: (accounts.data ?? []).some((a) => a.status === 'accepted'),
        closedKeys: closed,
        autoPickOpen: autoPickTaskOpen({
          today,
          firstPayday,
          autoLines: splitLines.filter((l) => l.auto_pay).length,
          manualLines: splitLines.filter((l) => l.in_checklist && !l.auto_pay).length,
          done: closed.includes('auto_pick'),
        }),
        pushReask:
          pushPrompt &&
          !!me.data.onboarding_done_at &&
          pushReaskOpen({
            today,
            nextPayday,
            paydayNone,
            onboardedOn: h.input.onboardedOn ?? null,
          }),
        paydayNone,
        deadlineGoals: mine
          .filter((i) => i.owner !== 'partner')
          .map((i) => ({
            id: i.goal.id,
            name: i.goal.name,
            status: i.goal.status,
            closed_at: i.goal.closed_at,
            target_amount: i.target,
            deadline: i.goal.deadline,
            saved: i.saved,
          })),
        reconcile: reconcileTask({
          today,
          // 맞춰 볼 돈이 있는 저금만(모은 금액 0원뿐이면 띠 없음, 2026-11-14 R7)
          hasSaving: mine.some((i) => i.canEdit && i.saved > 0),
          lastReconciledOn: me.data.last_reconciled_at
            ? kstDateOf(me.data.last_reconciled_at)
            : null,
          firstSavingOn,
        }),
        partnerGoals: live
          .filter((i) => i.owner === 'partner')
          .map((i) => ({
            id: i.goal.id,
            name: i.goal.name,
            created_at: i.goal.created_at,
            bundle_id: i.goal.bundle_id,
          })),
        assets: h.input.assets,
        cares: h.input.cares,
        notes: notes.data ?? [],
        // 16 기다리는 합류자(18 v2.2, PR 8): 같이 계열에 상대가 합류했는데 공동 월급 계획에 줄이 없음(상대는 대기 화면)
        waitingJoiner:
          joint && sp.couple_state === 'connected' && splitLines.length === 0
            ? { name: partner.data?.nickname ?? null }
            : null,
      })
    : [];
  // 해제 대기 띠가 있으면 같은 할 일(1번)은 빼고 맨 위 띠만. 띠는 두 칸까지(core pickTopTasks)
  const shownTasks = tasks0.filter((x) => !(x.kind === 'unlink' && h.unlink));
  const taskText = (x: TopTask): string => {
    switch (x.kind) {
      case 'unlink':
        return homeText.todoUnlink(partnerName);
      case 'reconnect':
        return copy.taskReconnect(exName.data ?? '');
      case 'mode_request':
        return x.phrase === 'p04_send'
          ? copy.taskModeSend(partnerName, myName)
          : x.phrase === 's11f_manager'
            ? copy.taskModeManager(partnerName, myName)
            : copy.taskModeCombine(partnerName);
      case 'split_request':
        return copy.taskSplit(partnerName, x.name);
      case 'rank_request':
        return copy.taskRank(partnerName);
      case 'salary_changed':
        return copy.taskSalaryChanged;
      case 'first_saving':
        return copy.taskFirstSaving;
      case 'split_suggest':
        return copy.taskSplitSuggest;
      case 'auto_pick':
        return copy.taskAutoPick;
      case 'push_reask':
        return x.paydayNone ? copy.taskPushNoDate : copy.taskPush;
      case 'next_saving':
        return copy.taskNextSaving(x.name);
      case 'reconcile':
        return copy.taskReconcile;
      case 'bundle_invite':
        return copy.taskBundle(partnerName, x.name);
      case 'matured':
        return homeText.todoMatured(x.asset);
      case 'care':
      case 'note':
        return homeText.todoCare(formatMonthDay(x.date), x.name);
      case 'invite':
        return copy.taskInvite;
      case 'waiting_joiner':
        return copy.taskWaiting(x.name);
    }
  };
  const tapTask = async (x: TopTask) => {
    track('home_box_tapped', { box: 'band', todo: x.kind });
    if (x.kind !== 'push_reask') return nav(x.to);
    // 10번: OS 허용 창(1회). 답과 상관없이 띠는 끝냄
    track('push_permission_asked', { screen_id: 'H-06' });
    const push = window.sweetwo?.push;
    const ok = push ? await push.request().catch(() => false) : false;
    // 32 0-4: 브리지 없음 unavailable, kinds_on = 켠 알림 종류 키(허용했을 때만)
    const kinds = (me.data?.push_kinds ?? {}) as Record<string, boolean>;
    track('push_permission_answered', {
      screen_id: 'H-06',
      result: !push ? 'unavailable' : ok ? 'granted' : 'denied',
      kinds_on: ok ? PUSH_KINDS.filter((k) => pushKindOn(kinds, k)) : [],
    });
    setPushPrompt(false);
    await dismissHomeTask(x.key, 'done').catch(() => undefined);
    void qc.invalidateQueries({ queryKey: qk.homeTasks });
  };
  const closeTask = async (x: TopTask) => {
    try {
      await dismissHomeTask(x.key);
      track('home_task_dismissed', { task_key: x.key });
      await qc.invalidateQueries({ queryKey: qk.homeTasks });
    } catch {
      toast(sharedCopy.errorTitle);
    }
  };
  const todoBands = shownTasks.map((t) => (
    <HubBand
      key={t.key}
      text={taskText(t)}
      go={
        t.kind === 'invite'
          ? copy.inviteNow
          : t.kind === 'split_suggest'
            ? copy.taskSplitGo
            : undefined
      }
      onClick={() => void tapTask(t)}
      secondary={
        t.kind === 'split_suggest'
          ? { text: copy.taskSplitDone, onClick: () => void closeTask(t) }
          : undefined
      }
    />
  ));

  // ── 맨 위 띠(하나만, core pickTopBanner) ──
  const top = pickTopBanner({
    unlink: !!h.unlink,
    must_notice: !!notice?.must,
    mail_bounced: !!bounced.data,
    notice: !!notice && !notice.must,
  });
  const unlinkBand = h.unlink ? (
    <LineBand
      icon="link"
      title={h.unlink.mine ? copy.unlinkWait : copy.unlinkRequested(partnerName)}
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

  // ── H-10 같이 모으기 ──
  const people = (
    <span className="hg-avatars" aria-hidden="true">
      {(() => {
        const starter = sp.created_by;
        const meDot = <PersonDot key="me" name={myName} starter={starter === myId} userId={myId} />;
        // 미합류면 내 Avatar 하나(빈 원 없음)
        if (!joined || !partner.data) return meDot;
        const pDot = (
          <PersonDot
            key="p"
            name={partner.data.nickname ?? ''}
            starter={starter === partner.data.id}
            userId={partner.data.id}
          />
        );
        return starter === myId ? [meDot, pDot] : [pDot, meDot];
      })()}
    </span>
  );
  const peopleMine = (
    <span className="hg-avatars" aria-hidden="true">
      <PersonDot name={myName} starter={sp.created_by === myId} userId={myId} />
    </span>
  );
  // H-09·H-10 개수와 합: 묶인 저금은 묶음 하나로(core savingsTotal, 2026-11-14 M1)
  const sums = savingsTotal(
    live.map((i) => ({ id: i.goal.id, saved: i.saved, bundle_id: i.goal.bundle_id })),
    bundles.data ?? [],
  );
  const monthFrom = list?.cycle_start ?? `${today.slice(0, 7)}-01`;
  const monthTo = list?.cycle_end ?? today;
  const heroFailed = (saving.ready === false && saving.failed) || bundles.isError;
  const hero = heroFailed ? (
    <section className="hg-card hg-card--fill hg-stack hg-hub__wide" role="status">
      <p className="hg-card__title">{sharedCopy.errorTitle}</p>
      <p className="hg-card__meta">{sharedCopy.errorBody}</p>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          track('home_box_tapped', { box: 'retry' });
          void qc.invalidateQueries({ queryKey: qk.goals });
          void qc.invalidateQueries({ queryKey: qk.bundles });
        }}
      >
        {sharedCopy.retry}
      </button>
    </section>
  ) : (
    <H10SaveTogether
      heroes={heroes}
      savedOf={(id) => (saving.ready ? (saving.byId(id)?.saved ?? 0) : 0)}
      people={people}
      peopleMine={peopleMine}
      joint={joint}
      names={{ me: myName, partner: partnerName }}
      marriage={marriage}
      weddingDate={sp.wedding_date}
      today={today}
      month={{
        from: monthFrom,
        to: monthTo,
        lines: (lists.data ?? []).flatMap((c) => c.pay_check_line),
      }}
      moves={moves.moves}
      savingCount={sums.count}
      invite={inviteGoal}
      go={(box, to) => go(box, to)}
    />
  );

  // ── H-07 월급 계획 타일: 매달 며칠 + 여유 자금 ──
  const dayOf = (u: { payday: number | null; payday_last: boolean }) =>
    u.payday_last ? copy.paydayLast : u.payday ? copy.payday(u.payday) : null;
  const jointDay = sp.joint_cycle_day;
  const planDay = paydayNone
    ? copy.noPaydayTile
    : joint && jointDay !== null
      ? copy.everyMonth(jointDay >= 31 ? copy.paydayLast : copy.payday(jointDay))
      : dayOf(me.data)
        ? copy.everyMonth(dayOf(me.data) ?? '')
        : undefined;
  const income = joint
    ? (me.data.monthly_income ?? 0) + (partner.data?.monthly_income ?? 0)
    : (me.data.monthly_income ?? 0);
  const left = mySplit ? leftover(income, mySplit.split_line) : null;
  const leftText =
    left === null ? undefined : left >= 0 ? copy.leftover(m(left)) : copy.short(m(-left));

  // ── H-08 캘린더 타일: 가장 가까운 경조사 또는 쓸 곳 메모 날짜 ──
  const care = (h.input ? homeUpcoming(h.input, 365) : []).find((u) => u.kind === 'care');
  const note = (notes.data ?? []).find((n) => !n.paid && n.due_on);
  const careDate = care ? addDays(today, care.dday) : null;
  const near =
    note?.due_on && (!careDate || note.due_on < careDate)
      ? { name: note.name, dday: daysBetween(today, note.due_on) }
      : care
        ? { name: care.name, dday: care.dday }
        : null;

  // ── H-04 자산 관리(순위 배지는 ‘홈에 보여 주기’를 켰을 때만, 2026-11-13 기본 끔), H-09 저금 ──
  // 2026-11-13 H-04 배지는 (가) + ‘홈에 보여 주기’를 켰을 때만(기본 끔, 23 F-08 v2.2, frame useRank)
  const rankPct = rank?.homeBadge ?? null;

  return (
    <MainFrame
      current="month"
      tone="alt"
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
            <H11MonthLine
              line={monthLine}
              go={(to) => go('month_line', to)}
              onRetry={() => {
                track('home_box_tapped', { box: 'retry' });
                void qc.invalidateQueries({ queryKey: ['pay_checklist'] });
                void qc.invalidateQueries({ queryKey: qk.splits });
              }}
            />
            {todoBands}
            <HubTile
              title={copy.planTile}
              sub={planDay}
              sub2={leftText}
              art
              point
              onClick={() => go('plan', '/salary?view=plan')}
            />
            <HubTile
              title={copy.calendarTile}
              sub={near ? `${near.name} ${copy.ddayShort(near.dday)}` : copy.noCare}
              art
              onClick={() => go('calendar', '/calendar')}
            />
            {engaged && (
              <H12Wedding
                notes={heroNotes.data ?? []}
                today={today}
                onClick={() =>
                  go(
                    'wedding',
                    first?.kind === 'bundle'
                      ? `/salary/bundles/${first.bundle.id}/notes`
                      : first
                        ? `/salary/items/${first.goal.id}/notes`
                        : '/salary/items/new/a?from=home',
                  )
                }
              />
            )}
            <HubTile
              small
              title={copy.assetsTile}
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
              onClick={() => go('assets', lastAssetsTab())}
            />
            <HubTile
              small
              title={copy.savingsTile}
              sub={sums.count ? copy.savingCount(sums.count) : copy.noSavings}
              value={sums.count ? m(sums.total) : undefined}
              onClick={() => go('savings', '/salary/items?from=home')}
            />
          </Hub>
        </div>,
      ]}
    />
  );
}
