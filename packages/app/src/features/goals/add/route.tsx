import { Navigate, useParams } from 'react-router-dom';
import { G03aGoalAdd } from '../pages/g-03a-goal-add';
import { G03bGoalQuestion } from '../pages/g-03b-goal-question';
import { G03cGoalDeadline } from '../pages/g-03c-goal-deadline';
import { G03dGoalHeld } from '../pages/g-03d-goal-held';
import { G03eGoalOwner } from '../pages/g-03e-goal-owner';
import { G03fGoalConfirm } from '../pages/g-03f-goal-confirm';

// /goals/new → G-03a, /goals/new/q1 … → G-03b, deadline → c, held → d, owner → e, confirm → f
export function GoalAddRoute() {
  const { step } = useParams();
  if (!step) return <G03aGoalAdd />;
  const q = /^q(\d+)$/.exec(step);
  if (q) return <G03bGoalQuestion key={step} index={Number(q[1])} />;
  if (step === 'deadline') return <G03cGoalDeadline />;
  if (step === 'held') return <G03dGoalHeld />;
  if (step === 'owner') return <G03eGoalOwner />;
  if (step === 'confirm') return <G03fGoalConfirm />;
  return <Navigate to="/goals/new" replace />;
}
