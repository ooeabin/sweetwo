import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useMe } from './data';
import { O03MyNickname } from './pages/o-03-my-nickname';
import { O04Side } from './pages/o-04-side';
import { O05PartnerNickname } from './pages/o-05-partner-nickname';
import { O06InviteNow } from './pages/o-06-invite-now';
import { O07InviteCode } from './pages/o-07-invite-code';
import { O10Part1Intro } from './pages/o-10-part1-intro';
import { O11Marriage } from './pages/o-11-marriage';
import { O12WeddingDate } from './pages/o-12-wedding-date';
import { O13BirthYear } from './pages/o-13-birth-year';
import { O15Housing } from './pages/o-15-housing';
import { O16Employment } from './pages/o-16-employment';
import { O18ChildPlan } from './pages/o-18-child-plan';
import { O19aWeddingBudget } from './pages/o-19a-wedding-budget';
import { O19bFamilySupport } from './pages/o-19b-family-support';
import { O19cWeddingSaved } from './pages/o-19c-wedding-saved';
import { O19dNewlywedHome } from './pages/o-19d-newlywed-home';
import { O19ePrepMode } from './pages/o-19e-prep-mode';
import { O20Part2Intro } from './pages/o-20-part2-intro';
import { O21Goals } from './pages/o-21-goals';
import { O23GoalQuestion } from './pages/o-23-goal-question';
import { O24GoalDeadline } from './pages/o-24-goal-deadline';

// /onboarding/:screen → 화면 파일. 화면 id = 기획서 화면 ID(소문자).
const SCREENS: Record<string, () => ReactNode> = {
  'o-03': () => <O03MyNickname />,
  'o-04': () => <O04Side />,
  'o-05': () => <O05PartnerNickname />,
  'o-06': () => <O06InviteNow />,
  'o-07': () => <O07InviteCode />,
  'o-10': () => <O10Part1Intro />,
  'o-11': () => <O11Marriage />,
  'o-12': () => <O12WeddingDate />,
  'o-13': () => <O13BirthYear />,
  'o-15': () => <O15Housing />,
  'o-16': () => <O16Employment />,
  'o-18': () => <O18ChildPlan />,
  'o-19a': () => <O19aWeddingBudget />,
  'o-19b': () => <O19bFamilySupport />,
  'o-19c': () => <O19cWeddingSaved />,
  'o-19d': () => <O19dNewlywedHome />,
  'o-19e': () => <O19ePrepMode />,
  'o-20': () => <O20Part2Intro />,
  'o-21': () => <O21Goals />,
  'o-24': () => <O24GoalDeadline />,
};

export const isOnboardingScreen = (id: string) => id in SCREENS || /^o-23-\d+$/.test(id);

export function OnboardingRoute() {
  const { screen = 'o-03' } = useParams();
  const m = /^o-23-(\d+)$/.exec(screen);
  if (m) return <O23GoalQuestion key={screen} index={Number(m[1])} />;
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/onboarding/o-03" replace />;
}

/** 온보딩을 마치지 않았으면 멈춘 화면으로(이어하기). 아직 없는 화면(파트 3~)이면 그대로 둔다. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isLoading) return null;
  const step = me.data?.onboarding_step?.toLowerCase() ?? 'o-03';
  if (me.data && !me.data.onboarding_done_at && isOnboardingScreen(step)) {
    return <Navigate to={`/onboarding/${step}`} replace />;
  }
  return <>{children}</>;
}
