import { describe, expect, it } from 'vitest';
import {
  CARE_ART_KEYS,
  MONEY_ART_KEYS,
  careArtDefault,
  careArtKey,
  dayArt,
  dayTone,
  isCareArtKey,
  monthSummary,
  moneyArtKey,
  weekIndexOf,
} from './calendar-view';

describe('경조사 그림 키', () => {
  it('Illustrations 10번의 12개', () => {
    expect(CARE_ART_KEYS).toHaveLength(12);
    expect(new Set(CARE_ART_KEYS).size).toBe(12);
  });
  it('이름 칩마다 기본값(Illustrations 10번 쓰는 곳)', () => {
    expect(careArtDefault('birthday')).toBe('cake');
    expect(careArtDefault('dating_anniversary')).toBe('heart');
    expect(careArtDefault('anniversary')).toBe('diamond');
    expect(careArtDefault('event')).toBe('gift');
    expect(careArtDefault('custom')).toBe('gift');
    expect(careArtDefault('parents_day')).toBe('flower-tulip');
    expect(careArtDefault('seollal')).toBe('moon-stars');
    expect(careArtDefault('chuseok')).toBe('moon-stars');
  });
  it('모르는 종류는 gift, 기본값은 모두 12개 안', () => {
    expect(careArtDefault('something_new')).toBe('gift');
    for (const k of ['birthday', 'anniversary', 'seollal', 'event', 'custom', 'x'])
      expect(isCareArtKey(careArtDefault(k))).toBe(true);
  });
  it('저장한 키가 12개 안이면 그것, 없거나 모르는 값이면 종류 기본값', () => {
    expect(careArtKey({ kind: 'birthday', art_key: 'baby' })).toBe('baby');
    expect(careArtKey({ kind: 'birthday', art_key: null })).toBe('cake');
    expect(careArtKey({ kind: 'event' })).toBe('gift');
    expect(careArtKey({ kind: 'birthday', art_key: 'wallet' })).toBe('cake');
  });
  it('금융 일정은 종류별 고정 4개, 확인 목록·자동 줄은 그림 없음', () => {
    expect(MONEY_ART_KEYS).toHaveLength(4);
    expect(moneyArtKey('payday')).toBe('wallet');
    expect(moneyArtKey('maturity')).toBe('vault');
    expect(moneyArtKey('deadline')).toBe('flag-pennant');
    expect(moneyArtKey('goal')).toBe('flag-pennant');
    expect(moneyArtKey('note')).toBe('receipt');
    expect(moneyArtKey('review')).toBeNull();
    expect(moneyArtKey('auto')).toBeNull();
  });
});

describe('달 요약 줄', () => {
  const c = (...b: number[]) => b.map((budget) => ({ budget }));
  it('경조사 수와 금액 메모 합', () => {
    expect(
      monthSummary({ filter: 'all', cares: c(300_000, 50_000, 500_000), moneyCount: 4 }),
    ).toEqual({ kind: 'care', count: 3, budget: 850_000 });
  });
  it('금액 메모가 하나도 없으면 금액 없음', () => {
    expect(monthSummary({ filter: 'care', cares: c(0, 0), moneyCount: 0 })).toEqual({
      kind: 'care',
      count: 2,
      budget: null,
    });
  });
  it('경조사 0개면 줄 없음(금융 일정이 있어도)', () => {
    expect(monthSummary({ filter: 'all', cares: [], moneyCount: 5 })).toBeNull();
  });
  it('금융 일정 필터는 금융 일정 수, 0개면 줄 없음', () => {
    expect(monthSummary({ filter: 'money', cares: c(100), moneyCount: 4 })).toEqual({
      kind: 'money',
      count: 4,
      budget: null,
    });
    expect(monthSummary({ filter: 'money', cares: c(100), moneyCount: 0 })).toBeNull();
  });
});

describe('칸 숫자 상태', () => {
  it('일정 있는 날은 일정 우선(지난 날이어도)', () => {
    expect(dayTone('2026-12-09', '2026-12-10', 1)).toBe('event');
    expect(dayTone('2026-12-12', '2026-12-10', 2)).toBe('event');
  });
  it('일정 없는 지난 날은 past, 오늘·앞 날은 plain', () => {
    expect(dayTone('2026-12-08', '2026-12-10', 0)).toBe('past');
    expect(dayTone('2026-12-10', '2026-12-10', 0)).toBe('plain');
    expect(dayTone('2026-12-11', '2026-12-10', 0)).toBe('plain');
  });
});

describe('칸 그림과 +n', () => {
  it('첫 일정 그림 + 나머지 개수', () => {
    expect(dayArt(['cake'])).toEqual({ first: 'cake', more: 0 });
    expect(dayArt(['wallet', 'cake'])).toEqual({ first: 'wallet', more: 1 });
    expect(dayArt(['cake', null, 'gift'])).toEqual({ first: 'cake', more: 2 });
  });
  it('일정이 없거나 첫 일정 그림이 없으면 없음', () => {
    expect(dayArt([])).toBeNull();
    expect(dayArt([null, 'cake'])).toBeNull();
  });
});

describe('한 주로 접기', () => {
  const dates = Array.from({ length: 35 }, (_, i) => `d${i}`);
  it('고른 날이 든 주 줄 번호', () => {
    expect(weekIndexOf(dates, 'd0')).toBe(0);
    expect(weekIndexOf(dates, 'd6')).toBe(0);
    expect(weekIndexOf(dates, 'd7')).toBe(1);
    expect(weekIndexOf(dates, 'd34')).toBe(4);
    expect(weekIndexOf(dates, 'none')).toBe(0);
  });
});
