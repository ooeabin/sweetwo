import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetOnline,
  __setProbe,
  checkOnline,
  isOnline,
  probeOnline,
  reportReachable,
} from '@sweetwo/api';

const setNav = (v: boolean) =>
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: v }, configurable: true });

describe('연결 판정', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  beforeEach(() => __resetOnline(true));
  afterEach(() => {
    __setProbe(null);
    if (orig) Object.defineProperty(globalThis, 'navigator', orig);
  });

  it('navigator가 거짓이어도 실제 확인이 되면 온라인', async () => {
    setNav(false);
    __setProbe(async () => true);
    expect(await checkOnline()).toBe(true);
    expect(isOnline()).toBe(true);
  });

  it('navigator도 거짓이고 확인도 실패하면 오프라인', async () => {
    setNav(false);
    __setProbe(async () => false);
    expect(await checkOnline()).toBe(false);
    expect(isOnline()).toBe(false);
  });

  it('오프라인에서 확인이 성공하면 다시 온라인', async () => {
    setNav(false);
    __setProbe(async () => false);
    await probeOnline();
    expect(isOnline()).toBe(false);
    __setProbe(async () => true);
    await probeOnline();
    expect(isOnline()).toBe(true);
  });

  it('실제 요청이 성공하면 바로 온라인', async () => {
    setNav(false);
    __setProbe(async () => false);
    await probeOnline();
    reportReachable();
    expect(isOnline()).toBe(true);
  });
});
