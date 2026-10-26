import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { keepFreed } from '../freed';
import { G03aGoalAdd } from '../pages/g-03a-goal-add';
import { G03bGoalQuestion } from '../pages/g-03b-goal-question';
import { G03cGoalDeadline } from '../pages/g-03c-goal-deadline';
import { G03dGoalHeld } from '../pages/g-03d-goal-held';
import { G03eGoalOwner } from '../pages/g-03e-goal-owner';
import { G03fGoalConfirm } from '../pages/g-03f-goal-confirm';

// /goals/new → G-03a, /goals/new/q1 … → G-03b, deadline → c, held → d, owner → e, confirm → f.
// ?freed=금액(G-05 매달 넣던 돈 → 새 목표)이면 추가할 때 그 목표 저금 줄에 넣음
export function GoalAddRoute() {
  const { step } = useParams();
  const [params] = useSearchParams();
  const freed = Number(params.get('freed') ?? '0');
  useEffect(() => {
    if (freed > 0) keepFreed(freed);
  }, [freed]);
  if (!step) return <G03aGoalAdd />;
  const q = /^q(\d+)$/.exec(step);
  if (q) return <G03bGoalQuestion key={step} index={Number(q[1])} />;
  if (step === 'deadline') return <G03cGoalDeadline />;
  if (step === 'held') return <G03dGoalHeld />;
  if (step === 'owner') return <G03eGoalOwner />;
  if (step === 'confirm') return <G03fGoalConfirm />;
  return <Navigate to="/goals/new" replace />;
}
