import { Illustration, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { paths } from '../auth';
import { copy } from './copy';
import { saveMe, useJoinData } from './data';
import { JOIN_REMOVED, joinChapter, joinPath, movedJoinScreen } from './join-step';
import { P02bPrefill } from './pages/p-02b-prefill';
import { P03Name } from './pages/p-03-name';
import { P04StyleConfirm } from './pages/p-04-style-confirm';
import { P05Salary } from './pages/p-05-salary';
import { P05bPayday } from './pages/p-05b-payday';
import { P05cAllowance } from './pages/p-05c-allowance';
import { P06Split } from './pages/p-06-split';
import { P10Joined } from './pages/p-10-joined';
import { P11PushKinds } from './pages/p-11-push-kinds';

// /join/:screen → 합류 화면(18 P-02b~P-06, P-05c 용돈, P-10 축하, P-11 알림 종류). 화면 id = 기획서 화면 ID(소문자).
const SCREENS: Record<string, () => ReactNode> = {
  'p-02b': () => <P02bPrefill />,
  'p-03': () => <P03Name />,
  'p-04': () => <P04StyleConfirm />,
  'p-05': () => <P05Salary />,
  'p-05b': () => <P05bPayday />,
  'p-05c': () => <P05cAllowance />,
  'p-06': () => <P06Split />,
  'p-10': () => <P10Joined />,
  'p-11': () => <P11PushKinds />,
};
/** 합류를 마친 뒤 화면(합류 중인지 따지지 않음) */
const AFTER = new Set(['p-06', 'p-10', 'p-11']);

/** 뺀 화면에 멈춘 사람(이어하기): 지금 흐름에서 그 앞 화면의 다음 화면으로 */
function Moved({ id }: { id: string }) {
  const d = useJoinData();
  if (!d.ready)
    return <QuestionSkeleton chapter={joinChapter(JOIN_REMOVED[id] ?? 'p-03')} onBack={null} />;
  return <Navigate to={joinPath(movedJoinScreen(id, d) ?? 'p-03')} replace />;
}

export const isJoinScreen = (id: string) => id in SCREENS || id in JOIN_REMOVED;

/**
 * 합류가 끝난 초대(18 ‘합류 잡아 두기’, 2026-11-11 D1): 시작한 사람이 초대를 취소했거나 잡아 둔 24시간이 지남.
 * ‘코드 다시 입력하기’(P-01 코드 입력) / ‘혼자 시작하기’(온보딩을 마친 사람은 홈, 아니면 온보딩 처음부터)
 */
function JoinEnded() {
  const nav = useNavigate();
  const d = useJoinData();
  return (
    <QuestionLayout
      hero={<Illustration name="status-invite-blocked" className="hg-auth__art" />}
      title={copy.endedTitle}
      help={copy.endedHelp}
      center
      primary={{ label: copy.reenterCode }}
      onSubmit={() => nav(paths.joinCode, { state: { from: '/' } })}
      secondary={{
        label: copy.startSolo,
        onClick: () => {
          if (d.me?.onboarding_done_at) return nav('/', { replace: true });
          void saveMe({ onboarding_step: 'O-03' })
            .catch(() => undefined)
            .finally(() => nav('/onboarding/o-03', { replace: true }));
        },
      }}
    />
  );
}

/** 합류 중인지 먼저 확인(합류를 마치기 전 화면만). 끝난 초대면 안내 */
function Guard({ id, children }: { id: string; children: ReactNode }) {
  const d = useJoinData();
  if (AFTER.has(id) || d.resumed) return <>{children}</>;
  if (!d.ready) return <QuestionSkeleton onBack={null} />;
  if (d.ended) return <JoinEnded />;
  return <>{children}</>;
}

export function JoinRoute() {
  const { screen = 'p-03' } = useParams();
  const render = SCREENS[screen];
  if (screen in JOIN_REMOVED) return <Moved key={screen} id={screen} />;
  return render ? (
    <div key={screen}>
      <Guard id={screen}>{render()}</Guard>
    </div>
  ) : (
    <Navigate to="/join/p-03" replace />
  );
}
