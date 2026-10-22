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
/** 방금 PIN을 확인한 시각(잠금 끄기·PIN 바꾸기 전 현재 PIN 확인, S-15) */
let verifiedAt = 0;
const AUTO_KEY = 'app-lock-auto';
/** 자동 잠금 분: 1·5·15, 0 = 사용 안 함(기본 5분) */
const autoMin = () => {
  const v = Number(secureStore.get(AUTO_KEY) ?? AUTO_LOCK_MS / 60_000);
  return [0, 1, 5, 15].includes(v) ? v : AUTO_LOCK_MS / 60_000;
};
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
    autoLockMin: autoMin(),
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
  const given = Buffer.from(hashPin(pin, s.salt), 'base64');
  const stored = Buffer.from(s.hash, 'base64');
  // timingSafeEqual은 길이가 다르면 던진다(옛 빌드·깨진 저장값). 길이부터 맞춰 본다.
  const ok =
    /^\d{6}$/.test(pin) && given.length === stored.length && timingSafeEqual(given, stored);
  if (ok) {
    write({ ...s, failed: 0 });
    locked = false;
    verifiedAt = Date.now();
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

/** S-15 잠금 끄기: 1분 안에 현재 PIN을 확인했을 때만 */
export function clearPinVerified(): boolean {
  if (Date.now() - verifiedAt > 60_000) return false;
  clearPin();
  verifiedAt = 0;
  return true;
}

export function setAutoLock(min: number): boolean {
  if (![0, 1, 5, 15].includes(min)) return false;
  return secureStore.set(AUTO_KEY, String(min));
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

/** 실행 시 잠금 + 자리를 비우면(S-15 설정, 기본 5분) 잠금, 화면 잠금 때도 잠금 */
export function startAutoLock() {
  if (read()) locked = true;
  setInterval(() => {
    const min = autoMin();
    if (!locked && min > 0 && powerMonitor.getSystemIdleTime() >= min * 60) lockNow();
  }, 15_000).unref();
  powerMonitor.on('lock-screen', lockNow);
  powerMonitor.on('suspend', lockNow);
}
