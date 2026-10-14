import type { RouteObject } from 'react-router-dom';
import { H01ThisMonth } from './features/month';

// 경로 표. 화면 ID를 주석으로 남긴다.
export const routes: RouteObject[] = [
  { path: '/', element: <H01ThisMonth /> }, // H-01 이번 달
];
