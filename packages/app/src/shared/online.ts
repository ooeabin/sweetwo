import { isOnline, subscribeOnline } from '@sweetwo/api';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

// 인터넷 연결 판정은 api `connectivity.ts` 한 곳(navigator.onLine만 믿지 않고 실제 확인, 13 공통 상태 9번).
// 맨 위 띠(useOnline)와 TanStack Query(onlineManager)가 같은 값을 쓴다.

/** 인터넷 연결 여부(실제 확인을 거친 값) */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}

/** TanStack Query가 같은 판정을 쓰게 함(브라우저 onLine이 거짓이어도 닿으면 쿼리를 멈추지 않음). App이 한 번 부름 */
export function bindQueryOnline() {
  onlineManager.setEventListener((setOnline) => {
    setOnline(isOnline());
    return subscribeOnline(() => setOnline(isOnline()));
  });
  onlineManager.setOnline(isOnline());
}
