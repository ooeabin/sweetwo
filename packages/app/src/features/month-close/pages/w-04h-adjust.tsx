import { formatManWon } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMonthView } from '../../month';
import { ProposalInline, describeProposal, proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { closePath, closeProgress, useCloseData } from '../data';

// W-04h 다음 달 조정(docs/spec/21-month-close.md): 받은 제안·보류 제안·함께 정하기가 있을 때만(연결된 부부, 해제 대기 아님).
// 받은 제안은 좋아요(즉시 확정) / 다르게 해볼래요(G-08) / 반대, 보류 제안과 함께 정하기는 배지와 지금 값.
// 생활비 예산은 읽기 전용(보정은 W-04g 카드에서만), 목표 배분은 목표별 월 배분과 합계 / 저축 가능.
export function W04hAdjust() {
  const nav = useNavigate();
  const d = useCloseData();
  const v = useMonthView();
  if (d.loading || !v) return null;
  if (!d.adjust || !d.couple || !d.me || !d.space)
    return <Navigate to={closePath('w-04g')} replace />;
  const c = d.couple;
  const sp = d.space;
  const names = { myId: d.me.id, myName: c.myName, partnerName: c.partnerName, starter: c.starter };
  const goalNames = d.goals.map((g) => ({ id: g.id, name: g.name }));
  const received = d.proposals.filter((p) => p.status === 'open' && p.proposer !== d.me?.id);
  const together = d.proposals.filter(
    (p) => p.status === 'open' && p.together && p.proposer === d.me?.id,
  );
  const held = d.proposals.filter((p) => p.status === 'held');
  const differ = (item: string) =>
    item === 'split' || item === 'goal_amount' || item === 'goal_deadline';

  // 목표 배분: 이번 플랜의 목표별 월 배분 / 저축 가능(지금 값)
  const allocs = d.goals
    .map((g) => ({
      id: g.id,
      name: g.name,
      alloc: (d.plan?.lines ?? [])
        .filter((l) => l.target === 'goal' && l.goal_id === g.id)
        .reduce((t, l) => t + l.amount, 0),
    }))
    .filter((x) => x.alloc > 0);
  const allocTotal = allocs.reduce((t, x) => t + x.alloc, 0);

  return (
    <QuestionLayout
      wide
      steps={closeProgress('w-04h', true)}
      title={copy.adjustTitle}
      help={copy.startAlone(c.partnerName)}
      onBack={() => nav(closePath('w-04k'))}
      primary={{ label: copy.next }}
      onSubmit={() => nav(closePath('w-04g'))}
    >
      {received.map((p) => (
        <ProposalInline
          key={p.id}
          p={p}
          names={names}
          goals={goalNames}
          onDifferent={differ(p.item) ? () => nav(`/proposals/${p.id}`) : undefined}
        />
      ))}
      {[...together, ...held].map((p) => {
        const line = describeProposal(p, names, goalNames);
        return (
          <section key={p.id} className="hg-card hg-stack" aria-label={line.label}>
            <span className="hg-card__label">
              {p.status === 'held' ? copy.heldBadge : proposalCopy.together}
            </span>
            <p style={{ margin: 0 }}>
              <b>
                {line.label} {proposalCopy.change(line.before, line.after)}
              </b>
            </p>
            <p className="hg-card__meta">
              {p.status === 'held' ? copy.heldNote : copy.togetherAlone(c.partnerName)}
            </p>
          </section>
        );
      })}
      <section className="hg-card hg-row" style={{ justifyContent: 'space-between' }}>
        <span className="hg-card__label">{copy.livingBudget}</span>
        <b>{formatManWon(sp.living_budget ?? 0)}</b>
      </section>
      <section className="hg-card hg-stack" aria-label={copy.allocTitle}>
        <span className="hg-card__label">{copy.allocTitle}</span>
        {allocs.map((l) => (
          <div key={l.id} className="hg-row" style={{ justifyContent: 'space-between' }}>
            <span>{l.name}</span>
            <b>{formatManWon(l.alloc)}</b>
          </div>
        ))}
        <p className="hg-card__meta">
          {copy.allocTotal(formatManWon(allocTotal), formatManWon(v.monthPlan.saveable))}
        </p>
      </section>
    </QuestionLayout>
  );
}
