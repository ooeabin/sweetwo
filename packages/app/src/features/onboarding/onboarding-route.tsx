import { QuestionLayout } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { copy } from './copy';
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

// 온보딩 화면을 마지막으로 본 시각(분석 onboarding_resumed hours_since_last). 이 기기에만
const SEEN_KEY = 'sweetwo.onboardingSeenAt';
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* 기억 못 해도 됨 */
  }
};
const hoursSinceSeen = () => {
  try {
    const t = Number(localStorage.getItem(SEEN_KEY));
    return t ? Math.max(0, Math.floor((Date.now() - t) / 3_600_000)) : 0;
  } catch {
    return 0;
  }
};

export function OnboardingRoute() {
  const { screen = 'o-10' } = useParams();
  markSeen();
  const m = /^o-23-(\d+)$/.exec(screen);
  if (m) return <O23GoalQuestion key={screen} index={Number(m[1])} />;
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/onboarding/o-10" replace />;
}

// 이번 실행에서 이미 물었는지(앱을 다시 열 때만 한 번)
let asked = false;

/**
 * 온보딩을 마치지 않았으면 멈춘 화면으로(이어하기). 모르는 화면 ID면 그대로 둔다.
 * 앱을 다시 열어 첫 화면(O-10)이 아닌 곳에 멈춰 있으면 먼저 “이어서 할까요?”(16·12) → 멈춘 화면부터
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const nav = useNavigate();
  if (me.isLoading) return null;
  const step = me.data?.onboarding_step?.toLowerCase() ?? 'o-10';
  const open = !!me.data && !me.data.onboarding_done_at;
  const to =
    open && isOnboardingScreen(step)
      ? `/onboarding/${step}`
      : open && isJoinScreen(step)
        ? `/join/${step}`
        : null;
  if (!to) return <>{children}</>;
  // 합류 중(P-)은 묻지 않고 그 화면부터(18 ‘이어서’)
  if (step === 'o-10' || asked || !isOnboardingScreen(step)) return <Navigate to={to} replace />;
  return (
    <QuestionLayout
      title={copy.resumeQ}
      help={copy.resumeHelp}
      primary={{ label: copy.resumeGo }}
      onSubmit={() => {
        asked = true;
        track('onboarding_resumed', {
          screen_id: step.toUpperCase(),
          hours_since_last: hoursSinceSeen(),
        });
        nav(to, { replace: true });
      }}
    />
  );
}
