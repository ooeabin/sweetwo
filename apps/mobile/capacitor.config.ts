import type { CapacitorConfig } from '@capacitor/cli';

// 모바일 앱(iOS, Android). Vite로 만든 화면 묶음(dist)을 앱에 넣음(ADR 0001).
// appId는 App Store, Google Play 등록과 애플 로그인에 그대로 쓰여 한 번 정하면 바꾸기 어려움 [확인 필요]
const config: CapacitorConfig = {
  appId: 'kr.sweetwo.app',
  appName: 'sweeTwo',
  webDir: 'dist',
};

export default config;
