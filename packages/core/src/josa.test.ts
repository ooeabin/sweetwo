import { describe, expect, it } from 'vitest';
import { isWord, object, subject, topic, withAnd } from './josa';

it('받침에 따라 은/는', () => {
  expect(topic('내 집 마련')).toBe('내 집 마련은');
  expect(topic('여행')).toBe('여행은');
  expect(topic('비상금')).toBe('비상금은');
  expect(topic('결혼 비용')).toBe('결혼 비용은');
  expect(topic('자동차')).toBe('자동차는');
  expect(topic('iPad')).toBe('iPad는');
});

describe('을/를', () => {
  it('받침', () => {
    expect(object('안마기')).toBe('안마기를');
    expect(object('꽃다발')).toBe('꽃다발을');
  });
});

describe('와/과', () => {
  it('받침', () => {
    expect(withAnd('찬우')).toBe('찬우와');
    expect(withAnd('예빈')).toBe('예빈과');
  });
});

it('주격과 서술(서버 ko_subj, ko_is와 같음)', () => {
  expect(subject('청년 적금')).toBe('청년 적금이');
  expect(subject('어머니 생신')).toBe('어머니 생신이');
  expect(subject('예금')).toBe('예금이');
  expect(subject('펀드')).toBe('펀드가');
  expect(isWord('어머니 생신')).toBe('어머니 생신이에요');
  expect(isWord('설날')).toBe('설날이에요');
  expect(isWord('추석 연휴')).toBe('추석 연휴예요');
});
