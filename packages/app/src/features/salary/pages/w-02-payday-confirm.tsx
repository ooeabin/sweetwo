import {
  checkPayLine,
  confirmPayday,
  ConfirmBlocked,
  fetchMoneyInPeriod,
  fetchMoneyIns,
  fetchPastChecklists,
  qk,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import { isOnline } from '@sweetwo/api';
import {
  chipCounts,
  confirmableLines,
  doneState,
  foldText,
  heroMeta,
  joinLineNote,
  periodFillPct,
  periodNeeded,
  savedSum,
  savingLineNote,
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
  StickyBar,
  Icon,
  Illustration,
  PageHeader,
  ReceiptRows,
  LineTabs,
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
import { spoken } from '../../../shared/masked-text';
import { useFlip } from '../../../shared/flip';
import { PersonDot } from '../../../shared/person';
import { quietly, toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { CheckLine, checkToast, goalLineName, isPast, lineName } from '../check-line';
import { copy } from '../copy';
import {
  autoDayText,
  baseDayOf,
  cycleName,
  firstPaydayOf,
  receiptAutoNote,
  useShownPayday,
} from '../cycle';
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
import { IncomeLine } from '../money-in-rows';
import { SalaryLoadError, SalaryLoading, useSalaryTitle } from '../salary-tab';
import { useSavingItems } from '../saving';
import { AchieveWatch } from '../saving-parts';
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

  const ins = useQuery({
    queryKey: qk.moneyIns,
    queryFn: () => fetchMoneyIns(),
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

  // 수입 기본값(프로필 월급)은 W-20b 맨 위로 옮김(2026-11-23 바탕 기준). W-02는 한 줄 IncomeLine만
  const meIncome = me.data.monthly_income ?? 0;
  const emptyPlan = (tag: ReactNode) => (
    <EmptyPlan tag={tag} onFill={() => nav(salaryPaths.plan, { state: { from: 'month' } })} />
  );
  const page = { title };
  const frame = (body: ReactNode) => (
    <MainFrame
      current="salary"
      sub={fromArchive ? 'detail' : undefined}
      page={fromArchive ? undefined : page}
      columns={[
        <div key="l" className="hg-stack">
          {fromArchive ? (
            <PageHeader
              title={copy.archiveTitle}
              backLabel={copy.back}
              backTo={copy.archiveTitle}
              onBack={() => nav(-1)}
            />
          ) : null}
          <div className="hg-page">{body}</div>
        </div>,
      ]}
    />
  );
  const base = baseDayOf(me.data, sp);
  const mySplit = (splits.data ?? []).find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === meId,
  );
  // 날짜 없는 사람(07 6장, 2026-11-19 사용자 결정: 같은 개편 모양): 날짜 알약 “11월 1일 ~ 11월 30일”(30일 기간, 기간이 없으면 이달)
  // → 큰 금액(이 기간 수입 합) + “월급 계획 350만 원 중” + 중립 막대 → 수입 상자 → 저축·투자 목록(월급 계획 템플릿 보조 줄 규칙)
  if (paydayNone && !joint && !list) {
    const pd = period.data;
    const inPeriod =
      !!pd && (pd.status === 'early' || pd.status === 'bar') && !!pd.start && !!pd.end;
    const monthFrom = `${today.slice(0, 8)}01`;
    const monthTo = `${today.slice(0, 8)}${String(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
    const from = inPeriod && pd?.start ? pd.start : monthFrom;
    const to = inPeriod && pd?.end ? pd.end : monthTo;
    // 기간이 있으면 홈 H-13과 같은 서버 값(수입 합, 월급 계획 합), 없으면 이달 기록과 지금 월급 계획 합
    const got =
      inPeriod && pd
        ? pd.received
        : (ins.data ?? [])
            .filter((r) => r.owner_user_id === meId && r.received_on >= from && r.received_on <= to)
            .reduce((sum, r) => sum + r.amount, 0);
    const needed =
      inPeriod && pd?.needed != null ? pd.needed : periodNeeded(mySplit?.split_line ?? []);
    const pct = periodFillPct(got, needed);
    const mine = (mySplit?.split_line ?? [])
      .filter((l) => l.kind === 'saving' && l.goal_id)
      .sort((x, y) => x.sort - y.sort);
    const rows = saving.ready
      ? mine.flatMap((l) => {
          const si = saving.byId(l.goal_id ?? '');
          if (!si || si.owner === 'partner') return [];
          const won = (v: number) => money(v, masked);
          return [
            {
              id: l.id,
              name: si.goal.name,
              amount: won(l.amount),
              label: spoken(copy.rowLabel(si.goal.name, won(l.amount))),
              note: joinLineNote(receiptAutoNote(l, null, true), [
                savingLineNote(
                  {
                    saved: si.saved,
                    target: si.target,
                    pct: si.pct,
                    achieved: si.state === 'achieved',
                    bundled: si.bundled,
                  },
                  won,
                ),
              ]),
              progress:
                si.target !== null && !si.bundled
                  ? { percent: si.state === 'achieved' ? 100 : si.bar }
                  : undefined,
              onOpen: () => nav(savingPaths.item(si.goal.id)),
            },
          ];
        })
      : [];
    return frame(
      <>
        <MonthHero
          pill={<span className="hg-datepill">{copy.periodRange(from, to)}</span>}
          amount={money(got, masked)}
          meta={needed > 0 ? copy.planOf(money(needed, masked)) : undefined}
          bar={needed > 0 ? (pct ?? 0) : undefined}
        />
        {meId && (
          <IncomeLine
            ownerId={meId}
            from={from}
            to={to}
            masked={masked}
            label={copy.incomePeriodLabel}
            onOpen={() => nav(togetherPaths.moneyInList)}
          />
        )}
        {rows.length > 0 && (
          <section className="hg-checkgroup" aria-label={copy.savingGroup}>
            <SectionHeader
              variant="group"
              title={copy.savingGroup}
              onTitle={() => nav(savingListPath('checklist'), { state: { from: 'month' } })}
              titleLabel={copy.listOpen}
            />
            <ReceiptRows
              label={copy.savingGroup}
              lines={rows}
              labels={{
                handle: copy.handle,
                up: copy.moveUp,
                down: copy.moveDown,
                moved: copy.moved,
                remove: copy.remove,
                removeLabel: copy.removeLabel,
                locked: copy.locked,
              }}
            />
          </section>
        )}
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
    // 템플릿 줄이 하나도 없으면(월급 0원 포함) 3단계 안내 + 주 버튼만(2026-11-25 사용자 확정, 날짜는 작은 태그)
    if (ordered.length === 0)
      return frame(
        emptyPlan(
          <span className="hg-w02guide__tag">
            {firstDay ? cycleName(firstDay) : copy.firstWaitNoDate}
          </span>,
        ),
      );
    // 보조 줄 날짜 = 그 줄이 실제로 나가는 날(자동 줄은 나가는 날, 손 줄은 월급날, 2026-11-23 C안)
    const noteOf = (l: (typeof preview)[number]) =>
      l.auto_pay
        ? l.auto_day !== null
          ? copy.waitAuto(autoDayText(l.auto_day))
          : copy.previewAuto
        : firstDay
          ? copy.waitManual(copy.payday(Number(firstDay.slice(8, 10))))
          : undefined;
    return frame(
      <>
        <MonthHero
          pill={
            <span className="hg-datepill">
              {firstDay ? cycleName(firstDay) : copy.firstWaitNoDate}
            </span>
          }
          // 큰 금액 = 그 사이클 월급(월급 계획 템플릿과 같은 숫자, 합쳐서면 두 사람 합, 0원이면 “0원”).
          // 줄이 하나도 없으면(월급 0원 포함) 큰 금액·보조 줄 없이 아래 한 줄(2026-11-19 사용자 결정)
          amount={
            ordered.length > 0 ? money(incomeOf(owner, me.data, partner.data), masked) : undefined
          }
          meta={
            firstDay && ordered.length > 0
              ? heroMeta({ preview: { today, payday: firstDay, count: ordered.length } })
              : undefined
          }
        />
        {preview.length > 0 && (
          <div className="hg-checklist__list hg-list--preview">
            {ordered.map((l) => (
              <TransferRow
                key={l.id}
                label={previewName(l)}
                meta={noteOf(l)}
                amount={money(l.amount, masked)}
                done={false}
                checkLabel={copy.previewCheck(previewName(l))}
                status={{
                  tone: 'wait',
                  ariaLabel: copy.waitLabel(
                    previewName(l),
                    money(l.amount, masked),
                    copy.previewWhen,
                  ),
                }}
              />
            ))}
          </div>
        )}
        {meId && (
          <IncomeLine
            ownerId={meId}
            from={`${today.slice(0, 8)}01`}
            to={today}
            masked={masked}
            // 첫 월급날 전: 기록이 없으면 프로필 월급을 값으로(저장은 첫 확인 때 자동 기록)
            fallback={meIncome}
            onOpen={() => nav(togetherPaths.moneyInList)}
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
  // 한 사람 관리형(2026-11-13 UX B H2): 관리하지 않는 쪽은 자기 줄만 확인, 관리하는 사람 줄은 따로 보기만
  const managerId = joint ? (sp.manager_user_id ?? null) : null;
  const mineOpt = { joint, ownerId: owner, meId: meId ?? '', managerId };
  const othersManual =
    managerId && managerId !== meId && !partnerTab
      ? ordered.filter((l) => isManual(l) && !lineIsMine(l, mineOpt))
      : [];
  const manual = ordered.filter((l) => isManual(l) && !othersManual.includes(l));
  // 관리하지 않는 쪽은 관리하는 사람 줄을 뺀 내 줄로 칩·개수·다 확인 상태를 셈(그 줄은 아래 “{이름}님이 확인해요” 묶음, 2026-11-23)
  const mineLines = shown.pay_check_line.filter((l) => !othersManual.includes(l));
  // 관리하는 사람 줄이 아직 대기면 축하하지 않음(그 사람이 끝내야 이번 달이 끝남)
  const finished =
    late || othersManual.some((l) => l.state === 'wait') ? null : doneState(mineLines);
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
  // 다 확인 상태에서는 숨김(2026-11-23): 축하 화면에 “만들었어요” 안내가 같이 남던 것
  const showMade =
    ago === 0 && !partnerTab && !finished && (past.data?.length ?? 0) > 0 && !madeSeen;
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
        sub={l.auto ? copy.previewAuto : ''}
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
  // “모두 계획대로 됐어요”(confirm_payday): 남은(미확인) 손 줄 중 내가 확인할 수 있는 것. 이번 달·지난 달(늦은 확인) 같은 기준,
  // 서버가 닫을 때 건너뜀으로 바꾼 줄만 남았으면 버튼 없음(2026-11-19). 건너뜀 줄은 줄 시트로 다시 확인
  const confirmable =
    partnerTab || (readOnly && !late) ? [] : confirmableLines(shown.pay_check_line, mineOpt);
  const confirm = async () => {
    if (busy || !confirmable.length) return;
    if (!isOnline()) return toast(sharedCopy.needOnline);
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
  const counts = chipCounts(mineLines);
  const { open: openLines, done: doneLines } = splitCheckLines(mineLines, chip);
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
  const planned = money(income, masked);
  const noLines = shown.pay_check_line.length === 0;
  // 내 이번 달 확인 목록에 줄이 하나도 없음(파트너 탭·지난 달은 예전 안내 한 줄 그대로)
  const ownEmpty = noLines && ago === 0 && !partnerTab && !finished;
  // 수입 카드 기본값: 내 이번 달, 아직 자동 기록 전(지금 확인하면 이 월급이 자동 기록됨)
  const incomeDefault = ago === 0 && !partnerTab && !readOnly && !list.auto_income_at;
  // 손 줄이 하나도 없고 자동 줄뿐인 이번 달(2026-11-25): 다 확인 축하 없이 평소 목록 + 회색 한 줄 “자동으로 나가요” 안내
  const autoOnly =
    ago === 0 && !partnerTab && !noLines && manual.length === 0 && othersManual.length === 0;
  const share = {
    received: start,
    people: ownerPeople,
    nameOf,
    whose: (joint ? 'joint' : partnerTab ? 'partner' : 'self') as 'joint' | 'partner' | 'self',
    screen: (readOnly || ago > 0 ? 'past' : 'checklist') as 'past' | 'checklist',
  };
  const saved = savedSum(mineLines);
  const filters = (
    <LineTabs
      label={copy.manualGroupLabel}
      value={chip}
      onChange={setChip}
      items={[
        { value: 'all', label: copy.chipAll, count: counts.all },
        { value: 'left', label: copy.chipLeft, count: counts.left },
        { value: 'done', label: copy.chipDone, count: counts.done },
      ]}
    />
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
  // 지난 달 보기(‹ › 또는 W-21에서 연 화면)는 “이번 달” 대신 그 달 이름(2026-11-23)
  const pastView = ago > 0;

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
        render={(burst) =>
          ownEmpty ? null : (
            <MonthHero
              pill={datePill}
              // 파트너 탭은 월급 금액을 못 볼 때(‘저축·투자만’ 공개 등) “0원”을 큰 금액으로 두지 않고 줄 개수만(2026-11-23)
              amount={noLines || (partnerTab && income <= 0) ? undefined : planned}
              done={
                finished
                  ? {
                      title: pastView
                        ? (finishedAll ? copy.heroTitleAllOf : copy.heroTitleMixedOf)(
                            Number(start.slice(5, 7)),
                          )
                        : finishedAll
                          ? copy.heroTitleAll
                          : copy.heroTitleMixed,
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
          )
        }
      />
      {late && !partnerTab && <LastMonthNote />}
      {autoOnly && (
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.autoOnly}
        </p>
      )}
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
            <span>{foldText(mineLines)}</span>
            <Icon name={foldOpen ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {foldOpen && rowsList}
        </>
      ) : noLines ? (
        // 템플릿 줄이 하나도 없으면 칩·목록 없이 안내(2026-11-19 회귀 수정). 내 이번 달은 한 덩어리 안내 + 주 버튼(2026-11-20)
        ownEmpty ? (
          emptyPlan(
            cycles.length > 1 ? datePill : <span className="hg-w02guide__tag">{dateName}</span>,
          )
        ) : partnerTab ? (
          // 상대 화면에 보이는 줄이 없을 때(‘했어요만’ 공개 등): 상대에게 줄을 추가하라는 안내가 아님(2026-11-23)
          <p className="hg-checklist__none">{copy.partnerNone}</p>
        ) : (
          <section className="hg-card hg-card--fill hg-stack">
            <p className="hg-card__meta">{copy.emptyPlan}</p>
          </section>
        )
      ) : (
        <>
          {filters}
          {rowsList}
        </>
      )}
      {othersManual.length > 0 && managerId && (
        <section
          className="hg-checkgroup"
          aria-label={copy.managerGroup(personName(managerId) ?? '')}
        >
          <SectionHeader variant="group" title={copy.managerGroup(personName(managerId) ?? '')} />
          <div className="hg-checklist__list">{othersManual.map((l) => row(l))}</div>
        </section>
      )}
      {meId && !ownEmpty && (
        <IncomeLine
          ownerId={partnerTab ? tab : meId}
          alsoOwnerIds={joint && partner.data ? [partner.data.id] : undefined}
          from={shown.cycle_start}
          to={shown.cycle_end}
          masked={masked}
          label={pastView ? copy.incomeCardLabelOf(Number(start.slice(5, 7))) : undefined}
          fallback={incomeDefault ? meIncome : undefined}
          hideEmpty={partnerTab}
          onOpen={partnerTab ? undefined : () => nav(togetherPaths.moneyInList)}
        />
      )}
      {confirmable.length > 0 && (
        <StickyBar>
          <Button variant="primary" block loading={busy} onClick={() => void confirm()}>
            {copy.confirmAll}
          </Button>
        </StickyBar>
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

/**
 * 월급 계획이 없어 템플릿 줄이 하나도 없을 때(20 W-02 0b, 2026-11-25 사용자 확정 ‘첫 사용 화면’): 작은 날짜 태그 + 큰 제목 + 보조 +
 * 번호 3단계 + 회색 ‘이렇게 보여요(예시)’ 판 + 아래 고정 주 버튼 “월급 계획 세우기”(→ W-01). 그림 자리 없음, 오렌지는 주 버튼만
 */
function EmptyPlan({ tag, onFill }: { tag: ReactNode; onFill: () => void }) {
  return (
    <>
      <section className="hg-w02guide" aria-labelledby="w02-guide-title">
        <div className="hg-w02guide__head">
          {tag}
          <h2 id="w02-guide-title" className="hg-w02guide__title">
            {copy.guideTitle}
          </h2>
          <p className="hg-w02guide__sub">{copy.guideSub}</p>
        </div>
        <ol className="hg-w02guide__steps">
          {copy.guideSteps.map((st, i) => (
            <li key={st.title} className="hg-w02guide__step">
              <span className="hg-w02guide__num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <p className="hg-w02guide__step-title">{st.title}</p>
                <p className="hg-w02guide__step-sub">{st.sub}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="hg-w02guide__sample" role="group" aria-label={copy.guideSampleLabel}>
          <p className="hg-w02guide__sample-label">{copy.guideSampleLabel}</p>
          {copy.guideSample.map((r) => (
            <div key={r.name} className="hg-w02guide__sample-row">
              <i aria-hidden="true" />
              <span>{r.name}</span>
              {r.auto ? <span>{r.value}</span> : <b>{r.value}</b>}
            </div>
          ))}
        </div>
      </section>
      <StickyBar>
        <Button variant="primary" block onClick={onFill}>
          {copy.fillPlan}
        </Button>
      </StickyBar>
    </>
  );
}
