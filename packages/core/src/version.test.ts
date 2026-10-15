import { describe, expect, it } from 'vitest';
import { compareVersions, isBelowMin } from './version';

describe('버전 비교', () => {
  it('숫자로 비교', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('0.9.0-beta.1', '0.9.0')).toBe(0);
  });
  it('최소 지원 버전 미만', () => {
    expect(isBelowMin('1.2.3', '1.3.0')).toBe(true);
    expect(isBelowMin('1.3.0', '1.3.0')).toBe(false);
    expect(isBelowMin('0.0.0', '0.0.0')).toBe(false);
  });
});
