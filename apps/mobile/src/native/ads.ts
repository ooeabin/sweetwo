import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

// 보상형 광고(23 F-08 ‘새로 확인하기’만, 34 출시 체크, ADR 0006·0009 결정 11). @capacitor-community/admob.
// - 비맞춤형만: 요청마다 npa=1. iOS 앱 추적 투명성(ATT) 창은 묻지 않음(requestTrackingAuthorization 부르지 않음,
//   Info.plist에 NSUserTrackingUsageDescription 없음). 동의 창(UMP)도 띄우지 않음(비맞춤형만이라)
// - 금융 카테고리 차단은 AdMob 콘솔에서 사람이 설정(코드로 못 함)
// - 광고 단위 ID는 공개 값. 개발 빌드는 Google 테스트 광고 단위, 운영은 VITE_ADMOB_REWARDED_IOS·_ANDROID [확인 필요].
//   운영 값이 없으면 광고 없이 'failed'(앱은 광고 없이 바로 결과)
// 앱 ID(ca-app-pub-…~…)는 네이티브 설정: Android build.gradle admobAppId, iOS Info.plist GADApplicationIdentifier
const TEST_UNIT = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
} as const;
const env = import.meta.env as Record<string, string | boolean | undefined>;
const UNIT_RE = /^ca-app-pub-\d{16}\/\d{10}$/;

function unit(): { id: string; testing: boolean } | null {
  const p = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  if (env.DEV) return { id: TEST_UNIT[p], testing: true };
  const v = env[p === 'ios' ? 'VITE_ADMOB_REWARDED_IOS' : 'VITE_ADMOB_REWARDED_ANDROID'];
  return typeof v === 'string' && UNIT_RE.test(v) ? { id: v, testing: false } : null;
}

let started: Promise<boolean> | null = null;
const start = () =>
  (started ??= AdMob.initialize({ initializeForTesting: !!env.DEV })
    .then(() => true)
    .catch(() => {
      started = null;
      return false;
    }));

/** 광고 하나: 끝까지 보면 'rewarded', 보상 전에 닫으면 'closed', 못 불러오거나 못 띄우면 'failed' */
export async function showRewarded(): Promise<'rewarded' | 'closed' | 'failed'> {
  const u = unit();
  if (!u || !(await start())) return 'failed';
  const handles: PluginListenerHandle[] = [];
  try {
    await AdMob.prepareRewardVideoAd({ adId: u.id, isTesting: u.testing, npa: true });
    let rewarded = false;
    let finish: (r: 'rewarded' | 'closed' | 'failed') => void = () => undefined;
    const done = new Promise<'rewarded' | 'closed' | 'failed'>((resolve) => {
      finish = resolve;
    });
    handles.push(
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      }),
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () =>
        finish(rewarded ? 'rewarded' : 'closed'),
      ),
      await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish('failed')),
    );
    // showRewardVideoAd는 보상을 받을 때만 끝나므로 기다리지 않고, 닫힘·실패 이벤트로 결과를 냄
    AdMob.showRewardVideoAd().then(
      () => {
        rewarded = true;
      },
      () => finish('failed'),
    );
    return await done;
  } catch {
    return 'failed';
  } finally {
    handles.forEach((h) => void h.remove());
  }
}
