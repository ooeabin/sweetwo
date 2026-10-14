// desktop/web 차이는 여기서만. 데스크톱 전용 기능은 preload가 노출한 window.sweetwo 브리지로만 쓴다.
export type Platform = 'desktop' | 'web';

export interface DesktopBridge {
  version: string;
  /** 초대 링크(sweetwo://i/{code})를 받는다. 돌려준 함수로 해제. 로그인 콜백은 main만 다룬다. */
  onInvite: (cb: (code: string) => void) => () => void;
}

declare global {
  interface Window {
    sweetwo?: DesktopBridge;
  }
}

export function detectPlatform(): Platform {
  return typeof window !== 'undefined' && window.sweetwo ? 'desktop' : 'web';
}
