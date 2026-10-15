import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { P02bPrefill } from './pages/p-02b-prefill';
import { P03Nickname } from './pages/p-03-nickname';
import { P04Profile } from './pages/p-04-profile';
import { P05Income } from './pages/p-05-income';
import { P05dPayday } from './pages/p-05d-payday';
import { P07Allowance } from './pages/p-07-allowance';
import { P08Split } from './pages/p-08-split';
import { P11Joined } from './pages/p-11-joined';

// /join/:screen → 합류 화면(P-02b~P-11). 화면 id = 기획서 화면 ID(소문자), P-05 월급날은 p-05d.
const SCREENS: Record<string, () => ReactNode> = {
  'p-02b': () => <P02bPrefill />,
  'p-03': () => <P03Nickname />,
  'p-04': () => <P04Profile />,
  'p-05': () => <P05Income />,
  'p-05d': () => <P05dPayday />,
  'p-07': () => <P07Allowance />,
  'p-08': () => <P08Split />,
  'p-11': () => <P11Joined />,
};

export const isJoinScreen = (id: string) => id in SCREENS;

export function JoinRoute() {
  const { screen = 'p-03' } = useParams();
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/join/p-03" replace />;
}
