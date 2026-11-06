import { App as CapApp } from '@capacitor/app';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor/privacy-screen';
import type { LockStatus, VerifyResult } from '@sweetwo/app';
import { AUTO_LOCK_MS, Pin, PIN_MAX_ATTEMPTS } from '@sweetwo/core';
import { signOut } from './auth';
import { emitter } from './events';
import { secureStore } from './store';

// 모바일 앱 잠금(기획서 A-06, DEV_GUIDE ‘잠금’). 데스크톱 apps/desktop/src/main/lock.ts와 같은 규칙.
// PIN은 PBKDF2(SHA-256) 해시로 Keychain·Keystore에, 틀린 횟수도 같이. 생체 인증은 iPhone Face ID·Touch ID, Android 지문.
// 자동 잠금 = 앱이 뒤로 간 지 N분(S-15, 기본 5분). 최근 앱 화면에는 가림 화면(PrivacyScreen).
type Stored = { salt: string; hash: string; failed: number; touchId: boolean };
const KEY = 'app-lock';
const AUTO_KEY = 'app-lock-auto';
const ITER = 210_000;

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: ITER },
    key,
    256,
  );
  return b64(bits);
}
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

async function read(): Promise<Stored | null> {
  const raw = await secureStore.get(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}
const write = (s: Stored) => secureStore.set(KEY, JSON.stringify(s));

export const lockEvents = emitter<null>();
let locked = false;
let verifiedAt = 0;
let hiddenAt: number | null = null;

async function autoMin() {
  const v = Number((await secureStore.get(AUTO_KEY)) ?? AUTO_LOCK_MS / 60_000);
  return [0, 1, 5, 15].includes(v) ? v : AUTO_LOCK_MS / 60_000;
}

async function bio(): Promise<{ available: boolean; kind: 'touch' | 'face' | 'fingerprint' }> {
  try {
    const r = await BiometricAuth.checkBiometry();
    const kind =
      Capacitor.getPlatform() === 'android'
        ? 'fingerprint'
        : r.biometryType === BiometryType.faceId
          ? 'face'
          : 'touch';
    return { available: r.isAvailable, kind };
  } catch {
    return { available: false, kind: 'touch' };
  }
}

export async function lockStatus(): Promise<LockStatus> {
  const [s, b, min] = await Promise.all([read(), bio(), autoMin()]);
  return {
    hasPin: s !== null,
    locked: s !== null && locked,
    touchIdAvailable: b.available,
    touchIdEnabled: !!s?.touchId && b.available,
    bioKind: b.kind,
    autoLockMin: min,
  };
}

/** 새 PIN. 약한 PIN(같은 숫자, 연속 숫자)은 거부. */
export async function setPin(pin: string): Promise<boolean> {
  if (!Pin.safeParse(pin).success) return false;
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  locked = false;
  return write({ salt, hash: await hashPin(pin, salt), failed: 0, touchId: false });
}

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const s = await read();
  if (!s) return { ok: true };
  const ok = /^\d{6}$/.test(pin) && sameText(await hashPin(pin, s.salt), s.hash);
  if (ok) {
    await write({ ...s, failed: 0 });
    locked = false;
    verifiedAt = Date.now();
    return { ok: true };
  }
  const failed = s.failed + 1;
  if (failed >= PIN_MAX_ATTEMPTS) {
    // 5회 실패: PIN을 지우고 로그아웃(→ A-02, 로그인 뒤 PIN 새로 만들기)
    await clearPin();
    await signOut('pin_failed');
    return { ok: false, failed, signedOut: true };
  }
  await write({ ...s, failed });
  return { ok: false, failed, signedOut: false };
}

/** S-15 잠금 끄기: 1분 안에 현재 PIN을 확인했을 때만 */
export async function clearPinVerified(): Promise<boolean> {
  if (Date.now() - verifiedAt > 60_000) return false;
  await clearPin();
  verifiedAt = 0;
  return true;
}

export async function setAutoLock(min: number): Promise<boolean> {
  if (![0, 1, 5, 15].includes(min)) return false;
  return secureStore.set(AUTO_KEY, String(min));
}

export async function clearPin() {
  await secureStore.remove(KEY);
  locked = false;
}

export async function lockNow() {
  if (!(await read())) return;
  locked = true;
  lockEvents.emit(null);
}

export async function setBiometric(on: boolean): Promise<boolean> {
  const s = await read();
  if (!s || (on && !(await bio()).available)) return false;
  return write({ ...s, touchId: on });
}

export async function unlockWithBiometric(): Promise<boolean> {
  const s = await read();
  const b = await bio();
  if (!s?.touchId || !b.available) return false;
  try {
    await BiometricAuth.authenticate({
      reason: 'sweeTwo 잠금 풀기',
      cancelTitle: '취소',
      allowDeviceCredential: false,
      androidTitle: 'sweeTwo 잠금 풀기',
    });
    await write({ ...s, failed: 0 });
    locked = false;
    return true;
  } catch {
    return false; // 실패, 취소 → PIN
  }
}

/** 실행 시 잠금 + 앱이 뒤로 간 지 N분이면 돌아올 때 잠금. 최근 앱 화면 가림 */
export async function startAutoLock() {
  if (await read()) locked = true;
  await PrivacyScreen.enable({
    android: { privacyModeOnActivityHidden: 'splash', preventScreenshots: false },
    ios: { blurEffect: 'light' },
  }).catch(() => undefined);
  void CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      hiddenAt = Date.now();
      return;
    }
    const since = hiddenAt;
    hiddenAt = null;
    void autoMin().then((min) => {
      if (!locked && since !== null && min > 0 && Date.now() - since >= min * 60_000)
        void lockNow();
    });
  });
}
