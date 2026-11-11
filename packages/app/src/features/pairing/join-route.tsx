import { QuestionSkeleton } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useJoinData } from './data';
import { JOIN_REMOVED, joinChapter, joinPath, movedJoinScreen } from './join-step';
import { P02bPrefill } from './pages/p-02b-prefill';
import { P03Name } from './pages/p-03-name';
import { P04SalaryMode } from './pages/p-04-salary-mode';
import { P05Salary } from './pages/p-05-salary';
import { P05bPayday } from './pages/p-05b-payday';
import { P06Split } from './pages/p-06-split';
import { P11Push } from './pages/p-11-push';

// /join/:screen → 합류 화면(18 P-02b~P-06, P-11 합류 직후 푸시 허용). 화면 id = 기획서 화면 ID(소문자).
const SCREENS: Record<string, () => ReactNode> = {
  'p-02b': () => <P02bPrefill />,
  'p-03': () => <P03Name />,
  'p-04': () => <P04SalaryMode />,
  'p-05': () => <P05Salary />,
  'p-05b': () => <P05bPayday />,
  'p-06': () => <P06Split />,
  'p-11': () => <P11Push />,
};

/** 뺀 화면에 멈춘 사람(이어하기): 지금 흐름에서 그 앞 화면의 다음 화면으로 */
function Moved({ id }: { id: string }) {
  const d = useJoinData();
  if (!d.ready)
    return <QuestionSkeleton chapter={joinChapter(JOIN_REMOVED[id] ?? 'p-03')} onBack={null} />;
  return <Navigate to={joinPath(movedJoinScreen(id, d) ?? 'p-03')} replace />;
}

export const isJoinScreen = (id: string) => id in SCREENS || id in JOIN_REMOVED;

export function JoinRoute() {
  const { screen = 'p-03' } = useParams();
  const render = SCREENS[screen];
  if (screen in JOIN_REMOVED) return <Moved key={screen} id={screen} />;
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/join/p-03" replace />;
}
