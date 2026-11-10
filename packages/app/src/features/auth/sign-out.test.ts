import { beforeEach, describe, expect, it, vi } from 'vitest';

// 로그아웃 하나(sign-out.ts): 모든 로그아웃 길이 같은 것을 비우는지. 세션과 기기 값(prefs)은 흉내 낸다.
const calls: string[] = [];
const store: Record<string, string | null> = {};
const bridge = {
  lock: { reset: vi.fn(async () => void calls.push('lock.reset')) },
  cache: { clear: vi.fn(async () => void calls.push('cache.clear')) },
};
let withBridge = true;
vi.mock('./session', () => ({
  session: {
    get bridge() {
      return withBridge ? bridge : undefined;
    },
    signOut: vi.fn(async () => void calls.push('session.signOut')),
  },
}));
vi.mock('./prefs', () => ({
  prefs: {
    setPendingProvider: (v: string | null) => (store.pending = v),
    setReturnTo: (v: string | null) => (store.returnTo = v),
    setPinAsked: (v: boolean) => (store.pinAsked = v ? '1' : null),
    setLastProvider: (v: string | null) => (store.lastProvider = v),
    setLastUser: (v: string | null) => (store.lastUser = v),
  },
}));

const { signOut, clearLocalSession } = await import('./sign-out');
const { onSessionReset } = await import('../../shared/session-reset');
const { useAuthStore } = await import('./store');

const fill = () =>
  Object.assign(store, {
    pending: 'kakao',
    returnTo: '/assets',
    pinAsked: '1',
    lastProvider: 'kakao',
    lastUser: 'u1',
  });

describe('로그아웃 하나(S1-03)', () => {
  let cleared = 0;
  onSessionReset(() => cleared++);
  beforeEach(() => {
    calls.length = 0;
    cleared = 0;
    withBridge = true;
    fill();
    useAuthStore.getState().startSignup('kakao');
  });

  it('직접 로그아웃: 서버 세션, 쿼리 캐시(등록한 것), 가입 중 값, 돌아갈 화면, 기기 캐시를 비우고 최근 사용·PIN은 남김', async () => {
    await signOut();
    expect(calls).toEqual(['session.signOut', 'cache.clear']);
    expect(cleared).toBe(1);
    expect(useAuthStore.getState().signup).toBeNull();
    expect(store).toMatchObject({
      pending: null,
      returnTo: null,
      pinAsked: '1',
      lastProvider: 'kakao',
    });
  });

  it('PIN 잊음: 이 기기 PIN을 지우고 로그인 뒤 다시 묻게', async () => {
    await signOut({ forgetPin: true });
    expect(calls).toEqual(['lock.reset', 'session.signOut', 'cache.clear']);
    expect(store.pinAsked).toBeNull();
    expect(store.lastProvider).toBe('kakao');
  });

  it('다른 계정으로: 최근 사용 방법, 마지막 계정, PIN까지', async () => {
    await signOut({ accountChange: true });
    expect(calls[0]).toBe('lock.reset');
    expect(store).toMatchObject({ lastProvider: null, lastUser: null, pinAsked: null });
  });

  it('만료(브리지가 이미 로그아웃): 서버는 건드리지 않고, 같은 계정이 돌아올 화면은 남김', () => {
    clearLocalSession({ keepReturnTo: true });
    expect(calls).toEqual(['cache.clear']);
    expect(cleared).toBe(1);
    expect(store.returnTo).toBe('/assets');
  });

  it('서버 로그아웃이 실패해도 이 기기 데이터는 지움(웹)', async () => {
    withBridge = false;
    const { session } = await import('./session');
    vi.mocked(session.signOut).mockRejectedValueOnce(new Error('offline'));
    await signOut();
    expect(cleared).toBe(1);
    expect(store.returnTo).toBeNull();
  });
});
