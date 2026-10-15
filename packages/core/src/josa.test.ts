import { expect, it } from 'vitest';
import { topic } from './josa';

it('받침에 따라 은/는', () => {
  expect(topic('내 집 마련')).toBe('내 집 마련은');
  expect(topic('여행')).toBe('여행은');
  expect(topic('비상금')).toBe('비상금은');
  expect(topic('결혼 비용')).toBe('결혼 비용은');
  expect(topic('자동차')).toBe('자동차는');
  expect(topic('iPad')).toBe('iPad는');
});
