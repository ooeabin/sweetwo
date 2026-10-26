// 모바일 푸시 보내기: iOS = APNs HTTP/2(토큰 인증 .p8), Android = FCM HTTP v1(서비스 계정 OAuth).
// 결과: 'ok' / 'gone'(더는 받을 수 없는 토큰, 지움) / 'error'(이번만 실패)
import { signJwt } from './jwt.ts';

export interface Push {
  token: string;
  title: string;
  body: string | null;
  /** 누르면 갈 앱 화면(/goals/…)과 알림 id */
  target: string;
  id: string;
}
export type PushResult = 'ok' | 'gone' | 'error';

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKey: string; // .p8 PEM
  topic: string; // 번들 ID(kr.sweetwo.app)
  sandbox: boolean;
}
export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string; // 서비스 계정 PEM
}

// APNs 토큰은 1시간까지 쓸 수 있고 20분보다 자주 새로 만들지 않음(Apple 문서). 함수가 살아 있는 동안 재사용
let apnsJwt: { value: string; at: number } | null = null;
async function apnsToken(c: ApnsConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now - apnsJwt.at < 40 * 60) return apnsJwt.value;
  const value = await signJwt('ES256', c.privateKey, { kid: c.keyId }, { iss: c.teamId, iat: now });
  apnsJwt = { value, at: now };
  return value;
}

export async function sendApns(
  c: ApnsConfig,
  p: Push,
  fetchFn: typeof fetch = fetch,
): Promise<PushResult> {
  const host = c.sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetchFn(`https://${host}/3/device/${encodeURIComponent(p.token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsToken(c)}`,
      'apns-topic': c.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: p.body ? { title: p.title, body: p.body } : { title: p.title },
        sound: 'default',
      },
      target: p.target,
      id: p.id,
    }),
  });
  if (res.ok) return 'ok';
  // 410 Unregistered, 400 BadDeviceToken: 이 기기로는 더 보내지 않음
  if (res.status === 410) return 'gone';
  if (res.status === 400) {
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
    if (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') return 'gone';
  }
  return 'error';
}

let fcmAccess: { value: string; exp: number } | null = null;
async function fcmToken(c: FcmConfig, fetchFn: typeof fetch) {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAccess && fcmAccess.exp - now > 300) return fcmAccess.value;
  const assertion = await signJwt(
    'RS256',
    c.privateKey,
    {},
    {
      iss: c.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
  );
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error(`fcm oauth ${res.status}`);
  const t = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { value: t.access_token, exp: now + t.expires_in };
  return t.access_token;
}

export async function sendFcm(
  c: FcmConfig,
  p: Push,
  fetchFn: typeof fetch = fetch,
): Promise<PushResult> {
  const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${c.projectId}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await fcmToken(c, fetchFn)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: p.token,
        notification: p.body ? { title: p.title, body: p.body } : { title: p.title },
        data: { target: p.target, id: p.id },
        android: { priority: 'high' },
      },
    }),
  });
  if (res.ok) return 'ok';
  const err = (
    (await res.json().catch(() => ({}))) as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    }
  ).error;
  const code = err?.details?.find((d) => d.errorCode)?.errorCode ?? err?.status;
  if (res.status === 404 || code === 'UNREGISTERED') return 'gone';
  return 'error';
}
