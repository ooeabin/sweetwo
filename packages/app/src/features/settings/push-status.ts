import { useEffect, useState } from 'react';

/**
 * 휴대폰 알림 권한(모바일 앱 브리지 push.status). 설정 앱에서 바꾸고 돌아오면 다시 읽음.
 * 앱이 아니면(브라우저 개발·e2e) 'granted'로 봄. 허용 전(‘나중에 할게요’로 건너뜀, 아직 안 물음)은 켜짐으로 보이지 않게
 * S-10 요약과 S-14 스위치가 같은 값을 씀(2026-11-14 재테스트 R7: 건너뛰었는데 “푸시 알림 켜짐”)
 */
export function usePushPermission() {
  const [status, setStatus] = useState<string>(window.sweetwo?.push ? 'unknown' : 'granted');
  useEffect(() => {
    const push = window.sweetwo?.push;
    if (!push) return;
    const read = () =>
      void push
        .status()
        .then((st) => setStatus(st))
        .catch(() => undefined);
    read();
    const onShow = () => document.visibilityState === 'visible' && read();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  // 두 번째 값: 화면에서 허용을 물은 뒤 바로 알려 줌(S-14 켜기)
  return [status, setStatus] as const;
}
