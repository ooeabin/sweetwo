import type { RouteObject } from 'react-router-dom';
import { H01ThisMonth } from './features/month';
import { DevUiGallery } from './features/dev';

// 경로 표. 화면 ID를 주석으로 남긴다.
export const routes: RouteObject[] = [
  { path: '/', element: <H01ThisMonth /> }, // H-01 이번 달
  // 개발 전용: 컴포넌트 모음. 배포 빌드에서는 import.meta.env.DEV가 false라 빠진다.
  ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <DevUiGallery /> }] : []),
];
