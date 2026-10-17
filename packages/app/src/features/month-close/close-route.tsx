import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { W04End } from './pages/w-04-end';
import { W04aStart } from './pages/w-04a-start';
import { W04a2Income } from './pages/w-04a2-income';
import { W04bBalance } from './pages/w-04b-balance';
import { W04cGoalUses } from './pages/w-04c-goal-uses';
import { W04dEmergency } from './pages/w-04d-emergency';
import { W04eInvest } from './pages/w-04e-invest';
import { W04fLoan } from './pages/w-04f-loan';
import { W04iTalk } from './pages/w-04i-talk';
import { W04gSummary } from './pages/w-04g-summary';
import { W04hAdjust } from './pages/w-04h-adjust';
import { W04jSpendEntry } from './pages/w-04j-spend-entry';
import { W04kSavings } from './pages/w-04k-savings';

// /month/close/:step → 월말 정리 화면. 단계 id = 기획서 화면 ID(소문자).
const STEPS: Record<string, () => ReactNode> = {
  'w-04a': () => <W04aStart />,
  'w-04a2': () => <W04a2Income />,
  'w-04j': () => <W04jSpendEntry mode="close" />,
  'w-04k': () => <W04kSavings />,
  'w-04h': () => <W04hAdjust />,
  'w-04g': () => <W04gSummary />,
  // 꼼꼼 모드(‘더 꼼꼼히 정리하기’)
  'w-04b': () => <W04bBalance />,
  'w-04c': () => <W04cGoalUses />,
  'w-04d': () => <W04dEmergency />,
  'w-04e': () => <W04eInvest />,
  'w-04f': () => <W04fLoan />,
  'w-04i': () => <W04iTalk />,
  'w-04-end': () => <W04End />,
};

export function CloseRoute() {
  const { step = 'w-04a' } = useParams();
  const render = STEPS[step];
  return render ? <div key={step}>{render()}</div> : <Navigate to="/month/close/w-04a" replace />;
}
