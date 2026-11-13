import { registerPushDevice } from '@sweetwo/api';

// 푸시 허용 묻기(O-55 시작한 사람, P-11 합류한 사람, 홈 띠 10번 다시 묻기. 14 알림, 2026-11-13).
// OS 허용 창은 모바일 브리지(window.sweetwo.push)만. 브라우저(개발·e2e)는 ‘unavailable’.
const ASKED = 'sweetwo.pushAsked';
const LATER = 'sweetwo.pushLater';

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* 기억 못 하면 다음에 한 번 더 물을 수 있음 */
  }
};

/** 이 기기에서 이 계정에 이미 물었는지 */
export const pushAsked = () => get(ASKED) === '1';
export const markPushAsked = () => set(ASKED, '1');

/** O-55 ‘나중에 할게요’를 골랐는지(홈 띠 10번 “알림 다시 묻기”가 1회 볼 것, 19 H-06). 다시 물으면 clearPushLater */
export const pushLater = () => get(LATER) === '1';
export const markPushLater = () => set(LATER, '1');
export const clearPushLater = () => set(LATER, null);

/** 모바일 앱이고 아직 OS 창을 띄운 적 없으면 true(허용·거절이 이미 정해졌으면 false) */
export async function canAskPush() {
  const push = window.sweetwo?.push;
  if (!push) return false;
  return (await push.status().catch(() => 'denied')) === 'prompt';
}

/** OS 허용 창 → 허용되면 기기 등록. 브리지가 없으면 'unavailable' */
export async function askPush(): Promise<'granted' | 'denied' | 'unavailable'> {
  const b = window.sweetwo;
  markPushAsked();
  if (!b?.push) return 'unavailable';
  if (!(await b.push.request().catch(() => false))) return 'denied';
  const t = await b.push.token().catch(() => null);
  if (t && (b.platform === 'ios' || b.platform === 'android'))
    await registerPushDevice(b.platform, t, b.appVersion).catch(() => undefined);
  return 'granted';
}
