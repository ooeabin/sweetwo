import { describe, expect, it } from 'vitest';

// 저금 추가 중 입력값은 로그아웃하면 지움(2026-11-12 QA 7구간 S7-06)
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
});
const { readDraft, writeDraft, SAVING_DRAFT_KEY, EMPTY_DRAFT } = await import('./saving-draft');
const { resetSessionState } = await import('../../shared/session-reset');

describe('W-11 입력값(sweetwo.savingDraft)', () => {
  it('기기에 두고 다시 읽음', () => {
    writeDraft({ ...EMPTY_DRAFT, name: '여행', monthly: 300_000 });
    expect(readDraft()).toMatchObject({ name: '여행', monthly: 300_000 });
  });
  it('로그아웃(resetSessionState)하면 지움', () => {
    writeDraft({ ...EMPTY_DRAFT, name: '여행' });
    resetSessionState();
    expect(mem.has(SAVING_DRAFT_KEY)).toBe(false);
    expect(readDraft()).toEqual(EMPTY_DRAFT);
  });
});
