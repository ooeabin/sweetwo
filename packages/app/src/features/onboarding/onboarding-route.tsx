import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { isJoinScreen } from '../pairing';
import { useMe } from './data';
import { O03MyNickname } from './pages/o-03-my-nickname';
import { O06InviteNow } from './pages/o-06-invite-now';
import { O07InviteCode } from './pages/o-07-invite-code';
import { O10Overview } from './pages/o-10-overview';
import { O11Marriage } from './pages/o-11-marriage';
import { O12WeddingDate } from './pages/o-12-wedding-date';
import { O13BirthYear } from './pages/o-13-birth-year';
import { O21Goals } from './pages/o-21-goals';
import { O23GoalQuestion } from './pages/o-23-goal-question';
import { O24GoalDeadline } from './pages/o-24-goal-deadline';
import { O30SalaryMode } from './pages/o-30-salary-mode';
import { O31Salary } from './pages/o-31-salary';
import { O50Split } from './pages/o-50-split';
import { O60Result } from './pages/o-60-result';

// /onboarding/:screen → 화면 파일. 화면 id = 기획서 화면 ID(소문자).
const SCREENS: Record<string, () => ReactNode> = {
  'o-10': () => <O10Overview />,
  'o-03': () => <O03MyNickname />,
  'o-06': () => <O06InviteNow />,
  'o-07': () => <O07InviteCode />,
  'o-11': () => <O11Marriage />,
  'o-12': () => <O12WeddingDate />,
  'o-13': () => <O13BirthYear />,
  'o-21': () => <O21Goals />,
  'o-24': () => <O24GoalDeadline />,
  'o-30': () => <O30SalaryMode />,
  'o-31': () => <O31Salary />,
  'o-50': () => <O50Split />,
  'o-60': () => <O60Result />,
};

export const isOnboardingScreen = (id: string) => id in SCREENS || /^o-23-\d+$/.test(id);

export function OnboardingRoute() {
  const { screen = 'o-10' } = useParams();
  const m = /^o-23-(\d+)$/.exec(screen);
  if (m) return <O23GoalQuestion key={screen} index={Number(m[1])} />;
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/onboarding/o-10" replace />;
}

/** 온보딩을 마치지 않았으면 멈춘 화면으로(이어하기). 모르는 화면 ID면 그대로 둔다. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isLoading) return null;
  const step = me.data?.onboarding_step?.toLowerCase() ?? 'o-10';
  if (me.data && !me.data.onboarding_done_at && isOnboardingScreen(step)) {
    return <Navigate to={`/onboarding/${step}`} replace />;
  }
  // 합류 중(P-02b~P-08)이면 그 화면부터
  if (me.data && !me.data.onboarding_done_at && isJoinScreen(step)) {
    return <Navigate to={`/join/${step}`} replace />;
  }
  return <>{children}</>;
}
