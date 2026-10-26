import { Button, SectionHeader } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { GoalItemCard } from '../goal-item-card';
import { useGoalsModel, type GoalItem } from '../model';

// G-01 목표 목록(22). 상단 요약(매달 목표에 모으는 돈) → 묶음(우리 목표 / 내 목표 / 배우자 목표, 비상금은 우리 목표 맨 위)
// → 접힌 목록(보류, 달성, 다 쓴 목표). 혼자 쓰기면 묶음 제목 없이 한 목록. 데스크톱 2열(hg-cards), 좁은 창 1열.
export function G01GoalList() {
  const nav = useNavigate();
  const d = useGoalsModel();
  const { masked } = useMask();
  const [unfold, setUnfold] = useState(false);
  const m = (v: number) => money(v, masked);

  // 순서 바꾸기는 한 묶음에 옮길 목표가 2개 이상일 때만(비상금은 고정)
  const canOrder =
    d.ready &&
    (d.groups.ours.filter((i) => i.goal.template !== 'emergency').length > 1 ||
      d.groups.mine.length > 1);
  const actions = (
    <>
      {canOrder && (
        <Button variant="secondary" onClick={() => nav('/goals/order')}>
          {copy.reorder}
        </Button>
      )}
      <Button variant="primary" onClick={() => nav('/goals/new')}>
        {copy.add}
      </Button>
    </>
  );
  if (!d.ready) {
    const columns = d.failed
      ? [
          <div key="l" className="hg-card hg-stack">
            <p className="hg-card__meta">{copy.loadFailed}</p>
          </div>,
        ]
      : [<div key="l" />];
    return <MainFrame current="goals" page={{ title: copy.title, actions }} columns={columns} />;
  }

  const cards = (list: GoalItem[]) => (
    <div className="hg-cards">
      {list.map((i) => (
        <GoalItemCard
          key={i.goal.id}
          i={i}
          masked={masked}
          onOpen={() =>
            nav(`/goals/${i.goal.id}`)
          }
        />
      ))}
    </div>
  );
  const groups: [string, GoalItem[]][] = d.solo
    ? [['', [...d.groups.ours, ...d.groups.mine]]]
    : [
        [copy.groups.ours, d.groups.ours],
        [copy.groups.mine, d.groups.mine],
        ...(d.joined
          ? [[copy.partnerGroup(d.partnerName), d.groups.partner] as [string, GoalItem[]]]
          : []),
      ];
  const onlyEmergency =
    d.groups.ours.length === 1 &&
    d.groups.ours[0]?.goal.template === 'emergency' &&
    !d.groups.mine.length;

  const column = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <section className="hg-card hg-stack">
        {d.monthlyTotal > 0 ? (
          <b>{copy.monthlySummary(m(d.monthlyTotal))}</b>
        ) : (
          <span className="hg-card__meta">{copy.noSplit}</span>
        )}
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav('/salary/split')}
        >
          {copy.editSplit}
        </button>
      </section>
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([title, list]) => (
          <section key={title || 'all'} className="hg-stack" aria-label={title || copy.title}>
            {title && <SectionHeader title={title} />}
            {cards(list)}
          </section>
        ))}
      {onlyEmergency && (
        <Button variant="secondary" onClick={() => nav('/goals/new')}>
          {copy.onlyEmergency}
        </Button>
      )}
      {d.folded.length > 0 && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          aria-expanded={unfold}
          onClick={() => setUnfold((x) => !x)}
        >
          {copy.foldedNew(d.folded.length)}
        </button>
      )}
      {unfold && cards(d.folded)}
    </div>
  );
  return <MainFrame current="goals" page={{ title: copy.title, actions }} columns={[column]} />;
}
