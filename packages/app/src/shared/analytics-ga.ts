// 분석 전송(ADR 0010, 2026-11-17): 앱 이벤트(analytics.ts)를 GA4(Firebase Analytics)로.
// packages/app은 Capacitor를 모르므로 모바일 브리지(window.sweetwo.analytics)로만 보낸다. 브리지가 없으면(브라우저 개발·e2e)
// 지금처럼 개발 중 콘솔만(track 기본 동작). 금액 원값, 이름, 이메일, 메모는 보내지 않는다(이벤트 정의가 이미 구간만, 여기서 한 번 더 거름).
import type { AppBridge } from '../platform';
import type { AnalyticsEvent } from './analytics';
import { setAnalyticsSink } from './analytics';
import { onSessionReset } from './session-reset';
import { screenIdOf } from './screen-id';

export type GaParams = Record<string, string | number>;
export type AnalyticsBridge = NonNullable<AppBridge['analytics']>;

/** 금액처럼 보이는 숫자 속성 이름(구간 *_band는 글자라 해당 없음). 이벤트 표에 실수로 들어와도 보내지 않음 */
const MONEY_KEY = /(^|_)(amount|won|balance|income|salary|price|net|value|sum)$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** GA4 한도: 속성 이름 40자, 글자 값 100자, 이벤트당 속성 25개 */
const MAX_KEY = 40;
const MAX_TEXT = 100;
const MAX_PARAMS = 25;

/**
 * 이벤트 속성 → GA 속성. 참·거짓은 'true'/'false', 배열은 쉼표로 이음, null·undefined는 뺌.
 * 금액처럼 보이는 숫자, 이메일처럼 보이는 글, 소수(금액은 정수 원뿐이라 소수는 비율·시간만) 중 금액 이름은 뺀다.
 */
export function toGaParams(props: object): GaParams {
  const out: GaParams = {};
  for (const [k, v] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_PARAMS) break;
    if (v === null || v === undefined) continue;
    const key = k.slice(0, MAX_KEY);
    if (typeof v === 'number') {
      if (!Number.isFinite(v) || MONEY_KEY.test(k)) continue;
      out[key] = v;
    } else if (typeof v === 'boolean') {
      out[key] = v ? 'true' : 'false';
    } else if (typeof v === 'string' || Array.isArray(v)) {
      const s = Array.isArray(v) ? v.map(String).join(',') : v;
      if (EMAIL.test(s)) continue;
      out[key] = s.slice(0, MAX_TEXT);
    }
  }
  return out;
}

/** 이 앱의 GA 가명 salt(공개 값, ADR 0010). 바꾸면 GA에서 같은 사람이 다른 사람이 되니 바꾸지 않는다 */
export const GA_SALT = 'sweetwo-ga-v1';

/** 내부 id → 되돌릴 수 없는 가명(SHA-256(salt:id) 앞 32자 16진수). GA 사용자 속성 값 36자 한도 안 */
export async function gaHash(id: string): Promise<string> {
  const data = new TextEncoder().encode(`${GA_SALT}:${id}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** GA에 알릴 사람 정보(‘me’ 쿼리 값 중 필요한 것만) */
export type AnalyticsPerson = { id: string; space_id: string | null; analytics_off: boolean };

/** 이 사람으로 전송 상태를 맞춘다: 끈 사람은 수집 끔 + 사용자 지움, 아니면 가명 user_id·couple_hash */
export async function applyPerson(a: AnalyticsBridge, p: AnalyticsPerson | null) {
  if (p?.analytics_off) {
    await a.setEnabled(false);
    await a.setUser({ id: null, props: { couple_hash: null } });
    return;
  }
  await a.setEnabled(true);
  if (!p) {
    await a.setUser({ id: null, props: { couple_hash: null } });
    return;
  }
  await a.setUser({
    id: await gaHash(p.id),
    props: { couple_hash: p.space_id ? await gaHash(p.space_id) : null },
  });
}

type Location = { pathname: string; search: string };
type RouterLike = {
  state: { location: Location };
  subscribe: (fn: (st: { location: Location }) => void) => () => void;
};

/**
 * 브리지 전송을 켠다(App에서 한 번). 이벤트는 브리지로, 화면 이동은 screen_view(화면 ID), 사람이 바뀌면 applyPerson.
 * ‘분석 수집’을 끈 사람(S-18, analytics_off)이면 이벤트를 버린다. 로그아웃하면 사용자를 지움.
 */
export function startAnalytics(
  a: AnalyticsBridge,
  router: RouterLike,
  watchPerson: (cb: (p: AnalyticsPerson | null) => void) => () => void,
): () => void {
  let off = false;
  const safe = (p: Promise<unknown>) => void p.catch(() => undefined);
  setAnalyticsSink((e: AnalyticsEvent) => {
    if (!off) safe(a.log(e.name, toGaParams(e.props)));
  });
  let lastScreen: string | null = null;
  const screen = (loc: Location) => {
    const id = screenIdOf(loc.pathname, loc.search);
    if (!id || id === lastScreen || off) return;
    lastScreen = id;
    safe(a.screen(id));
  };
  screen(router.state.location);
  const stopRouter = router.subscribe((st) => screen(st.location));
  let lastKey = '';
  const stopPerson = watchPerson((p) => {
    const key = p ? `${p.id}|${p.space_id ?? ''}|${String(p.analytics_off)}` : '';
    if (key === lastKey) return;
    lastKey = key;
    off = Boolean(p?.analytics_off);
    safe(applyPerson(a, p));
  });
  const stopReset = onSessionReset(() => {
    lastKey = '';
    off = false;
    safe(applyPerson(a, null));
  });
  return () => {
    stopRouter();
    stopPerson();
    stopReset();
    setAnalyticsSink(null);
  };
}
