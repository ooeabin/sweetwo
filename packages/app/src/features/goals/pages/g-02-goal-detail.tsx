import { formatDateFull, formatYm } from '@sweetwo/core';
import { Button, ListRow, Menu, PageHeader, SectionHeader, type MenuAction } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { canAchieve, goalUsePath } from '../achieve';
import { GoalArt } from '../goal-art';
import { GoalBadges, GoalMeter, Owners } from '../goal-card';
import { useGoalChange } from '../goal-change';
import { ProposalInline } from '../../proposals';

const SHOWN = 12;

// G-02 목표 상세(docs/spec/22-goals.md G-02). 헤더(이름, 상태, ⋯, 그림) + 제안 중 카드 + 진행 + 숫자 블록 + 월별 기록 + 정보.
// ⋯ = 이름 변경(바로), 보류·다시 모으기, 삭제(비상금 없음). 목표 금액·기한을 누르면 목표 수정. 연결된 부부는 제안.
// 진행 그래프, 월별 막대, 보유액 자세히, 목표 사진, 좁은 창 BottomSheet는 다음 단계.
export function G02GoalDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useGoalsData();
  const { masked } = useMask();
  const [more, setMore] = useState(false);
  const change = useGoalChange(d);
  const m = (v: number) => money(v, masked);
  const v = d.view;
  const g = v?.lines.find((x) => x.id === id);
  const back = () => nav('/goals');

  let body = <div />;
  if (d.failed) {
    body = (
      <div className="hg-card hg-stack">
        <p className="hg-card__meta">{copy.loadFailed}</p>
        <Button variant="primary" onClick={d.retry}>
          {copy.retry}
        </Button>
      </div>
    );
  } else if (v && g) {
    const names = {
      1: v.couple.starter ? v.couple.myName : v.couple.partnerName,
      2: v.couple.starter ? v.couple.partnerName : v.couple.myName,
    } as const;
    const once = g.kind === 'once';
    const row = d.goals.find((x) => x.id === id);
    const edit = (field: string) => nav(`/goals/${id}/edit/${field}`);
    const paused = g.status === 'paused';
    const actions: MenuAction[] = [
      { label: copy.rename, icon: 'pencil', onSelect: () => edit('name') },
      {
        label: paused ? copy.resume : copy.pause,
        onSelect: () => row && void change.send(row, { item: 'goal_pause', value: !paused }),
      },
      ...(g.template === 'emergency'
        ? []
        : [
            {
              label: copy.remove,
              icon: 'trash-2' as const,
              danger: true,
              onSelect: () =>
                row &&
                void change.send(row, { item: 'goal_delete' }).then((ok) => {
                  if (ok && !d.connected) back();
                }),
            },
          ]),
    ];
    const proposals = d.openProposals.filter((p) => p.target_id === id);
    const pnames = {
      myId: d.me?.id ?? '',
      myName: v.couple.myName,
      partnerName: v.couple.partnerName,
      starter: v.couple.starter,
    };
    const EDIT: Record<string, string> = {
      [copy.numbers.target]: 'amount',
      [copy.numbers.deadline]: 'deadline',
    };
    const numbers: [string, string][] = [
      ...(g.kind !== 'monthly' && g.target !== null
        ? ([
            [copy.numbers.target, m(g.target)],
            [copy.numbers.held, m(g.held)],
            [copy.numbers.left, m(Math.max(g.target - g.held, 0))],
          ] as [string, string][])
        : [[copy.numbers.held, m(g.held)] as [string, string]]),
      [copy.numbers.alloc, m(g.alloc)],
      ...(g.kind === 'yearly' && g.nextUse
        ? ([[copy.numbers.deadline, copy.nextUse(formatYm(g.nextUse))]] as [string, string][])
        : once && g.deadline
          ? ([[copy.numbers.deadline, formatYm(g.deadline)]] as [string, string][])
          : []),
      ...(once && g.target !== null
        ? ([[copy.numbers.expected, g.expected ? formatYm(g.expected) : copy.planUnknown]] as [
            string,
            string,
          ][])
        : []),
    ];
    const rows = more ? g.months : g.months.slice(0, SHOWN);
    const diff = (n: number) => (n > 0 ? `+${m(n)}` : n < 0 ? `−${m(-n)}` : m(0));
    body = (
      <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
        <PageHeader
          title={g.name}
          backLabel={copy.back}
          onBack={back}
          action={<Menu label={copy.menu} actions={actions} />}
        />
        {proposals.map((p) => (
          <ProposalInline
            key={p.id}
            p={p}
            names={pnames}
            goals={d.goals}
            onDifferent={
              p.item === 'goal_amount' || p.item === 'goal_deadline'
                ? () => edit(p.item === 'goal_amount' ? 'amount' : 'deadline')
                : undefined
            }
          />
        ))}
        {g.status === 'achieved' && canAchieve(g) && (
          <div className="hg-banner hg-banner--info">
            <span>{copy.achievedHeld(m(g.held))}</span>
            <Button variant="secondary" size="sm" onClick={() => nav(goalUsePath(id))}>
              {copy.usedAsk}
            </Button>
          </div>
        )}
        {g.status === 'used' && (
          <div className="hg-banner hg-banner--info">
            <span>{copy.usedSpent(m(g.spent))}</span>
          </div>
        )}
        {paused && (
          <div className="hg-banner hg-banner--info">
            <span>{copy.pausedNote}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={change.busy}
              onClick={() => row && void change.send(row, { item: 'goal_pause', value: false })}
            >
              {copy.resume}
            </Button>
          </div>
        )}
        <section className="hg-card hg-card--art hg-stack" aria-label={g.name}>
          <span className="hg-card__top">
            <GoalBadges g={g} />
          </span>
          <GoalArt g={g} />
          {g.kind !== 'monthly' && <GoalMeter g={g} masked={masked} />}
        </section>
        <div className="hg-cards">
          {numbers.map(([label, value]) => {
            const inner = (
              <>
                <span className="hg-card__label">{label}</span>
                <span className="hg-card__value">{value}</span>
                {label === copy.numbers.held && (
                  <span className="hg-card__meta">
                    {copy.heldFrom(m(g.otherHeld), m(g.linked), m(g.deposits))}
                  </span>
                )}
              </>
            );
            // 목표 금액·기한 → 목표 수정
            const to = EDIT[label];
            return to ? (
              <button
                key={label}
                type="button"
                className="hg-card hg-card--raised"
                onClick={() => edit(to)}
              >
                {inner}
              </button>
            ) : (
              <div key={label} className="hg-card">
                {inner}
              </div>
            );
          })}
        </div>
        <section className="hg-stack" aria-label={copy.records}>
          <SectionHeader title={copy.records} />
          {g.months.length ? (
            <div className="hg-list">
              {rows.map((r) => (
                <ListRow
                  key={r.month}
                  label={formatYm(r.month)}
                  sub={copy.recordPlan(m(r.plan))}
                  value={
                    r.rested && r.actual === null ? (
                      copy.rested
                    ) : r.actual === null ? (
                      copy.notClosed
                    ) : (
                      <>
                        {copy.recordActual(m(r.actual))}{' '}
                        <span className="hg-tag">{diff(r.diff ?? 0)}</span>
                      </>
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.noRecords}
            </p>
          )}
          {g.months.length > SHOWN && !more && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setMore(true)}
            >
              {copy.more}
            </button>
          )}
        </section>
        <section className="hg-stack" aria-label={copy.info}>
          <SectionHeader title={copy.info} />
          <div className="hg-list">
            <ListRow
              label={copy.ownerLabel}
              value={
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  <Owners g={g} names={names} />
                  {g.owners.length === 2 ? copy.together : names[g.owners[0] ?? 1]}
                </span>
              }
            />
            <ListRow label={copy.createdAt} value={formatDateFull(g.createdAt.slice(0, 10))} />
          </div>
        </section>
      </div>
    );
  } else if (v) {
    return <Navigate to="/goals" replace />; // 없는 목표(지웠거나 잘못된 주소)
  }

  return <MainFrame current="goals" columns={[body]} />;
}
