import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { O63Revisit } from './pages/o-63-revisit';
import { O64Revisit } from './pages/o-64-revisit';
import { O65Revisit } from './pages/o-65-revisit';
import { P02bPrefill } from './pages/p-02b-prefill';
import { P03Nickname } from './pages/p-03-nickname';
import { P04Profile } from './pages/p-04-profile';
import { P05Income } from './pages/p-05-income';
import { P05dPayday } from './pages/p-05d-payday';
import { P07Allowance } from './pages/p-07-allowance';
import { P08Split } from './pages/p-08-split';
import { P10Changes } from './pages/p-10-changes';
import { P11Joined } from './pages/p-11-joined';

// /join/:screen → 합류 화면(P-02b~P-11)과 합류 뒤 다시 보기(O-63~65). 화면 id = 기획서 화면 ID(소문자), P-05 월급날은 p-05d.
const SCREENS: Record<string, () => ReactNode> = {
  'p-02b': () => <P02bPrefill />,
  'p-03': () => <P03Nickname />,
  'p-04': () => <P04Profile />,
  'p-05': () => <P05Income />,
  'p-05d': () => <P05dPayday />,
  'p-07': () => <P07Allowance />,
  'p-08': () => <P08Split />,
  'p-10': () => <P10Changes />,
  'p-11': () => <P11Joined />,
  'o-63': () => <O63Revisit />,
  'o-64': () => <O64Revisit />,
  'o-65': () => <O65Revisit />,
};

export const isJoinScreen = (id: string) => id in SCREENS;

export function JoinRoute() {
  const { screen = 'p-03' } = useParams();
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/join/p-03" replace />;
}
