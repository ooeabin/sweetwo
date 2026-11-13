import { describe, expect, it } from 'vitest';

// 로그아웃하면 계정 값을 담은 기기 저장소 키를 지우고 기기 설정은 남김(2026-11-12 QA 11구간 S11-08)
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  },
});
const { resetSessionState } = await import('./session-reset');

describe('로그아웃 때 기기 저장소(S11-08)', () => {
  it('계정 값은 지우고 기기 설정은 남김', () => {
    for (const k of [
      'sweetwo.exportedAt',
      'sweetwo.onboardingSeenAt',
      'sweetwo.onboardingStartedAt',
      'sweetwo.pushAsked',
      'sweetwo.pushLater',
      'sweetwo.joinSend',
      'sweetwo.split-notice.s1',
      'sweetwo.split-notice.s2',
      'sweetwo.made-notice.c1',
      'sweetwo.last-provider',
      'sweetwo.masked',
      'sweetwo.cal-filter',
    ])
      mem.set(k, '1');
    resetSessionState();
    expect([...mem.keys()].sort()).toEqual([
      'sweetwo.cal-filter',
      'sweetwo.last-provider',
      'sweetwo.masked',
    ]);
  });
});
