import { describe, expect, it } from 'vitest';
import { assetFolds, assetFormReady, assetHero, soldFormReady, soldHero } from './form-logic';

const m = (v: number) => `${v / 10000}만 원`;
const base = {
  grp: 'deposit',
  kind: 'saving',
  name: '여행 적금',
  amount: 12_000_000,
  askVisibility: false,
  visibility: null,
  rateText: '',
  countText: '',
} as const;

describe('F-03 요약 문장', () => {
  const o = { money: m, what: '무엇을', ask: '얼마 적을까요?', verb: '적을까요?' };
  it('이름·금액이 모두 비면 자리표시', () => {
    expect(assetHero({ ...o, name: '', amount: null })).toEqual([
      [{ text: '무엇을' }],
      [{ text: '얼마 적을까요?' }],
    ]);
  });
  it('이름만 있으면 이름 + 금액 자리표시', () => {
    expect(assetHero({ ...o, name: ' 여행 적금 ', amount: null })[0]).toEqual([
      { text: '여행 적금' },
    ]);
  });
  it('금액 자리만 accent', () => {
    expect(assetHero({ ...o, name: '여행 적금', amount: 12_000_000 })).toEqual([
      [{ text: '여행 적금' }],
      [{ text: '1200만 원', tone: 'accent' }, { text: ' 적을까요?' }],
    ]);
  });
});

describe('F-04b 요약 문장', () => {
  const o = { money: m, ask: '얼마 받았어요?', verb: '받았어요', sellTail: '팔고' };
  it('조사는 받침으로', () => {
    expect(soldHero({ ...o, name: '미국 ETF', received: 8_400_000 })).toEqual([
      [{ text: '미국 ETF를 팔고' }],
      [{ text: '840만 원', tone: 'accent' }, { text: ' 받았어요' }],
    ]);
    expect(soldHero({ ...o, name: '주식', received: null })[0]).toEqual([{ text: '주식을 팔고' }]);
  });
  it('받은 금액이 0이면 자리표시', () => {
    expect(soldHero({ ...o, name: '주식', received: 0 })[1]).toEqual([{ text: '얼마 받았어요?' }]);
  });
});

describe('필수 검사', () => {
  it('묶음·종류·이름·금액이 있어야 함', () => {
    expect(assetFormReady({ ...base })).toBe(true);
    expect(assetFormReady({ ...base, grp: null })).toBe(false);
    expect(assetFormReady({ ...base, kind: null })).toBe(false);
    expect(assetFormReady({ ...base, name: '  ' })).toBe(false);
    expect(assetFormReady({ ...base, amount: null })).toBe(false);
    expect(assetFormReady({ ...base, amount: 0 })).toBe(true);
  });
  it('공개 범위는 물을 때 고를 때까지 비활성(미리 고른 값 없음)', () => {
    expect(assetFormReady({ ...base, askVisibility: true, visibility: null })).toBe(false);
    expect(assetFormReady({ ...base, askVisibility: true, visibility: 'sum' })).toBe(true);
  });
  it('금리·회차는 적었으면 규칙 안이어야 함(안 적으면 나중에)', () => {
    expect(assetFormReady({ ...base, rateText: '31' })).toBe(false);
    expect(assetFormReady({ ...base, rateText: '3.5' })).toBe(true);
    expect(assetFormReady({ ...base, countText: '1000' })).toBe(false);
  });
  it('팔았어요: 받은 금액 0 초과, 일부면 남은 평가금액', () => {
    expect(soldFormReady({ received: null, part: false, remain: null })).toBe(false);
    expect(soldFormReady({ received: 0, part: false, remain: null })).toBe(false);
    expect(soldFormReady({ received: 100, part: false, remain: null })).toBe(true);
    expect(soldFormReady({ received: 100, part: true, remain: null })).toBe(false);
    expect(soldFormReady({ received: 100, part: true, remain: 0 })).toBe(true);
  });
});

describe('종류별 선택 항목', () => {
  it('적금 = 만기일 + 월 납입액, 청약 = 납입 회차 + 월 납입액, 보증금 = 계약 만기일', () => {
    expect(assetFolds({ side: 'asset', grp: 'deposit', kind: 'saving' })).toEqual([
      'maturity',
      'payment',
    ]);
    expect(
      assetFolds({ side: 'asset', grp: 'subscription', kind: 'housing_subscription' }),
    ).toEqual(['count', 'payment']);
    expect(assetFolds({ side: 'asset', grp: 'real_estate', kind: 'deposit_money' })).toEqual([
      'maturity',
    ]);
    expect(assetFolds({ side: 'asset', grp: 'cash', kind: 'bank' })).toEqual([]);
  });
  it('부채 = 매달 갚는 금액 → 금리(주택 대출도)', () => {
    expect(assetFolds({ side: 'debt', grp: 'housing_loan', kind: 'mortgage' })).toEqual([
      'payment',
      'rate',
    ]);
    expect(assetFolds({ side: 'debt', grp: 'credit', kind: 'credit_loan' })).toEqual([
      'payment',
      'rate',
    ]);
  });
});
