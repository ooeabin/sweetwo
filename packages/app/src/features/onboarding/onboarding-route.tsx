import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { isJoinScreen } from '../pairing';
import { useMe, useSpace } from './data';
import { firstSavingPath } from './first-saving-resume';
import { current, FIRST } from './flow';
import { justFinishedTo } from './step';
import { O03MyNickname } from './pages/o-03-my-nickname';
import { O11Relation } from './pages/o-11-relation';
import { O30SharedLiving } from './pages/o-30-shared-living';
import { O30bSharedSaving } from './pages/o-30b-shared-saving';
import { O30cManager } from './pages/o-30c-manager';
import { O31Salary } from './pages/o-31-salary';
import { O32Payday } from './pages/o-32-payday';
import { O55Push } from './pages/o-55-push';
import { O60Ready } from './pages/o-60-ready';

// /onboarding/:screen → 화면 파일. 화면 id = 기획서 화면 ID(소문자).
// 2026-11-10 QA 2구간: O-10·O-12·O-13을 뺌, 2026-11-13 O-06 초대 화면을 뺌(옛 주소와 멈춘 기록은 flow.ts current로 옮김).
// O-07 초대 시트는 첫 저금 직후 홈 위(/welcome, routes)
const SCREENS: Record<string, () => ReactNode> = {
  'o-03': () => <O03MyNickname />,
  'o-11': () => <O11Relation />,
  'o-30': () => <O30SharedLiving />,
  'o-30b': () => <O30bSharedSaving />,
  'o-30c': () => <O30cManager />,
  'o-31': () => <O31Salary />,
  'o-32': () => <O32Payday />,
  'o-55': () => <O55Push />,
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
  // 첫 저금 흐름(O-60 뒤 W-11)을 마치지 않고 앱을 닫았으면 멈춘 단계로(2026-11-13 실구동)
  if (screen === 'resume' && me.data?.onboarding_done_at) {
    const saving = firstSavingPath();
    if (saving) {
      track('onboarding_resumed', { screen_id: 'W-11', hours_since_last: hoursSinceSeen() });
      return <Navigate to={saving} replace />;
    }
  }
  // 온보딩을 마친 뒤 뒤로(하드웨어 뒤로, 웹뷰 기록)로 돌아오면 홈으로(2026-11-10 S2-01: 끝난 온보딩 화면을 다시 열지 않음)
  if (me.data?.onboarding_done_at) return <Navigate to={justFinishedTo() ?? '/'} replace />;
  // /onboarding/resume(홈 띠 waiting_joiner, core pickTopTask): 가장 멀리 간 화면으로(2026-11-13)
  if (screen === 'resume') {
    if (me.isLoading) return null;
    const at = current(me.data?.onboarding_step ?? FIRST);
    return <Navigate to={`/onboarding/${isOnboardingScreen(at) ? at : FIRST}`} replace />;
  }
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
// 이번 실행에서 첫 저금 흐름 이어하기를 이미 했는지(홈으로 들어올 때 한 번만)
let savingResumeChecked = false;

/**
 * 온보딩을 마치지 않았으면 가장 멀리 간 화면으로 바로(이어하기, 2026-11-10 Q4: “이어서 할까요?” 질문 화면은 없앰).
 * 예전 O-06·O-07에 멈춘 사람은 O-11로(flow current). 모르는 화면 ID면 그대로 둔다
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const space = useSpace();
  const loc = useLocation();
  // 첫 저금 흐름 이어하기는 실행마다 한 번: 그린 뒤(커밋) 표시해 두 번 그리기(StrictMode)에도 Navigate가 남게
  const savingResume =
    !savingResumeChecked &&
    !!me.data?.onboarding_done_at &&
    loc.pathname === '/' &&
    firstSavingPath() !== null;
  useEffect(() => {
    if (me.data) savingResumeChecked = true;
  }, [me.data]);
  // 모든 화면을 감싸는 문이라 뼈대 없이(어느 화면 모양인지 모름, 보통 A-01에서 이미 불러옴)
  if (me.isLoading) return null;
  const step = current(me.data?.onboarding_step ?? FIRST);
  const open = !!me.data && !me.data.onboarding_done_at;
  if (open && isOnboardingScreen(step) && space.isLoading) return null;
  const to =
    open && isOnboardingScreen(step)
      ? `/onboarding/${step}`
      : open && isJoinScreen(step)
        ? `/join/${step}`
        : null;
  if (!to) {
    // 온보딩은 마쳤지만 첫 저금 흐름(W-11)을 마치지 않고 앱을 닫았으면 실행 뒤 홈에서 한 번 /onboarding/resume으로
    if (savingResume) return <Navigate to="/onboarding/resume" replace />;
    return <>{children}</>;
  }
  if (!resumed && step !== FIRST && isOnboardingScreen(step)) {
    resumed = true;
    track('onboarding_resumed', {
      screen_id: step.toUpperCase(),
      hours_since_last: hoursSinceSeen(),
    });
  }
  return <Navigate to={to} replace />;
}
