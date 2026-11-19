import { describe, expect, it } from 'vitest';
import { autoShort, joinLineNote, savingLineNote } from './plan-line-note';

const won = (n: number) => (n % 10_000 === 0 ? `${n / 10_000}만 원` : `${n}원`);
const base = { saved: 0, target: null, pct: null, achieved: false, bundled: false };

describe('W-01 저축·투자 줄 보조 줄(2026-11-19 짧게)', () => {
  it('모은 금액 0원이면 “모은 금액 0원”을 뺌(목표도 없으면 줄 없음)', () => {
    expect(savingLineNote(base, won)).toBeUndefined();
  });
  it('목표 금액이 있고 모은 금액이 0원이면 “목표 금액 300만 원”', () => {
    expect(savingLineNote({ ...base, target: 3_000_000, pct: 0 }, won)).toBe('목표 금액 300만 원');
  });
  it('모은 금액이 있으면 “모은 금액 220만 원, 목표 금액의 22%”', () => {
    expect(savingLineNote({ ...base, saved: 2_200_000, target: 10_000_000, pct: 22 }, won)).toBe(
      '모은 금액 220만 원, 목표 금액의 22%',
    );
  });
  it('목표 금액이 없으면 모은 금액만, 달성이면 “달성”', () => {
    expect(savingLineNote({ ...base, saved: 2_200_000 }, won)).toBe('모은 금액 220만 원');
    expect(
      savingLineNote(
        { ...base, saved: 3_000_000, target: 3_000_000, pct: 100, achieved: true },
        won,
      ),
    ).toBe('모은 금액 300만 원, 달성');
  });
  it('같이 모으기에 든 저금은 내 몫만(0원이면 뺌)', () => {
    expect(savingLineNote({ ...base, saved: 1_000_000, bundled: true }, won)).toBe(
      '내 몫 100만 원',
    );
    expect(savingLineNote({ ...base, bundled: true }, won)).toBeUndefined();
  });
  it('자동 정보를 맨 앞에 둠: “25일 자동, 모은 금액 …”, 없으면 나머지만, 둘 다 없으면 undefined', () => {
    expect(joinLineNote(autoShort('25일'), ['모은 금액 220만 원'])).toBe(
      '25일 자동, 모은 금액 220만 원',
    );
    expect(joinLineNote(autoShort('월급날'), [undefined])).toBe('월급날 자동');
    expect(joinLineNote(undefined, ['목표 금액 300만 원'])).toBe('목표 금액 300만 원');
    expect(joinLineNote(undefined, [undefined])).toBeUndefined();
  });
});
