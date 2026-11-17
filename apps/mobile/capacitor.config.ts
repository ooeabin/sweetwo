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
  // 분석 GA4(ADR 0010): iOS는 IDFA 없는 Firebase Analytics(AnalyticsWithoutAdIdSupport 트레잇, Swift 6.1 도구 필요).
  // symlink는 Firebase SwiftPM 패키지 이름 겹침을 피하는 플러그인 안내대로
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        packageTraits: { '@capacitor-firebase/analytics': ['AnalyticsWithoutAdIdSupport'] },
        packageOptions: { '@capacitor-firebase/analytics': { symlink: true } },
      },
    },
  },
};

export default config;
