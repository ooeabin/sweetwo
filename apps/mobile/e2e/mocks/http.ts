import type { Route } from '@playwright/test';

// 가짜 Supabase 응답 도우미(모든 흉내가 같이 씀). CORS 머리는 개발 서버(다른 포트)에서 부르기 때문
export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });

/** 본문 없는 성공(PostgREST insert·update return=minimal) */
export const ok = (route: Route) =>
  route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });

/** 서버 함수 오류(PostgREST 모양 {message, code}). 권한(42501)은 403, 나머지 400 */
export const rpcError = (route: Route, message: string, code = '22023') =>
  json(route, { message, code }, code === '42501' ? 403 : 400);
