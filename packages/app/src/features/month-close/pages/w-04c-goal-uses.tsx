import { answerGoalGap } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { Badge, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath } from '../data';
import { useDetailData } from '../detail';

const NOT_GOAL = 'not_goal';

// W-04c 목표에서 쓴 돈(꼼꼼 모드). 이번 사이클 기록 카드(챙길 날, 결혼 비용 결제, 매년 목표 사용)를 확인만 하고
// 목표자금(예비부부는 결혼 준비) 통장이 기록보다 더 줄었을 때만 차액 1질문: 공동 목표(달성한 목표 포함) 또는
// ‘목표에서 쓴 돈이 아니에요’. 기록·차액 모두 없으면 건너뜀.
export function W04cGoalUses() {
  const nav = useNavigate();
  const d = useDetailData();
  const [phase, setPhase] = useState<'records' | 'gap'>('records');
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  if (d.skip('w-04c') || !d.closeId) return <Navigate to={closePath(d.nextOf('w-04c'))} replace />;
  const closeId = d.closeId;
  const showGap = d.gap > 0 && (phase === 'gap' || d.records.length === 0);
  const goalName = (id: string) => d.goals.find((g) => g.id === id)?.name ?? '';
  const done = () => nav(closePath(d.nextOf('w-04c')));

  const answer = async (v: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await answerGoalGap(closeId, d.gap, v === NOT_GOAL ? null : v);
      await d.refreshDetail();
      setSaving(false);
      done();
    } catch {
      setSaving(false);
      toast(copy.saveFailed);
    }
  };

  if (showGap)
    return (
      <QuestionLayout
        steps={d.progress('w-04c')}
        title={copy.gapTitle(readWon(d.gap))}
        help={copy.gapHelp(readWon(d.gap))}
        onBack={() => (d.records.length ? setPhase('records') : nav(closePath(d.prevOf('w-04c'))))}
      >
        <ChoiceCards<string>
          label={copy.gapTitle(readWon(d.gap))}
          options={[
            ...d.goals
              .filter((g) => !g.after_marriage)
              .map((g) => ({
                value: g.id,
                label: g.name,
                tag: g.status === 'achieved' ? copy.achieved : undefined,
              })),
            { value: NOT_GOAL, label: copy.notGoal },
          ]}
          value={d.close?.goal_gap_not_goal ? NOT_GOAL : (d.close?.goal_gap_goal_id ?? null)}
          onChange={() => undefined}
          onPick={(v) => void answer(v)}
          autoAdvance
        />
      </QuestionLayout>
    );

  return (
    <QuestionLayout
      steps={d.progress('w-04c')}
      title={copy.usesTitle}
      onBack={() => nav(closePath(d.prevOf('w-04c')))}
      primary={{ label: copy.usesRight }}
      onSubmit={() => (d.gap > 0 ? setPhase('gap') : done())}
    >
      <ul className="hg-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {d.records.map((u) => (
          <li key={u.id} className="hg-card hg-stack" style={{ gap: 'var(--space-1)' }}>
            <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <b>{u.careName ?? goalName(u.goalId)}</b>
              {u.careName && <Badge kind="goal">{goalName(u.goalId)}</Badge>}
            </span>
            <span className="hg-card__meta">
              {(copy.paidFrom[u.paidFrom] ?? copy.paidFrom.goal_fund)?.(readWon(u.amount))}
            </span>
          </li>
        ))}
      </ul>
    </QuestionLayout>
  );
}
