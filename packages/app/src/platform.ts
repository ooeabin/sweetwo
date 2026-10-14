// desktop/web 차이는 여기서만. 데스크톱 전용 기능은 preload가 노출한 window.sweetwo 브리지로만 쓴다.
export type Platform = 'desktop' | 'web';

export interface DesktopBridge {
  version: string;
}

declare global {
  interface Window {
    sweetwo?: DesktopBridge;
  }
}

export function detectPlatform(): Platform {
  return typeof window !== 'undefined' && window.sweetwo ? 'desktop' : 'web';
}
