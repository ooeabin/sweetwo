import type { CapacitorConfig } from '@capacitor/cli';

// 모바일 앱(iOS, Android). Vite로 만든 화면 묶음(dist)을 앱에 넣음(ADR 0001).
// appId는 App Store, Google Play 등록과 애플 로그인에 그대로 쓰여 한 번 정하면 바꾸기 어려움 [확인 필요]
const config: CapacitorConfig = {
  appId: 'kr.sweetwo.app',
  appName: 'sweeTwo',
  webDir: 'dist',
  // 로그인된 기기 이름(S-15 ‘휴대폰 앱(iOS)’, core deviceLabel)이 앱인지 알 수 있게
  appendUserAgent: 'sweeTwo',
  plugins: {
    // 앱이 화면에 떠 있으면 OS 알림을 띄우지 않고 앱 안 토스트로(14 ‘센터와 푸시·메일’)
    PushNotifications: { presentationOptions: [] },
  },
};

export default config;
