import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { W04End } from './pages/w-04-end';
import { W04aStart } from './pages/w-04a-start';
import { W04gSummary } from './pages/w-04g-summary';
import { W04jSpendEntry } from './pages/w-04j-spend-entry';
import { W04kSavings } from './pages/w-04k-savings';

// /month/close/:step → 월말 정리 화면. 단계 id = 기획서 화면 ID(소문자).
const STEPS: Record<string, () => ReactNode> = {
  'w-04a': () => <W04aStart />,
  'w-04j': () => <W04jSpendEntry mode="close" />,
  'w-04k': () => <W04kSavings />,
  'w-04g': () => <W04gSummary />,
  'w-04-end': () => <W04End />,
};

export function CloseRoute() {
  const { step = 'w-04a' } = useParams();
  const render = STEPS[step];
  return render ? <div key={step}>{render()}</div> : <Navigate to="/month/close/w-04a" replace />;
}
