import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { emitter } from './events';

// 모바일 푸시(14 ‘센터와 푸시·메일’, DEV_GUIDE 알림). 토큰을 받아 앱(packages/app)이 서버에 등록(register_push_device).
// 앱이 화면에 떠 있으면 OS 알림 대신 앱 안 토스트(capacitor.config presentationOptions 빈 값 + onReceive).
// 누르면 그 알림의 화면으로(onOpen: 알림 id, 앱 경로). 받은 값은 경로 모양만 확인하고 넘김.
export const pushOpens = emitter<{ id: string; target: string }>();
export const pushReceives = emitter<{ title: string; body: string | null }>();
let pendingOpen: { id: string; target: string } | null = null;
let token: Promise<string | null> | null = null;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const safeTarget = (t: string) =>
  /^\/[A-Za-z0-9/_?=&.-]*$/.test(t) && !t.startsWith('//') ? t : '/notifications';

export async function pushStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const r = await PushNotifications.checkPermissions();
    return r.receive === 'granted' ? 'granted' : r.receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

/** 허용돼 있으면 등록하고 토큰. 아니면 null */
export function pushToken(): Promise<string | null> {
  token ??= (async () => {
    if ((await pushStatus()) !== 'granted') return null;
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 15_000);
      void PushNotifications.addListener('registration', (t) => {
        clearTimeout(timer);
        resolve(t.value);
      });
      void PushNotifications.addListener('registrationError', () => {
        clearTimeout(timer);
        resolve(null);
      });
      void PushNotifications.register().catch(() => resolve(null));
    });
  })().then((t) => {
    if (!t) token = null; // 다음에 다시 시도
    return t;
  });
  return token;
}

/** 허용을 묻고(처음 한 번은 OS 창) 허용되면 true */
export async function requestPush(): Promise<boolean> {
  try {
    const r = await PushNotifications.requestPermissions();
    return r.receive === 'granted';
  } catch {
    return false;
  }
}

export function startPush() {
  void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const d = (a.notification.data ?? {}) as Record<string, unknown>;
    const open = { id: str(d.id), target: safeTarget(str(d.target)) };
    pendingOpen = open;
    pushOpens.emit(open);
  });
  void PushNotifications.addListener('pushNotificationReceived', (n) => {
    pushReceives.emit({ title: n.title ?? '', body: n.body ?? null });
  });
  // Android 8+ 알림 채널(이름은 설정 앱에 보임)
  if (Capacitor.getPlatform() === 'android')
    void PushNotifications.createChannel({
      id: 'default',
      name: '알림',
      importance: 4,
      visibility: 0,
    }).catch(() => undefined);
}

export function takePendingOpen() {
  const p = pendingOpen;
  pendingOpen = null;
  return p;
}
