import { BrowserWindow, powerMonitor, systemPreferences } from 'electron';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { AUTO_LOCK_MS, Pin, PIN_MAX_ATTEMPTS } from '@sweetwo/core';
import { CH, type LockStatus, type VerifyResult } from '../shared/channels';
import { secureStore } from './secure-store';
import { signOut } from './auth';

// 앱 잠금(기획서 A-06). PIN은 scrypt 해시로 OS 키체인 암호화 저장소에. 틀린 횟수도 main이 센다.
type Stored = { salt: string; hash: string; failed: number; touchId: boolean };

const read = (): Stored | null => {
  const raw = secureStore.get('app-lock');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
};
const write = (s: Stored) => secureStore.set('app-lock', JSON.stringify(s));
const hashPin = (pin: string, salt: string) =>
  scryptSync(pin, Buffer.from(salt, 'base64'), 32).toString('base64');

let locked = false;
const emitLocked = () => {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(CH.lockEvent, { locked: true });
};

const touchIdAvailable = () =>
  process.platform === 'darwin' && systemPreferences.canPromptTouchID();

export function lockStatus(): LockStatus {
  const s = read();
  return {
    hasPin: s !== null,
    locked: s !== null && locked,
    touchIdAvailable: touchIdAvailable(),
    touchIdEnabled: !!s?.touchId && touchIdAvailable(),
  };
}

/** 새 PIN. 약한 PIN(같은 숫자, 연속 숫자)은 거부. */
export function setPin(pin: string): boolean {
  if (!Pin.safeParse(pin).success) return false;
  const salt = randomBytes(16).toString('base64');
  locked = false;
  return write({ salt, hash: hashPin(pin, salt), failed: 0, touchId: false });
}

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const s = read();
  if (!s) return { ok: true };
  const ok =
    /^\d{6}$/.test(pin) &&
    timingSafeEqual(Buffer.from(hashPin(pin, s.salt), 'base64'), Buffer.from(s.hash, 'base64'));
  if (ok) {
    write({ ...s, failed: 0 });
    locked = false;
    return { ok: true };
  }
  const failed = s.failed + 1;
  if (failed >= PIN_MAX_ATTEMPTS) {
    // 5회 실패: PIN을 지우고 로그아웃(→ A-02, 로그인 뒤 PIN 새로 만들기)
    clearPin();
    await signOut('pin_failed');
    return { ok: false, failed, signedOut: true };
  }
  write({ ...s, failed });
  return { ok: false, failed, signedOut: false };
}

export function clearPin() {
  secureStore.remove('app-lock');
  locked = false;
}

export function lockNow() {
  if (!read()) return;
  locked = true;
  emitLocked();
}

export function setTouchId(on: boolean) {
  const s = read();
  if (!s || (on && !touchIdAvailable())) return false;
  return write({ ...s, touchId: on });
}

export async function unlockWithTouchId(): Promise<boolean> {
  const s = read();
  if (!s?.touchId || !touchIdAvailable()) return false;
  try {
    await systemPreferences.promptTouchID('sweeTwo 잠금 풀기');
    write({ ...s, failed: 0 });
    locked = false;
    return true;
  } catch {
    return false; // 실패, 취소 → PIN
  }
}

/** 실행 시 잠금 + 자리를 비우면(기본 5분) 잠금, 화면 잠금 때도 잠금 */
export function startAutoLock() {
  if (read()) locked = true;
  setInterval(() => {
    if (!locked && powerMonitor.getSystemIdleTime() * 1000 >= AUTO_LOCK_MS) lockNow();
  }, 15_000).unref();
  powerMonitor.on('lock-screen', lockNow);
  powerMonitor.on('suspend', lockNow);
}
