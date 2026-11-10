// 로그아웃하면 비울 것들(2026-11-10 1구간 검토 S1-03). 계정 데이터를 쥔 곳(쿼리 캐시, zustand 상점, 기기 캐시)이
// 여기에 지우는 함수를 등록하고, 로그아웃 함수(features/auth sign-out.ts) 하나가 모두 부른다.
const fns = new Set<() => void>();

/** 로그아웃 때 부를 함수 등록. 돌려준 함수로 해제 */
export function onSessionReset(fn: () => void): () => void {
  fns.add(fn);
  return () => void fns.delete(fn);
}

/** 등록된 것을 모두 비움(하나가 실패해도 나머지는 계속) */
export function resetSessionState() {
  for (const fn of fns) {
    try {
      fn();
    } catch {
      /* 다음 것 계속 */
    }
  }
}
