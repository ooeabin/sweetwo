import {
  formatDateFull,
  formatDateWeekday,
  formatYm,
  todayKst,
  type Upcoming,
} from '@sweetwo/core';
import { Badge, Button, Card, ListRow, Meter, SectionHeader, type AppFrameStat } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { money, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { useNavigate } from 'react-router-dom';
import {
  useCurrentPlan,
  useGoalAssetSums,
  useGoalRecords,
  useGoals,
  useMe,
  useMonthClose,
  usePartner,
  useSpace,
} from '../data';
import { H04Todos } from '../h-04-todos';
import { openReceived, useProposals } from '../../proposals';
import { MainFrame } from '../frame';
import { closePath, spendPath } from '../paths';
import { goalExtra, monthView, type MonthView } from '../view';

// H-01 이번 달(docs/spec/19-this-month.md). 앱 기본 틀 + 오늘 띠(H-01 인사, H-02 맨 위 행동과 숫자 타일)
// + 왼쪽 단(월급 플랜 H-03 / 예비부부 모으기·결혼 비용) + 오른쪽 단(목표 H-05, 다가오는 일정 H-07).
// 맨 위 행동: 지출 적기(W-04j), 월급 나누기(W-02), 월말 정리(W-04). ‘추가’는 다음 단계.
export function H01ThisMonth() {
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const plan = useCurrentPlan();
  const partner = usePartner();
  const close = useMonthClose(plan.data?.id);
  const records = useGoalRecords();
  const linked = useGoalAssetSums();
  const proposals = useProposals();
  const nav = useNavigate();
  const { masked } = useMask();

  const loading = me.isLoading || space.isLoading || goals.isLoading || plan.isLoading;
  const failed = me.isError || space.isError || goals.isError || plan.isError;
  const date = formatDateWeekday(todayKst());
  const m = (v: number) => money(v, masked);

  const v =
    me.data && space.data
      ? monthView({
          me: me.data,
          space: space.data,
          goals: goals.data ?? [],
          plan: plan.data ?? null,
          partner: partner.data ?? null,
          spentVariable: (close.data?.spends ?? []).reduce((t, x) => t + x.amount, 0),
          closeDone: close.data?.status === 'done',
          goalDeposits: goalExtra(
            records.data?.deposits ?? [],
            linked.data ?? [],
            records.data?.uses ?? [],
          ),
        })
      : null;
  const name = me.data?.nickname ?? '';
  const received = openReceived(proposals.data ?? [], me.data?.id);
  const names =
    v && me.data
      ? { myId: me.data.id, myName: name, partnerName: v.partnerName, starter: v.starter }
      : undefined;

  let title: ReactNode = '';
  let actions: ReactNode = null;
  let stats: AppFrameStat[] = [];
  let columns: ReactNode[] = [];

  if (failed) {
    title = copy.loadFailed;
    actions = (
      <Button
        variant="primary"
        onClick={() => {
          void me.refetch();
          void space.refetch();
          void goals.refetch();
          void plan.refetch();
        }}
      >
        {copy.retry}
      </Button>
    );
  } else if (loading || !v) {
    columns = [<Skeleton key="l" />, <Skeleton key="r" />];
  } else {
    ({ title, actions, stats } = today(v, name, m, (to) => nav(to)));
    const todos = (
      <H04Todos
        key="todos"
        state={v.todoState}
        today={v.today}
        partner={v.partnerName}
        received={received}
        names={names}
        goals={goals.data ?? []}
      />
    );
    columns = v.separate
      ? [
          <div key="l" className="hg-stack" style={{ gap: 'var(--space-8)' }}>
            {todos}
            <PrepCards v={v} name={name} partner={v.partnerName} m={m} />
          </div>,
          <Upcomings key="r" v={v} />,
        ]
      : [
          <div key="l" className="hg-stack" style={{ gap: 'var(--space-8)' }}>
            {v.engaged && <WeddingHeader v={v} />}
            {todos}
            <PlanCard
              v={v}
              m={m}
              onMoney={() => nav('/assets/money')}
              onPlan={() => nav('/plan')}
            />
            {v.engaged && <WeddingStatus v={v} m={m} />}
          </div>,
          <div key="r" className="hg-stack" style={{ gap: 'var(--space-8)' }}>
            <Goals v={v} m={m} />
            <Upcomings v={v} />
          </div>,
        ];
  }

  return <MainFrame current="month" today={{ date, title, actions, stats }} columns={columns} />;
}

/** 오늘 띠: 인사(H-01) + 맨 위 행동(H-02) + 숫자 타일 3개 */
function today(v: MonthView, name: string, m: (n: number) => string, go: (to: string) => void) {
  const next = v.events[0];
  const nextTile: AppFrameStat | null = next
    ? { label: copy.nextEvent, value: copy.dday(next.dday), sub: eventLabel(next, v.month) }
    : null;
  const netWorth: AppFrameStat = { label: copy.netWorth, value: copy.unknown };

  // 예비부부 각자 관리: D-day 헤더(H-P1)가 맨 위
  if (v.separate) {
    return {
      title: weddingTitle(v),
      actions: null,
      stats: nextTile ? [nextTile] : [],
    };
  }

  let title: string;
  let primary: string;
  let first: AppFrameStat;
  if (v.closing && v.closeDays !== null) {
    title = copy.closeTitle(v.month);
    primary = copy.closeStart;
    first = { label: copy.closeTile, value: copy.dday(v.closeDays), sub: copy.closeSub };
  } else if (v.hasSplit) {
    title = copy.greetingSplit(name, v.month, v.pendingSplit.count);
    primary = copy.splitNow;
    first = { label: copy.unsplit, value: m(v.pendingSplit.amount) };
  } else {
    const amount = m(Math.abs(v.living.left));
    title = v.living.over ? copy.greetingOver(name, amount) : copy.greetingNoSplit(name, amount);
    primary = copy.spendEntry;
    first = {
      label: copy.livingLeft,
      value: v.living.over ? copy.livingOver(amount) : amount,
      sub: v.living.pct === null ? undefined : `${v.living.pct}%`,
    };
  }
  // 여는 화면: 지출 적기(W-04j 앞당겨 열기), 정리 시작(W-04a), 월급 나누기(W-02)
  const target =
    primary === copy.spendEntry
      ? spendPath
      : primary === copy.closeStart
        ? closePath
        : primary === copy.splitNow
          ? '/plan/split'
          : null;
  return {
    title,
    // ‘추가’는 다음 단계
    actions: (
      <>
        <Button variant="secondary" disabled>
          {copy.add}
        </Button>
        <Button
          variant="primary"
          disabled={!target || !v.planId}
          onClick={target ? () => go(target) : undefined}
        >
          {primary}
        </Button>
      </>
    ),
    stats: [first, netWorth, ...(nextTile ? [nextTile] : [])],
  };
}

function weddingTitle(v: MonthView): ReactNode {
  if (v.weddingDday !== null && v.weddingDate) return copy.ddayWedding(Math.max(v.weddingDday, 0));
  if (v.weddingMonth)
    return (
      <>
        {copy.weddingPlanned(formatYm(v.weddingMonth))} <Badge kind="temp">{copy.estimated}</Badge>
      </>
    );
  return '';
}

function eventLabel(e: Upcoming, month: number) {
  if (e.kind === 'payday') return copy.payday(e.who ?? '');
  if (e.kind === 'close') return copy.closeTitle(month);
  return copy.wedding;
}

/** 예비부부 D-day(H-P1). ‘지금부터 합쳐서’ 부부는 신혼 이번 달 위에 카드로 */
function WeddingHeader({ v }: { v: MonthView }) {
  return (
    <Card
      label={weddingTitle(v)}
      meta={v.weddingDate ? formatDateFull(v.weddingDate) : undefined}
    />
  );
}

/** 월급 플랜(H-03): 플랜 이름 + 임시 + 남은 생활비(또는 남은 나누기) + 통장 4종류 계획액 */
function PlanCard({
  v,
  m,
  onMoney,
  onPlan,
}: {
  v: MonthView;
  m: (n: number) => string;
  onMoney: () => void;
  onPlan: () => void;
}) {
  const rows: [string, number][] = [
    [copy.roles.living, v.parts.living],
    [copy.roles.goalFund, v.parts.goalFund],
    [copy.roles.emergency, v.parts.emergency],
    [copy.roles.allowance, v.allowance],
  ];
  return (
    <section className="hg-stack">
      <SectionHeader
        title={
          <>
            {copy.planName(v.month)} {v.temp && <Badge kind="temp">{copy.temp}</Badge>}
          </>
        }
      />
      <p className="hg-card__meta">
        {v.hasSplit
          ? copy.splitLeft(v.pendingSplit.count)
          : copy.livingLeftLine(
              v.living.over ? copy.livingOver(m(-v.living.left)) : m(v.living.left),
            )}
      </p>
      <div className="hg-list">
        {rows.map(([label, value]) => (
          <ListRow key={label} label={label} value={m(value)} />
        ))}
      </div>
      <div className="hg-row" style={{ gap: 'var(--space-3)' }}>
        {/* H-03 → W-01 월급 플랜 */}
        <button type="button" className="hg-btn hg-btn--link" onClick={onPlan}>
          {copy.seePlan}
        </button>
        {/* H-01 7번 월 수입·지출 수정 → F-05 */}
        <button type="button" className="hg-btn hg-btn--link" onClick={onMoney}>
          {copy.editMoney}
        </button>
      </div>
    </section>
  );
}

/** 목표(H-05) 상위 3개 */
function Goals({ v, m }: { v: MonthView; m: (n: number) => string }) {
  if (!v.goals.length) return null;
  return (
    <section className="hg-stack">
      <SectionHeader title={copy.goals} />
      <div className="hg-card">
        {v.goals.map((g) => (
          <Meter
            key={g.id}
            name={g.name}
            tone={g.template === 'emergency' ? 'safety' : 'goal'}
            pct={g.pct}
            sub={g.target ? copy.goalAmount(m(g.held), m(g.target)) : copy.noGoalAmount}
            badge={g.delayed ? <Badge kind="warn">{copy.delayed}</Badge> : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/** 다가오는 일정(H-07, 예비부부 H-P6) */
function Upcomings({ v }: { v: MonthView }) {
  return (
    <section className="hg-stack">
      <SectionHeader title={copy.upcoming} />
      {v.events.length ? (
        <div className="hg-list">
          {v.events.map((e) => (
            <ListRow
              key={`${e.kind}-${e.date}`}
              label={eventLabel(e, v.month)}
              sub={formatDateWeekday(e.date)}
              value={copy.dday(e.dday)}
            />
          ))}
        </div>
      ) : (
        <div className="hg-card">
          <p className="hg-card__meta">{copy.noUpcoming}</p>
        </div>
      )}
    </section>
  );
}

/** 각자 관리 예비부부: 이번 달 모으기(H-P3) + 결혼 비용 현황(H-P4) */
function PrepCards({
  v,
  name,
  partner,
  m,
}: {
  v: MonthView;
  name: string;
  partner: string;
  m: (n: number) => string;
}) {
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-8)' }}>
      {!v.wedding.gatherHidden && (
        <section className="hg-stack">
          <SectionHeader title={copy.gather} />
          <div className="hg-list">
            <ListRow label={name} value={m(v.wedding.gather.me)} />
            <ListRow label={partner} value={m(v.wedding.gather.partner)} />
          </div>
        </section>
      )}
      <WeddingStatus v={v} m={m} />
    </div>
  );
}

function WeddingStatus({ v, m }: { v: MonthView; m: (n: number) => string }) {
  const w = v.wedding;
  const rows: [string, number][] = [
    [copy.budget, w.budget],
    [copy.support, w.support],
    [copy.savedMoney, w.saved],
    [copy.toSave, w.toSave],
  ];
  return (
    <section className="hg-stack">
      <SectionHeader title={copy.weddingStatus} />
      <p className="hg-card__title">
        {w.shortfall > 0 ? copy.shortfall(m(w.shortfall)) : copy.surplus(m(w.surplus))}
      </p>
      <div className="hg-list">
        {rows.map(([label, value]) => (
          <ListRow key={label} label={label} value={m(value)} />
        ))}
      </div>
    </section>
  );
}

/** 불러오는 중 카드 모양 */
function Skeleton() {
  return (
    <div className="hg-card" aria-hidden="true">
      <div className="hg-skel" style={{ height: 'var(--space-6)', width: '40%' }} />
      <div className="hg-skel" style={{ height: 'var(--space-22)' }} />
    </div>
  );
}
