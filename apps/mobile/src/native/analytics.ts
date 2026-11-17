import { registerPlugin } from '@capacitor/core';
import type { FirebaseAnalyticsPlugin } from '@capacitor-firebase/analytics';
import type { AppBridge } from '@sweetwo/app';

// 분석 전송(ADR 0010, 2026-11-17): GA4(Firebase Analytics) 네이티브 플러그인. 웹 구현(firebase JS)을 묶지 않으려고
// 패키지 본문 대신 registerPlugin으로 네이티브만 부른다(타입만 가져옴).
// 설정 파일(Android google-services.json, iOS GoogleService-Info.plist)이 없으면 플러그인이 아무것도 보내지 않음(빌드도 그대로).
// 광고 ID(AD_ID·IDFA)·광고 맞춤 신호·자동 화면 기록은 AndroidManifest·Info.plist·capacitor.config에서 끔.
const FirebaseAnalytics = registerPlugin<FirebaseAnalyticsPlugin>('FirebaseAnalytics');

type Analytics = NonNullable<AppBridge['analytics']>;

export const analytics: Analytics = {
  log: (name, params) => FirebaseAnalytics.logEvent({ name, params }),
  screen: (screenId) =>
    FirebaseAnalytics.setCurrentScreen({ screenName: screenId, screenClassOverride: screenId }),
  setUser: async ({ id, props }) => {
    await FirebaseAnalytics.setUserId({ userId: id });
    for (const [key, value] of Object.entries(props))
      await FirebaseAnalytics.setUserProperty({ key, value });
  },
  setEnabled: (on) => FirebaseAnalytics.setEnabled({ enabled: on }),
};
