import { describe, expect, it } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { routes } from '../routes';
import { screenIdOf } from './screen-id';

// 경로 표의 모든 화면 주소가 화면 ID를 갖는지(옮김·옛 주소는 빼고), 주소 안 값은 보내지 않는지
const REDIRECTS = new Set([
  '/goals',
  '/goals/:id/*',
  '/salary/split',
  '/salary/done',
  '/salary/review',
  '/salary/bundles/:id', // 묶음 알림 링크(옮김)
  '/settings/me/salary-mode',
  '/auth/callback',
  '*',
  '/dev/ui',
]);
const allPaths = (rs: RouteObject[]): string[] =>
  rs.flatMap((r) => [...(r.path ? [r.path] : []), ...allPaths(r.children ?? [])]);
const sample = (p: string) =>
  p
    .replace(/\/:[a-z]+\?/gi, '')
    .replace(/:screen/, 'o-31')
    .replace(/:[a-z]+/gi, 'abc');

describe('screenIdOf', () => {
  it.each(allPaths(routes).filter((p) => !REDIRECTS.has(p)))('%s → 화면 ID', (p) => {
    expect(screenIdOf(sample(p))).toMatch(/^[A-Z]-\d{2}[a-z]?$/);
  });
  it('월급 탭은 보기로 나눔', () => {
    expect(screenIdOf('/salary')).toBe('W-02');
    expect(screenIdOf('/salary', '?view=plan')).toBe('W-01');
  });
  it('온보딩·합류는 주소 끝 화면 ID', () => {
    expect(screenIdOf('/onboarding/o-30b')).toBe('O-30b');
    expect(screenIdOf('/join/p-05c')).toBe('P-05c');
  });
  it('id·초대 코드는 결과에 없음', () => {
    expect(screenIdOf('/i/ABCD1234')).toBe('P-01');
    expect(screenIdOf('/salary/items/0b7c3c1e-1111-4222-8333-444455556666/edit/name')).toBe(
      'W-10a',
    );
    expect(screenIdOf('/nope/zzz')).toBeNull();
  });
});
