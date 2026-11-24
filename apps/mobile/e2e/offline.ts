import type { Page, Route } from '@playwright/test';

// 실제로 인터넷이 끊긴 상태(연결 판정은 실제 요청 성공·auth/v1/health 확인도 봄, 13 공통 상태 9번):
// 브라우저 오프라인 + 서버로 가는 요청 모두 실패하게 한다(흉내 서버가 오프라인에서도 답하므로).
const SERVER = /\/(rest|auth|realtime|storage|functions)\/v1\//;
const abort = (r: Route) => r.abort('internetdisconnected');
export async function goOffline(page: Page) {
  await page.route(SERVER, abort);
  await page.context().setOffline(true);
}
export async function goOnline(page: Page) {
  await page.unroute(SERVER, abort);
  await page.context().setOffline(false);
}
