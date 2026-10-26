import { describe, expect, it } from 'vitest';
import { inQuiet, notiPrefs, pushAllowed } from './noti-prefs';

describe('알림 설정', () => {
  it('기본값: 챙길 날 D-14·당일만 꺼짐', () => {
    const p = notiPrefs({});
    expect(p.push && p.email).toBe(true);
    expect(p.topics.care_30.push).toBe(true);
    expect(p.topics.care_14).toEqual({ push: false, email: false });
    expect(p.topics.care_0.push).toBe(false);
  });
  it('저장된 값이 이김', () => {
    expect(notiPrefs({ topics: { care_0: { push: true } } }).topics.care_0).toEqual({
      push: true,
      email: false,
    });
  });
  it('방해 금지: 밤을 넘기는 시간', () => {
    expect([21, 22, 3, 7, 8].map((h) => inQuiet(h, 22, 8))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(inQuiet(13, 12, 14)).toBe(true);
    expect(inQuiet(5, 0, 0)).toBe(false);
  });
  it('OS 알림을 띄울지', () => {
    const q = { hour: 9, start: 22, end: 8 };
    const p = notiPrefs({});
    expect(pushAllowed(p, 'plan', q)).toBe(true);
    expect(pushAllowed(p, 'care_14', q)).toBe(false);
    expect(pushAllowed(p, 'other', q)).toBe(true);
    expect(pushAllowed({ ...p, push: false }, 'plan', q)).toBe(false);
    expect(pushAllowed(p, 'plan', { ...q, hour: 23 })).toBe(false);
  });
});
