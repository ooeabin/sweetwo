import { Button, EmptyState } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { GoalCard } from '../goal-card';

// G-01 목표 목록(docs/spec/22-goals.md G-01). 요약 + 진행 중 카드(배분 순서, 비상금 맨 위) + 접힌 목록(보류·달성·사용 완료).
// 열린 제안이 있는 목표는 “제안 중” 배지(누르면 G-02의 제안 중 카드).
export function G01GoalList() {
  const nav = useNavigate();
  const d = useGoalsData();
  const { masked } = useMask();
  const [unfold, setUnfold] = useState(false);
  const m = (v: number) => money(v, masked);
  const v = d.view;

  const actions = (
    <>
      <Button variant="secondary" onClick={() => nav('/goals/order')}>
        {copy.reorder}
      </Button>
      <Button variant="primary" onClick={() => nav('/goals/new')}>
        {copy.add}
      </Button>
    </>
  );

  let columns = [<div key="l" />];
  if (d.failed) {
    columns = [
      <div key="l" className="hg-card hg-stack">
        <p className="hg-card__meta">{copy.loadFailed}</p>
        <Button variant="primary" onClick={d.retry}>
          {copy.retry}
        </Button>
      </div>,
    ];
  } else if (v) {
    const names = {
      1: v.couple.starter ? v.couple.myName : v.couple.partnerName,
      2: v.couple.starter ? v.couple.partnerName : v.couple.myName,
    } as const;
    const card = (g: (typeof v.lines)[number]) => (
      <GoalCard
        key={g.id}
        g={g}
        names={names}
        masked={masked}
        m={m}
        proposing={d.openProposals.some((p) => p.target_id === g.id)}
        onOpen={() => nav(g.template === 'wedding' ? '/goals/wedding' : `/goals/${g.id}`)}
      />
    );
    const half = Math.ceil(v.open.length / 2);
    columns =
      !v.open.length && !v.folded.length
        ? [<EmptyState key="e" title={copy.empty} />]
        : [
            <div key="l" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
              <section className="hg-card" aria-label={copy.summary(m(v.monthly))}>
                <p style={{ margin: 0 }}>
                  <b>{copy.summary(m(v.monthly))}</b>
                </p>
                <p className="hg-card__meta">{copy.saveable(m(v.saveable))}</p>
              </section>
              {v.shortfall > 0 && (
                <div className="hg-banner hg-banner--info">
                  <span>{copy.short(m(v.shortfall))}</span>
                  <Button variant="secondary" size="sm" onClick={() => nav('/goals/adjust')}>
                    {copy.adjust}
                  </Button>
                </div>
              )}
              {v.open.slice(0, half).map(card)}
            </div>,
            <div key="r" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
              {v.open.slice(half).map(card)}
              {v.folded.length > 0 && (
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  style={{ alignSelf: 'flex-start' }}
                  aria-expanded={unfold}
                  onClick={() => setUnfold((x) => !x)}
                >
                  {copy.folded(v.folded.length)}
                </button>
              )}
              {unfold && v.folded.map(card)}
            </div>,
          ];
  }

  return <MainFrame current="goals" page={{ title: copy.title, actions }} columns={columns} />;
}
