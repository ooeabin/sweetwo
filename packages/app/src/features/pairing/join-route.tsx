import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { P02bPrefill } from './pages/p-02b-prefill';
import { P03Name } from './pages/p-03-name';
import { P03aBirthYear } from './pages/p-03a-birth-year';
import { P04SalaryMode } from './pages/p-04-salary-mode';
import { P05Salary } from './pages/p-05-salary';
import { P06Split } from './pages/p-06-split';
import { P11Push } from './pages/p-11-push';

// /join/:screen → 합류 화면(18 P-02b~P-06, P-11 합류 직후 푸시 허용). 화면 id = 기획서 화면 ID(소문자).
const SCREENS: Record<string, () => ReactNode> = {
  'p-02b': () => <P02bPrefill />,
  'p-03': () => <P03Name />,
  'p-03a': () => <P03aBirthYear />,
  'p-04': () => <P04SalaryMode />,
  'p-05': () => <P05Salary />,
  'p-06': () => <P06Split />,
  'p-11': () => <P11Push />,
};

export const isJoinScreen = (id: string) => id in SCREENS;

export function JoinRoute() {
  const { screen = 'p-03' } = useParams();
  const render = SCREENS[screen];
  return render ? <div key={screen}>{render()}</div> : <Navigate to="/join/p-03" replace />;
}
