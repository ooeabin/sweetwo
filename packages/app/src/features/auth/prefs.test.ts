import { beforeEach, describe, expect, it, vi } from 'vitest';

// 합류 뒤 화면 기억(2026-11-16 r5 A1): 계정마다, P-09·P-10·P-11만
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});
const { prefs } = await import('./prefs');

describe('prefs.joinAfter', () => {
  beforeEach(() => mem.clear());

  it('같은 계정이면 기억한 화면', () => {
    prefs.setJoinAfter('u1', 'p-09');
    expect(prefs.joinAfter('u1')).toBe('p-09');
  });

  it('다른 계정·로그인 전이면 없음', () => {
    prefs.setJoinAfter('u1', 'p-10');
    expect(prefs.joinAfter('u2')).toBeNull();
    expect(prefs.joinAfter(null)).toBeNull();
  });

  it('합류 뒤 화면이 아니면 없음, 지우면 없음', () => {
    mem.set('sweetwo.join-after', 'u1|p-03');
    expect(prefs.joinAfter('u1')).toBeNull();
    prefs.setJoinAfter('u1', 'p-11');
    prefs.setJoinAfter(null, null);
    expect(prefs.joinAfter('u1')).toBeNull();
  });
});
