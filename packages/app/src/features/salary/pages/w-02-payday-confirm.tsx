import {
  checkPayLine,
  confirmPayday,
  ConfirmBlocked,
  fetchMoneyInPeriod,
  fetchPastChecklists,
  qk,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import {
  chipCounts,
  confirmableLines,
  doneState,
  heroMeta,
  plannedSum,
  savedSum,
  type CheckChip,
  confirmFinish,
  isManual,
  splitCheckLines,
  kstDateOf,
  lineIsMine,
  todayKst,
} from '@sweetwo/core';
import {
  BottomSheet,
  Button,
  Chip,
  Icon,
  Illustration,
  PageHeader,
  SectionHeader,
  Tabs,
  TransferRow,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { money, useMask } from '../../../shared/mask';
import { useFlip } from '../../../shared/flip';
import { PersonDot } from '../../../shared/person';
import { quietly, toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { CheckLine, checkToast, goalLineName, isPast, lineName } from '../check-line';
import { copy } from '../copy';
import { baseDayOf, cycleName, firstPaydayOf, useShownPayday } from '../cycle';
import {
  markLocalState,
  markLocalWrite,
  refreshChecks,
  useAccountNames,
  useChangedLines,
  useCheck,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  useSplits,
} from '../data';
import { incomeOf, MonthHero, ShareLink } from '../month-parts';
import { salaryPaths, savingListPath, savingPaths, togetherPaths } from '../paths';
import { MoneyInLine, MoneyInRows } from '../money-in-rows';
import { PeriodLine } from '../period-line';
import { SalaryLoadError, SalaryLoading, useSalaryTitle } from '../salary-tab';
import { useSavingItems } from '../saving';
import { AchieveWatch, SavingGoalRow } from '../saving-parts';
import { LastMonthNote, lateLines, lateOpen } from './w-02-last-month';
import { W02aOtherAmount } from './w-02a-other-amount';

// W-02 월급날 확인(20 ‘월급 탭 v2.2’ W-02, ADR 0009 결정 2) = 월급 탭 첫 화면 ‘이번 달’.
// 제목 “11월 25일 월급” + 기간 + 진행 막대 → 접힌 묶음 “자동으로 나가는 것 n개”(펼치면 “자동 26일” / “자동 확인”)
// → “확인할 것 n개”(손 줄, 저금·지출 묶음 카드) → 주 버튼 “모두 계획대로 됐어요”(confirm_payday, 손 줄이 남았을 때만).
// 줄 시트: ‘계획대로 했어요’ / ‘다른 금액으로 했어요’(W-02a) / “이번 달은 건너뛸게요” + 저금은 ‘저금 보기’. 자동 줄도 같은 시트.
// ‹ › 지난 달(늦은 확인은 다음 사이클 끝까지, w-02-last-month). `?cycle=id`·`?cycle=last`면 그 지난 달.
// 각자 + 연결이면 사람 탭(파트너 탭은 보기만). 첫 확인 목록 전(소급 없음)은 “11월 25일 첫 월급날에 확인해요”,
// 날짜 없는 사람은 확인 목록 없이 H-13 기간 한 줄 + 저금 목록.
export function W02PaydayConfirm() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const [who, setWho] = useState<string | null>(() => params.get('who'));
  const [ago, setAgo] = useState(0);
  const [hidden, setHidden] = useState<string | null>(null);
  const [madeHidden, setMadeHidden] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chip, setChip] = useState<CheckChip>('all');
  const [foldOpen, setFoldOpen] = useState(false);
  const [pickDate, setPickDate] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const cycleParam = params.get('cycle');
  // W-21 지난 달 모아보기에서 열었으면(2026-11-17): 머리는 ‹ 지난 달 모아보기(뒤로 = 모아보기), 구간 탭 없음
  const fromArchive = (loc.state as { from?: string } | null)?.from === 'archive';
  const title = useSalaryTitle('month');
  const splits = useSplits();
  const accountNames = useAccountNames();
  const shownPayday = useShownPayday();
  const saving = useSavingItems();
  const { masked } = useMask();
  const check = useCheck('w02');
  const today = todayKst();
  const paydayNone = !!me.data?.payday_none;
  const period = useQuery({
    queryKey: qk.moneyInPeriod(today),
    queryFn: () => fetchMoneyInPeriod(today),
    enabled: paydayNone,
  });

  const meId = me.data?.id;
  const joint = space.data?.salary_mode === 'joint';
  const all = lists.data ?? [];
  const tab = who ?? (joint ? 'joint' : (meId ?? ''));
  const list: PayChecklist | undefined = all.find((c) =>
    tab === 'joint' ? c.owner_user_id === null : c.owner_user_id === tab,
  );
  const owner = tab === 'joint' ? null : tab;
  const past = useQuery({
    queryKey: qk.pastChecklists(owner, list?.cycle_start ?? today),
    queryFn: () => fetchPastChecklists(owner, list?.cycle_start ?? today),
    enabled: !!list,
  });

  // `?cycle=`(W-05 기간 밖·끝난 사이클, 홈 H-11 늦은 확인 `last`): 그 지난 달을 한 번 열고 주소에서 뺌
  const opened = useRef(false);
  useEffect(() => {
    if (!cycleParam || opened.current || !past.data) return;
    opened.current = true;
    const i = cycleParam === 'last' ? 0 : past.data.findIndex((c) => c.id === cycleParam);
    if (i >= 0 && past.data.length > i) setAgo(i + 1);
    const next = new URLSearchParams(params);
    next.delete('cycle');
    setParams(next, { replace: true, state: loc.state });
  }, [cycleParam, past.data, params, setParams, loc.state]);
  const changed = useChangedLines(ago === 0 ? list?.pay_check_line : undefined);

  useFlip(listRef, [
    (lists.data ?? []).flatMap((c) => c.pay_check_line.map((l) => l.id + l.state)).join(),
  ]);
  const loads = [me, space, goals, lists];
  if (loads.some((q) => q.isError && !q.data))
    return (
      <SalaryLoadError
        value="month"
        onRetry={() => {
          for (const q of loads) if (!q.data) void q.refetch();
        }}
      />
    );
  if (!me.data || !space.data || !goals.data || lists.isLoading)
    return <SalaryLoading value="month" />;
  const sp = space.data;
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const goalName = goalLineName(goals.data, personName, joint);

  // W-02a 다른 금액(기록 상태 other). 체크 안 한 줄·건너뛴 줄, 자동 줄은 자동 확인 뒤에도(20 W-02 5번)
  const shownList = ago > 0 ? (past.data?.[ago - 1] ?? list) : list;
  const otherId = (loc.state as { other?: string } | null)?.other;
  const other = otherId
    ? shownList?.pay_check_line.find((l) => l.id === otherId && (l.state !== 'checked' || l.auto))
    : undefined;
  if (other)
    return (
      <W02aOtherAmount
        line={other}
        name={lineName(
          other,
          goalName,
          personName,
          joint,
          accountNames.ofSplitLine(other.split_line_id),
        )}
        goalName={other.kind === 'saving' ? goalName(other.goal_id) : undefined}
        personName={personName}
        entry="w02"
        onClose={() => nav(-1)}
      />
    );

  const pending = sp.couple_state === 'unlink_pending';
  const kindText = (kind: string) => (kind === 'saving' ? copy.kindSaving : copy.kindSpend);
  const page = { title };
  const frame = (body: ReactNode) => (
    <MainFrame
      current="salary"
      sub={fromArchive ? 'detail' : undefined}
      page={fromArchive ? undefined : page}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          {fromArchive ? (
            <PageHeader
              title={copy.tabTitle}
              backLabel={copy.back}
              backTo={copy.archiveTitle}
              onBack={() => nav(-1)}
            />
          ) : null}
          {body}
        </div>,
      ]}
    />
  );
  const base = baseDayOf(me.data, sp);
  const mySplit = (splits.data ?? []).find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === meId,
  );
  // 날짜 없는 사람(07 6장): 확인 목록 없이 H-13 기간 한 줄 + 저금 목록(내 것)
  if (paydayNone && !joint && !list) {
    const mine = saving.ready ? saving.live.filter((i) => i.owner !== 'partner') : [];
    return frame(
      <>
        {period.data && <PeriodLine period={period.data} onGo={() => nav(togetherPaths.moneyIn)} />}
        {meId && (
          <MoneyInRows
            meId={meId}
            from={period.data?.start ?? `${today.slice(0, 8)}01`}
            to={today}
            masked={masked}
            onOpen={() => nav(togetherPaths.moneyInList)}
          />
        )}
        <section className="hg-checkgroup" aria-label={copy.savingGroup}>
          <SectionHeader
            variant="group"
            title={copy.savingGroup}
            onTitle={() => nav(savingListPath('checklist'), { state: { from: 'month' } })}
            titleLabel={copy.listOpen}
          />
          {mine.map((i) => (
            <SavingGoalRow
              key={i.goal.id}
              item={i}
              masked={masked}
              onClick={() => nav(savingPaths.item(i.goal.id))}
            />
          ))}
        </section>
      </>,
    );
  }
  if (!list) {
    // 첫 확인 목록 전(소급 없음, 07 3-1): 월급 계획이 있으면 “11월 25일 첫 월급날에 확인해요” + 월급 계획 보기
    const firstDay = mySplit ? firstPaydayOf(mySplit, base, today, shownPayday) : null;
    // 월급날에 볼 줄 미리 보기(20 W-02 0a, 2026-11-15 3차 검토): 확인 목록에 들어갈 줄을 회색으로, 누를 수 없음
    const preview = (mySplit?.split_line ?? []).filter((l) => l.in_checklist && l.amount > 0);
    const previewName = (l: (typeof preview)[number]) =>
      lineName(
        { kind: l.kind, goal_id: l.goal_id, user_id: l.user_id, name: l.name },
        goalName,
        personName,
        joint,
        accountNames.ofSplitLine(l.id),
      );
    // 2026-11-19 확정 시안: 날짜 알약 → 큰 금액(계획 합) → “D-6, 5개” → 한 목록(상태 버튼 “25일” 비활성, 템플릿 순서) → 수입 상자
    const ordered = [...preview].sort((x, y) => x.sort - y.sort);
    const dayTag = firstDay ? copy.dayTag(Number(firstDay.slice(8, 10))) : copy.goTag;
    return frame(
      <>
        <MonthHero
          pill={
            <span className="hg-datepill">
              {firstDay ? cycleName(firstDay) : copy.firstWaitNoDate}
            </span>
          }
          // 줄이 하나도 없으면(월급 0원 포함) 큰 금액 “0원”과 보조 줄 없이 아래 한 줄(2026-11-19 사용자 결정)
          amount={
            ordered.length > 0
              ? money(
                  ordered.reduce((sum, l) => sum + l.amount, 0),
                  masked,
                )
              : undefined
          }
          meta={
            firstDay && ordered.length > 0
              ? heroMeta({ preview: { today, payday: firstDay, count: ordered.length } })
              : undefined
          }
        />
        {ordered.length === 0 && (
          <section className="hg-card hg-card--fill hg-stack">
            <p className="hg-card__meta">{copy.emptyPlan}</p>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => nav(salaryPaths.plan, { state: { from: 'month' } })}
            >
              {copy.goPlan}
            </button>
          </section>
        )}
        {preview.length > 0 && (
          <div className="hg-checklist__list hg-list--preview">
            {ordered.map((l) => (
              <TransferRow
                key={l.id}
                label={previewName(l)}
                meta={l.auto_pay ? copy.previewAuto : kindText(l.kind)}
                amount={money(l.amount, masked)}
                done={false}
                checkLabel={copy.previewCheck(previewName(l))}
                action={{
                  label: dayTag,
                  tone: 'wait',
                  ariaLabel: copy.previewCheck(previewName(l)),
                  disabled: true,
                }}
              />
            ))}
          </div>
        )}
        {meId && (
          <MoneyInLine
            meId={meId}
            from={`${today.slice(0, 8)}01`}
            to={today}
            masked={masked}
            onOpen={() => nav(togetherPaths.moneyInList)}
            onAdd={pending ? undefined : () => nav(togetherPaths.moneyIn)}
          />
        )}
      </>,
    );
  }

  const people =
    !joint && sp.couple_state === 'connected' && partner.data
      ? [me.data, partner.data].map((x) => ({
          value: x.id,
          label: x.nickname ?? '',
          lead: (
            <PersonDot name={x.nickname ?? ''} starter={x.id === sp.created_by} userId={x.id} />
          ),
        }))
      : null;
  const shown = shownList ?? list;
  const ordered = [...shown.pay_check_line].sort((a, b) => a.sort - b.sort);
  const partnerTab = !joint && tab !== meId;
  const late = ago > 0 && lateOpen(shown, today, base, shownPayday);
  // 지난 달은 읽기 전용, 늦은 확인 기간이면 남은 손 줄만 체크(07 4장)
  const readOnly = (ago > 0 || isPast(shown.cycle_end)) && !late;
  const lateIds = late ? new Set(lateLines(shown).map((l) => l.id)) : null;
  // 제목과 기간 첫날은 같은 날(앞당기기 설정대로, 07 1장, 2026-11-13 UX B M2)
  const start = shownPayday(shown.cycle_start);
  // 상대가 이번 사이클에 월급 계획을 바꿨으면 안내(20 ‘바뀐 직후 W-02 맨 위 안내 한 줄’)
  const split = (splits.data ?? []).find((x) => x.owner_user_id === owner);
  const changedBy =
    ago === 0 &&
    split?.updated_by &&
    split.updated_by !== meId &&
    kstDateOf(split.updated_at) >= list.cycle_start
      ? personName(split.updated_by)
      : null;
  const noticeKey = split ? `sweetwo.split-notice.${split.id}` : '';
  const dismissed = (() => {
    if (hidden === split?.updated_at) return true;
    try {
      return localStorage.getItem(noticeKey) === split?.updated_at;
    } catch {
      return false;
    }
  })();
  const dismiss = () => {
    setHidden(split?.updated_at ?? null);
    try {
      localStorage.setItem(noticeKey, split?.updated_at ?? '');
    } catch {
      /* 저장 못 해도 이번 화면에서는 숨김 */
    }
  };
  // 새 사이클 첫 화면 한 줄 “11월 계획대로 체크리스트를 만들었어요”(2026-11-09): 지난 체크리스트가 있을 때(첫 달 아님),
  // 이번 달 내(합쳐서면 공동) 탭, ×로 닫으면 그 체크리스트에서는 다시 안 보임(기기마다)
  const madeKey = `sweetwo.made-notice.${list.id}`;
  const madeSeen = (() => {
    if (madeHidden === list.id) return true;
    try {
      return localStorage.getItem(madeKey) === '1';
    } catch {
      return false;
    }
  })();
  const showMade = ago === 0 && !partnerTab && (past.data?.length ?? 0) > 0 && !madeSeen;
  const dismissMade = () => {
    setMadeHidden(list.id);
    try {
      localStorage.setItem(madeKey, '1');
    } catch {
      /* 저장 못 해도 이번 화면에서는 숨김 */
    }
  };
  const income = incomeOf(owner, me.data, partner.data);
  const ownerPeople = (
    owner === null ? [me.data, partner.data] : [owner === meId ? me.data : partner.data]
  )
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ id: x.id, name: x.nickname ?? '', starter: x.id === sp.created_by }));
  const itemOf = (id: string | null) => (saving.ready && id ? saving.byId(id) : undefined);
  const nameOf = (l: PayCheckLine) =>
    lineName(l, goalName, personName, joint, accountNames.ofSplitLine(l.split_line_id));

  // 줄 하나 건너뛰기(“이번 달은 건너뛸게요”) + Toast 되돌리기
  const skip = (l: PayCheckLine) => {
    const from = l.state as 'checked' | 'wait' | 'skipped';
    void check(l, 'skipped')
      .then((res) =>
        checkToast(res, {
          line: l,
          name: nameOf(l),
          amount: '',
          to: 'skipped',
          personName,
          undo: () => quietly(check(l, from, undefined, 'toast')),
        }),
      )
      .catch(() => toast(copy.failed));
  };
  const row = (l: PayCheckLine) => {
    const lineOpen = !readOnly && (!lateIds || lateIds.has(l.id));
    return (
      <CheckLine
        key={l.id}
        line={l}
        name={nameOf(l)}
        personName={personName}
        meId={meId}
        readOnly={!lineOpen}
        viewOnly={partnerTab || othersManual.includes(l)}
        sub={l.auto ? copy.previewAuto : kindText(l.kind)}
        onOther={
          partnerTab || !lineOpen
            ? undefined
            : () => nav(`${loc.pathname}${loc.search}`, { state: { other: l.id } })
        }
        onSkip={partnerTab || !lineOpen || l.state === 'skipped' ? undefined : () => skip(l)}
        changed={changed.has(l.id)}
        onItem={
          ago === 0 && l.kind === 'saving' && l.goal_id && itemOf(l.goal_id)
            ? () => nav(savingPaths.item(l.goal_id ?? ''))
            : undefined
        }
      />
    );
  };
  // 한 사람 관리형(2026-11-13 UX B H2): 관리하지 않는 쪽은 자기 줄만 확인, 관리하는 사람 줄은 따로 보기만
  const managerId = joint ? (sp.manager_user_id ?? null) : null;
  const mineOpt = { joint, ownerId: owner, meId: meId ?? '', managerId };
  const othersManual =
    managerId && managerId !== meId && !partnerTab
      ? ordered.filter((l) => isManual(l) && !lineIsMine(l, mineOpt))
      : [];
  const manual = ordered.filter((l) => isManual(l) && !othersManual.includes(l));
  // “모두 계획대로 됐어요”(confirm_payday): 남은 손 줄(늦은 확인이면 건너뜀으로 닫힌 줄도) 중 내가 확인할 수 있는 것
  const confirmable = partnerTab
    ? []
    : late
      ? lateLines(shown).filter((l) => lineIsMine(l, mineOpt))
      : readOnly
        ? []
        : confirmableLines(shown.pay_check_line, mineOpt);
  const confirm = async () => {
    if (busy || !confirmable.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return toast(sharedCopy.needOnline);
    setBusy(true);
    const ids = confirmable.map((l) => l.id);
    const before = confirmable.map((l) => ({ id: l.id, state: l.state }));
    try {
      for (const id of ids) markLocalWrite(id);
      await confirmPayday(shown.id);
      for (const id of ids) markLocalState(id, 'checked');
      track('payday_confirmed', {
        method: 'one_tap',
        manual_lines: manual.length,
        late: shown.cycle_end < today,
      });
      const after = shown.pay_check_line.map((l) =>
        ids.includes(l.id) ? { ...l, state: 'checked' } : l,
      );
      await refreshChecks(qc);
      toast(copy.monthFinished(start, confirmFinish(after) ?? 'all'), {
        label: copy.undo,
        onClick: () =>
          quietly(
            (async () => {
              for (const b of before) {
                markLocalWrite(b.id);
                await checkPayLine(b.id, b.state === 'skipped' ? 'skipped' : 'wait');
              }
              await refreshChecks(qc);
            })(),
          ),
      });
    } catch (e) {
      toast(e instanceof ConfirmBlocked && e.reason === 'closed' ? copy.closed : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  // 한 목록(2026-11-19 확정 시안): 칩 필터, 남은 줄 먼저 → 확인한 줄 아래. 줄이 자리를 옮기면 짧은 이동 애니메이션
  const counts = chipCounts(shown.pay_check_line);
  const finished = late ? null : doneState(shown.pay_check_line);
  const { open: openLines, done: doneLines } = splitCheckLines(shown.pay_check_line, chip);
  const cycles = [list, ...(past.data ?? [])];
  const pick = (i: number) => {
    setAgo(i);
    setChip('all');
    setPickDate(false);
  };
  const dateName = cycleName(start);
  const datePill =
    cycles.length > 1 ? (
      <button
        type="button"
        className="hg-datepill"
        aria-haspopup="dialog"
        aria-label={copy.cyclePick}
        onClick={() => setPickDate(true)}
      >
        {dateName}
        <Icon name="chevron-down" size={16} />
      </button>
    ) : (
      <span className="hg-datepill">{dateName}</span>
    );
  const planned = money(plannedSum(shown.pay_check_line), masked);
  const share = {
    received: start,
    people: ownerPeople,
    nameOf,
    whose: (joint ? 'joint' : partnerTab ? 'partner' : 'self') as 'joint' | 'partner' | 'self',
    screen: (readOnly || ago > 0 ? 'past' : 'checklist') as 'past' | 'checklist',
  };
  const saved = savedSum(shown.pay_check_line);
  const filters = (
    <div className="hg-row" role="group" aria-label={copy.manualGroupLabel}>
      {(
        [
          ['all', copy.chipAll, counts.all],
          ['left', copy.chipLeft, counts.left],
          ['done', copy.chipDone, counts.done],
        ] as const
      ).map(([v, label, n]) => (
        <Chip key={v} className="hg-chip--fill" selected={chip === v} onClick={() => setChip(v)}>
          {label} <b>{n}</b>
        </Chip>
      ))}
    </div>
  );
  const rowsList = (
    <div className="hg-checklist__list" ref={listRef}>
      {[...openLines, ...doneLines].map((l) => (
        <div key={l.id} data-flip={l.id}>
          {row(l)}
        </div>
      ))}
    </div>
  );
  const finishedAll = finished === 'all';

  return frame(
    <>
      <AchieveWatch from="checklist" />
      {people && (
        <Tabs
          label={dateName}
          value={tab}
          onChange={(v) => {
            setWho(v);
            setAgo(0);
          }}
          items={people}
        />
      )}
      {partnerTab && (
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.partnerChecklistView(partner.data?.nickname ?? '')}
        </p>
      )}
      <HeroWithBurst
        listId={list.id + ago}
        finished={!!finished}
        render={(burst) => (
          <MonthHero
            pill={datePill}
            amount={planned}
            meta={heroMeta({ lines: shown.pay_check_line })}
            done={
              finished
                ? {
                    title: finishedAll ? copy.heroTitleAll : copy.heroTitleMixed,
                    saved:
                      saved > 0 ? (
                        <>
                          {copy.savedBefore} <b>{money(saved, masked)}</b> {copy.savedAfter}
                        </>
                      ) : undefined,
                    art: <Illustration name="w02-done" className="hg-sceneart" motion />,
                    extra: share ? (
                      <ShareLink list={shown} income={income} masked={masked} share={share} />
                    ) : undefined,
                    burst,
                  }
                : undefined
            }
          />
        )}
      />
      {late && !partnerTab && <LastMonthNote />}
      {showMade && (
        <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <p className="hg-q__help" style={{ flex: 1 }}>
            {copy.madeFromPlan(Number(list.cycle_start.slice(5, 7)))}
          </p>
          <button
            type="button"
            className="hg-btn hg-btn--ghost hg-btn--sm"
            aria-label={copy.close}
            onClick={dismissMade}
          >
            ×
          </button>
        </div>
      )}
      {changedBy && !dismissed && (
        <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <p className="hg-q__help" style={{ flex: 1 }}>
            {copy.partnerChangedSplit(changedBy)}
          </p>
          <button
            type="button"
            className="hg-btn hg-btn--ghost hg-btn--sm"
            aria-label={copy.close}
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      )}
      {finished ? (
        <>
          <button
            type="button"
            className="hg-foldrow"
            aria-expanded={foldOpen}
            onClick={() => setFoldOpen((x) => !x)}
          >
            <span>{counts.left === 0 ? copy.foldAll(counts.all) : copy.foldSome(counts.done)}</span>
            <Icon name={foldOpen ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {foldOpen && rowsList}
        </>
      ) : (
        <>
          {filters}
          {rowsList}
        </>
      )}
      {!partnerTab && ago === 0 && meId && (
        <MoneyInLine
          meId={meId}
          from={shown.cycle_start}
          to={shown.cycle_end}
          masked={masked}
          onOpen={() => nav(togetherPaths.moneyInList)}
          onAdd={pending ? undefined : () => nav(togetherPaths.moneyIn)}
        />
      )}
      {confirmable.length > 0 && (
        <div className="hg-stickybar">
          <Button variant="primary" block loading={busy} onClick={() => void confirm()}>
            {copy.confirmAll}
          </Button>
        </div>
      )}
      {pickDate && (
        <BottomSheet title={copy.cyclePick} onClose={() => setPickDate(false)}>
          <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            {cycles.map((c, i) => (
              <Button
                key={c.id}
                block
                variant={i === ago ? 'primary' : 'secondary'}
                aria-pressed={i === ago}
                onClick={() => pick(i)}
              >
                {cycleName(shownPayday(c.cycle_start))}
              </Button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>,
  );
}

/**
 * 마지막 줄을 확인해 다 확인 상태가 된 순간에만 한 번 축하 조각(같은 달에서 안 끝남 → 끝남으로 바뀔 때. 다시 들어오면 정적)
 */
function HeroWithBurst({
  listId,
  finished,
  render,
}: {
  listId: string;
  finished: boolean;
  render: (burst: boolean) => ReactNode;
}) {
  const prev = useRef<{ id: string; finished: boolean } | null>(null);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = { id: listId, finished };
    if (was && was.id === listId && !was.finished && finished) {
      setBurst(true);
      const t = window.setTimeout(() => setBurst(false), 1300);
      return () => window.clearTimeout(t);
    }
  }, [listId, finished]);
  return <>{render(burst)}</>;
}
