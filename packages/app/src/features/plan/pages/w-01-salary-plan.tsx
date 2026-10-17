import { fetchIncomeEvents, qk } from '@sweetwo/api';
import { formatDot, formatManWon, type SplitRow } from '@sweetwo/core';
import { Badge, Button, Chip, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame, useMonthView } from '../../month';
import { useSplitActions } from '../actions';
import { copy } from '../copy';

const ROLE_KEYS = ['living', 'goal_fund', 'emergency'] as const;

// W-01 월급 플랜(docs/spec/20-salary-plan.md): 이름(첫 사이클은 남은 기간) + 기간 + 임시, 진행 문구, 돈 흐름 막대,
// 특이사항(들어오는 돈), 통장별 계획액 + 사람마다 담당·월급날 칩(내 칩 = 바로 옮겼어요), ‘월급 나누기’ → W-02.
// 계획액 줄 탭 → W-01a 이번 달만 바꾸기, 특이사항·‘들어오는 돈’ → W-07. 월 넘기기, 자동 나누기 줄 표시는 다음 단계.
export function W01SalaryPlan() {
  const nav = useNavigate();
  const v = useMonthView();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const man = (x: number) => (masked ? money(x, true) : formatManWon(x));
  const events = useQuery({ queryKey: qk.incomeEvents, queryFn: fetchIncomeEvents });
  const act = useSplitActions(v?.partnerName ?? '');
  if (!v || !v.cycle) return <MainFrame current="month" columns={[null]} />;

  const s = v.split;
  const p = s.progress;
  const progress = v.hasSplit
    ? p.total > 0 && p.done === p.total
      ? copy.allDone
      : copy.progress(p.total, p.done)
    : v.roles && !v.joined && !v.solo && !v.separate
      ? copy.notJoined(v.partnerName)
      : null;

  // 4번 돈 흐름(월 수입 대비, 보기만). 월급 나누기가 없거나 통장이 하나면 용돈, 고정, 생활비, 저축
  const flow: { name: string; value: number; color: string }[] =
    v.hasSplit || v.roles
      ? [
          { name: copy.flow.allowance, value: v.allowance, color: 'var(--chart-family)' },
          { name: copy.flow.living, value: v.parts.living, color: 'var(--chart-together)' },
          { name: copy.flow.goalFund, value: v.parts.goalFund, color: 'var(--chart-goal)' },
          { name: copy.flow.emergency, value: v.parts.emergency, color: 'var(--chart-safety)' },
        ]
      : [
          { name: copy.flow.allowance, value: v.allowance, color: 'var(--chart-family)' },
          { name: copy.flow.fixed, value: v.budget.fixed, color: 'var(--chart-invest)' },
          { name: copy.flow.livingOnly, value: v.budget.living, color: 'var(--chart-together)' },
          {
            name: copy.flow.saving,
            value: v.parts.goalFund + v.parts.emergency,
            color: 'var(--chart-goal)',
          },
        ];
  const income = v.budget.income;
  const pct = (x: number) => (income > 0 ? Math.round((x * 100) / income) : null);

  // 5번 특이사항: 이번 플랜 달에 들어오는 돈(상여금 등), 최대 3개
  const notes = (events.data ?? [])
    .filter((e) => e.month === v.month)
    .slice(0, 3)
    .map((e) => copy.incomeThisMonth(e.name, m(e.amount)));

  const plan: Record<(typeof ROLE_KEYS)[number], number> = {
    living: v.parts.living,
    goal_fund: v.parts.goalFund,
    emergency: v.parts.emergency,
  };
  const chips = (role: string) => {
    if (!v.hasSplit) return null;
    const mine = s.mine.find((r) => r.role === role && r.kind === 'split');
    const theirs = s.partner.find((r) => r.role === role && r.kind === 'split');
    const chip = (r: SplitRow | undefined, name: string, day: string | null, own: boolean) =>
      r ? (
        <Chip
          small
          selected={r.done}
          disabled={!own}
          onClick={() =>
            own && void (r.done ? act.uncheck(r.lineId, r.side) : act.check(r.lineId, r.side))
          }
        >
          {copy.chip(name, day ? formatDot(day) : '', man(r.doneAmount ?? r.amount))}
        </Chip>
      ) : null;
    return (
      <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
        {chip(mine, s.myName, s.myPayday, true)}
        {chip(theirs, v.partnerName, s.partnerPayday, false)}
      </span>
    );
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={v.partial ? copy.firstTitle : copy.planTitle(v.month)}
        backLabel={copy.back}
        onBack={() => nav('/')}
      />
      <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
        <span className="hg-help">
          {copy.period(formatDot(v.cycle.start), formatDot(v.cycle.end))}
        </span>
        {v.temp && !v.solo && <Badge kind="temp">{copy.temp}</Badge>}
      </div>
      {progress && (
        <p style={{ margin: 0 }}>
          <b>{progress}</b>
        </p>
      )}
      <section className="hg-stack" aria-label={copy.flowLabel}>
        <div
          className="hg-stackbar"
          role="img"
          aria-label={flow.map((f) => `${f.name} ${m(f.value)}`).join(', ')}
        >
          {flow.map((f) => (
            <span key={f.name} style={{ flex: Math.max(f.value, 0), background: f.color }} />
          ))}
        </div>
        <div className="hg-breakdown">
          {flow.map((f) => (
            <div key={f.name} className="hg-breakdown__row">
              <span className="hg-breakdown__name">
                <i style={{ background: f.color }} />
                {f.name}
              </span>
              <span className="hg-breakdown__val">
                {m(f.value)}
                {pct(f.value) !== null && <em>{pct(f.value)}%</em>}
              </span>
            </div>
          ))}
        </div>
      </section>
      {notes.map((t) => (
        // 5번 특이사항(들어오는 돈) → W-07
        <button
          key={t}
          type="button"
          className="hg-card hg-card--raised"
          onClick={() => nav('/plan/income')}
        >
          <span>{t}</span>
        </button>
      ))}
      <section className="hg-stack" aria-label={copy.plannedLabel}>
        <SectionHeader title={copy.plannedLabel} />
        <div className="hg-list">
          {ROLE_KEYS.map((role) => (
            <ListRow
              key={role}
              label={copy.roles[role] ?? role}
              sub={
                <span className="hg-row" style={{ gap: 'var(--space-3)' }}>
                  {chips(role)}
                  {/* 6번 금액 → W-01a 이번 달만 바꾸기(이미 옮긴 줄은 못 바꿈). 칩이 버튼이라 줄 전체를 버튼으로 두지 않음 */}
                  {v.adjust.can(role) && (
                    <button
                      type="button"
                      className="hg-btn hg-btn--link"
                      aria-label={copy.editLink(copy.roles[role] ?? role)}
                      onClick={() => nav(`/plan/edit/${role}`)}
                    >
                      {copy.editShort}
                    </button>
                  )}
                </span>
              }
              value={m(plan[role])}
            />
          ))}
          <ListRow label={copy.flow.allowance} value={m(v.allowance)} />
        </div>
      </section>
      <div className="hg-row" style={{ gap: 'var(--space-3)' }}>
        {v.hasSplit && v.pendingSplit.count > 0 && (
          <Button variant="primary" onClick={() => nav('/plan/split')}>
            {copy.splitButton}
          </Button>
        )}
        <button type="button" className="hg-btn hg-btn--link" onClick={() => nav('/assets/money')}>
          {copy.editMoney}
        </button>
        <button type="button" className="hg-btn hg-btn--link" onClick={() => nav('/plan/income')}>
          {copy.incomeTitle}
        </button>
      </div>
    </div>
  );
  return <MainFrame current="month" columns={[body]} />;
}
