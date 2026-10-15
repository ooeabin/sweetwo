import { Button, EmptyState } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { GoalCard } from '../goal-card';

// G-01 목표 목록(docs/spec/22-goals.md G-01). 요약 + 진행 중 카드(배분 순서, 비상금 맨 위) + 접힌 목록(보류·달성·사용 완료).
// 목표 추가(G-03a), 순서 바꾸기(G-06), 조정하기(G-04)는 다음 단계라 자리만. 요약 막대는 다음 단계.
export function G01GoalList() {
  const nav = useNavigate();
  const d = useGoalsData();
  const { masked } = useMask();
  const [unfold, setUnfold] = useState(false);
  const m = (v: number) => money(v, masked);
  const v = d.view;

  const actions = (
    <>
      <Button variant="secondary" disabled>
        {copy.reorder}
      </Button>
      <Button variant="primary" disabled>
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
        onOpen={() => nav(`/goals/${g.id}`)}
      />
    );
    const half = Math.ceil(v.open.length / 2);
    columns = !v.lines.length
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
                <Button variant="secondary" size="sm" disabled>
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
