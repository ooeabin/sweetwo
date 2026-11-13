import {
  checkPayLine,
  confirmPayday,
  ConfirmBlocked,
  fetchHolidays,
  fetchMoneyInPeriod,
  fetchPastChecklists,
  qk,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import {
  businessDayOnOrBefore,
  confirmableLines,
  confirmFinish,
  isManual,
  kstDateOf,
  todayKst,
} from '@sweetwo/core';
import { AddRow, Button, Icon, IconButton, SectionHeader, Tabs } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import { quietly, toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import {
  CheckLine,
  checkToast,
  goalLineName,
  isPast,
  LineLead,
  lineName,
  periodText,
} from '../check-line';
import { copy } from '../copy';
import { autoDayText, baseDayOf, cycleName, firstPaydayOf } from '../cycle';
import {
  markLocalState,
  markLocalWrite,
  refreshChecks,
  useChangedLines,
  useCheck,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  useSplits,
} from '../data';
import { incomeOf, MonthBar } from '../month-parts';
import { salaryPaths, savingPaths } from '../paths';
import { PeriodLine } from '../period-line';
import { SalaryLoadError, SalaryLoading, SalarySeg } from '../salary-tab';
import { useFirstSaving, useSavingItems } from '../saving';
import { AchieveWatch, FirstSavingRow, SavingGoalRow, SavingMeta } from '../saving-parts';
import { LastMonthNote, lateLines, lateOpen } from './w-02-last-month';
import { W02aOtherAmount } from './w-02a-other-amount';

// W-02 월급날 확인(20 ‘월급 탭 v2.2’ W-02, ADR 0009 결정 2) = 월급 탭 첫 화면 ‘이번 달’.
// 제목 “11월 25일 월급” + 기간 + 진행 막대 → 접힌 묶음 “자동으로 나가는 것 n개”(펼치면 “26일 자동” / “자동 확인”)
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
  const [autoOpen, setAutoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cycleParam = params.get('cycle');
  const splits = useSplits();
  const holidays = useQuery({ queryKey: qk.holidays, queryFn: fetchHolidays });
  const saving = useSavingItems();
  const first = useFirstSaving();
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
    setParams(next, { replace: true });
  }, [cycleParam, past.data, params, setParams]);
  const changed = useChangedLines(ago === 0 ? list?.pay_check_line : undefined);

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
        name={lineName(other, goalName, personName, joint)}
        goalName={other.kind === 'saving' ? goalName(other.goal_id) : undefined}
        personName={personName}
        entry="w02"
        onClose={() => nav(-1)}
      />
    );

  const pending = sp.couple_state === 'unlink_pending';
  const page = {
    title: copy.tabTitle,
    actions:
      list && !pending ? (
        <Button
          variant="secondary"
          className="hg-wide-only"
          onClick={() => nav(`${savingPaths.add}/a?from=salary_wide`)}
        >
          {copy.addItem}
        </Button>
      ) : undefined,
  };
  const frame = (body: ReactNode) => (
    <MainFrame
      current="salary"
      page={page}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          <SalarySeg value="month" />
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
        {period.data && <PeriodLine period={period.data} onGo={() => nav('/salary/money-in')} />}
        <section className="hg-checkgroup" aria-label={copy.savingGroup}>
          <SectionHeader
            variant="group"
            title={copy.savingGroup}
            onTitle={() => nav(`${savingPaths.list}?from=checklist`)}
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
          {!pending && (
            <AddRow
              block
              label={copy.listAdd}
              onClick={() => nav(`${savingPaths.add}/a?from=salary_row`)}
            />
          )}
        </section>
      </>,
    );
  }
  if (!list) {
    // 첫 확인 목록 전(소급 없음, 07 3-1): 월급 계획이 있으면 “11월 25일 첫 월급날에 확인해요” + 월급 계획 보기
    const firstDay = mySplit ? firstPaydayOf(mySplit, base, today) : null;
    if (mySplit)
      return frame(
        <section className="hg-card hg-card--fill hg-stack">
          <p className="hg-card__meta">
            {firstDay ? copy.firstWait(firstDay) : copy.firstWaitNoDate}
          </p>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => nav(salaryPaths.plan)}
          >
            {copy.editSplit}
          </button>
        </section>,
      );
    // 월급 없음: 홈과 같은 빈 카드 + ‘월급 알려 주기’
    return frame(
      <section className="hg-card hg-card--fill hg-stack">
        <p className="hg-card__meta">{copy.noChecklist}</p>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav('/settings/me')}
        >
          {copy.tellSalary}
        </button>
      </section>,
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
  const late = ago > 0 && lateOpen(shown, today, base);
  // 지난 달은 읽기 전용, 늦은 확인 기간이면 남은 손 줄만 체크(07 4장)
  const readOnly = (ago > 0 || isPast(shown.cycle_end)) && !late;
  const lateIds = late ? new Set(lateLines(shown).map((l) => l.id)) : null;
  const holidaySet = new Set((holidays.data ?? []).map((h) => h.date));
  const start =
    sp.holiday_shift === false
      ? shown.cycle_start
      : businessDayOnOrBefore(shown.cycle_start, holidaySet);
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
  const income = incomeOf(owner, me.data, partner.data);
  const ownerPeople = (
    owner === null ? [me.data, partner.data] : [owner === meId ? me.data : partner.data]
  )
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ id: x.id, name: x.nickname ?? '', starter: x.id === sp.created_by }));
  const itemOf = (id: string | null) => (saving.ready && id ? saving.byId(id) : undefined);
  const nameOf = (l: PayCheckLine) => lineName(l, goalName, personName, joint);

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
  const autoText = (l: PayCheckLine) => {
    if (l.state === 'checked') return copy.autoDone;
    const due = l.auto_due ?? shown.cycle_start;
    return copy.autoWait(
      due === shown.cycle_start ? autoDayText(null) : autoDayText(Number(due.slice(8, 10))),
    );
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
        lead={<LineLead line={l} />}
        readOnly={!lineOpen}
        viewOnly={partnerTab}
        auto={l.auto ? autoText(l) : undefined}
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
        progress={
          l.kind === 'saving' && itemOf(l.goal_id)?.target != null ? (
            <SavingMeta item={itemOf(l.goal_id)} masked={masked} />
          ) : undefined
        }
      />
    );
  };
  const autoLines = ordered.filter((l) => l.auto);
  const manual = ordered.filter(isManual);
  // “모두 계획대로 됐어요”(confirm_payday): 남은 손 줄(늦은 확인이면 건너뜀으로 닫힌 줄도) 중 내가 확인할 수 있는 것
  const confirmable = partnerTab
    ? []
    : late
      ? lateLines(shown).filter(
          (l) => !(joint && l.kind === 'allowance' && l.user_id && l.user_id !== meId),
        )
      : readOnly
        ? []
        : confirmableLines(shown.pay_check_line, { joint, ownerId: owner, meId: meId ?? '' });
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
      toast(copy.monthFinished(shown.cycle_start, confirmFinish(after) ?? 'all'), {
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
  const more = (past.data?.length ?? 0) > ago;
  const openList = () => nav(`${savingPaths.list}?from=checklist`);
  const groups = (
    [
      [copy.savingGroup, manual.filter((l) => l.kind === 'saving')],
      [copy.spendGroup, manual.filter((l) => l.kind !== 'saving')],
    ] as const
  ).map(([title, ls]) => {
    const n = ls.filter((l) => l.state !== 'wait').length;
    const kind = title === copy.savingGroup ? 'saving' : 'spend';
    if (!ls.length) {
      // 내 저금이 없으면 저금 묶음에 빈 줄 ‘+ 저금 추가’(이번 달 내 탭·합쳐서만)
      if (kind !== 'saving' || !first.show || partnerTab || readOnly) return null;
      return (
        <section key={title} className="hg-checkgroup" aria-label={title}>
          <SectionHeader
            variant="group"
            title={title}
            onTitle={openList}
            titleLabel={copy.listOpen}
          />
          <FirstSavingRow from="salary" go={nav} />
        </section>
      );
    }
    return (
      <section key={title} className="hg-checkgroup" aria-label={title}>
        <SectionHeader
          variant="group"
          title={title}
          count={
            n > 0 ? (
              <>
                <b>{n}</b>/{ls.length}
              </>
            ) : (
              `${n}/${ls.length}`
            )
          }
          countLabel={copy.progress(ls.length, n)}
          onTitle={kind === 'saving' ? openList : undefined}
          titleLabel={kind === 'saving' ? copy.listOpen : undefined}
        />
        <div className="hg-checklist__list">{ls.map(row)}</div>
        {kind === 'saving' && !readOnly && !partnerTab && !pending && ago === 0 && (
          <AddRow
            block
            className="hg-narrow-only"
            label={copy.listAdd}
            onClick={() => nav(`${savingPaths.add}/a?from=salary_row`)}
          />
        )}
      </section>
    );
  });

  return frame(
    <>
      <AchieveWatch from="checklist" />
      <section aria-label={cycleName(shown.cycle_start)}>
        <SectionHeader
          title={cycleName(shown.cycle_start)}
          meta={periodText(start, shown.cycle_end)}
          action={
            <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <IconButton
                icon="chevron-left"
                label={copy.prevMonth}
                small
                disabled={!more}
                onClick={() => setAgo(ago + 1)}
              />
              <IconButton
                icon="chevron-right"
                label={copy.nextMonth}
                small
                disabled={ago === 0}
                onClick={() => setAgo(ago - 1)}
              />
            </span>
          }
        />
        <MonthBar
          list={shown}
          income={income}
          masked={masked}
          share={{
            received: start,
            people: ownerPeople,
            nameOf,
            whose: joint ? 'joint' : partnerTab ? 'partner' : 'self',
            screen: readOnly || ago > 0 ? 'past' : 'checklist',
          }}
        />
      </section>
      {late && !partnerTab && <LastMonthNote />}
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
      {people && (
        <Tabs
          label={cycleName(shown.cycle_start)}
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
      {/* 자동으로 나가는 것(접힌 묶음, 20 W-02 2번) */}
      {autoLines.length > 0 && (
        <section className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="hg-foldrow"
            aria-expanded={autoOpen}
            onClick={() => setAutoOpen((x) => !x)}
          >
            <span>{copy.autoGroup(autoLines.length)}</span>
            <Icon name={autoOpen ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {autoOpen && (
            <>
              {autoLines.some((l) => l.state === 'checked') && !partnerTab && (
                <p className="hg-q__help" style={{ margin: 0 }}>
                  {copy.autoGroupHelp}
                </p>
              )}
              <div className="hg-checklist__list">{autoLines.map(row)}</div>
            </>
          )}
        </section>
      )}
      {/* 확인할 것(손 줄, 20 W-02 3번): 저금·지출 묶음 카드 */}
      {manual.length > 0 && <SectionHeader title={copy.manualGroup(manual.length)} />}
      <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        {groups}
      </div>
      {confirmable.length > 0 && (
        <Button variant="primary" block loading={busy} onClick={() => void confirm()}>
          {copy.confirmAll}
        </Button>
      )}
      {!partnerTab && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav(salaryPaths.plan)}
        >
          {copy.editSplit}
        </button>
      )}
    </>,
  );
}
