import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { isJoinScreen } from '../pairing';
import { useMe, useSpace } from './data';
import { current, FIRST } from './flow';
import { O03MyNickname } from './pages/o-03-my-nickname';
import { O06InviteNow } from './pages/o-06-invite-now';
import { O07InviteCode } from './pages/o-07-invite-code';
import { O11Marriage } from './pages/o-11-marriage';
import { O30SalaryMode } from './pages/o-30-salary-mode';
import { O31Salary } from './pages/o-31-salary';
import { O32Payday } from './pages/o-32-payday';
import { O60Ready } from './pages/o-60-ready';

// /onboarding/:screen → 화면 파일. 화면 id = 기획서 화면 ID(소문자).
// 2026-11-10 QA 2구간: O-10·O-12·O-13을 뺌(옛 주소와 멈춘 기록은 flow.ts current로 옮김)
const SCREENS: Record<string, () => ReactNode> = {
  'o-03': () => <O03MyNickname />,
  'o-06': () => <O06InviteNow />,
  'o-07': () => <O07InviteCode />,
  'o-11': () => <O11Marriage />,
  'o-30': () => <O30SalaryMode />,
  'o-31': () => <O31Salary />,
  'o-32': () => <O32Payday />,
  'o-60': () => <O60Ready />,
};

export const isOnboardingScreen = (id: string) => current(id) in SCREENS;

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
  const { screen = FIRST } = useParams();
  const me = useMe();
  markSeen();
  // 온보딩을 마친 뒤 뒤로(하드웨어 뒤로, 웹뷰 기록)로 돌아오면 홈으로(2026-11-10 S2-01: 끝난 온보딩 화면을 다시 열지 않음)
  if (me.data?.onboarding_done_at) return <Navigate to="/" replace />;
  if (current(screen) !== screen) return <Navigate to={`/onboarding/${current(screen)}`} replace />;
  const render = SCREENS[screen];
  return render ? (
    <div key={screen}>{render()}</div>
  ) : (
    <Navigate to={`/onboarding/${FIRST}`} replace />
  );
}

// 이번 실행에서 이어하기를 이미 기록했는지(앱을 다시 열 때만 한 번)
let resumed = false;

/**
 * 온보딩을 마치지 않았으면 가장 멀리 간 화면으로 바로(이어하기, 2026-11-10 Q4: “이어서 할까요?” 질문 화면은 없앰).
 * 파트너가 이미 합류했으면 초대(O-06·O-07)는 건너뛰고 O-11로. 모르는 화면 ID면 그대로 둔다
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const space = useSpace();
  // 모든 화면을 감싸는 문이라 뼈대 없이(어느 화면 모양인지 모름, 보통 A-01에서 이미 불러옴)
  if (me.isLoading) return null;
  let step = current(me.data?.onboarding_step ?? FIRST);
  const open = !!me.data && !me.data.onboarding_done_at;
  if (open && isOnboardingScreen(step) && space.isLoading) return null;
  if ((step === 'o-06' || step === 'o-07') && space.data?.couple_state === 'connected')
    step = 'o-11';
  const to =
    open && isOnboardingScreen(step)
      ? `/onboarding/${step}`
      : open && isJoinScreen(step)
        ? `/join/${step}`
        : null;
  if (!to) return <>{children}</>;
  if (!resumed && step !== FIRST && isOnboardingScreen(step)) {
    resumed = true;
    track('onboarding_resumed', {
      screen_id: step.toUpperCase(),
      hours_since_last: hoursSinceSeen(),
    });
  }
  return <Navigate to={to} replace />;
}
