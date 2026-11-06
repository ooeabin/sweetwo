import { describe, expect, it } from 'vitest';
import { yearlySavings } from './year-summary';

describe('yearlySavings(25 S-18 PDF 연간 요약)', () => {
  it('체크한 저금 줄만, 실제로 넣은 돈(없으면 계획), 체크리스트 시작 달로', () => {
    const r = yearlySavings(
      [
        { cycleStart: '2026-01-25', state: 'checked', planned: 950_000, actual: null },
        { cycleStart: '2026-01-25', state: 'checked', planned: 300_000, actual: 200_000 },
        { cycleStart: '2026-02-25', state: 'skipped', planned: 950_000, actual: null },
        { cycleStart: '2026-03-25', state: 'wait', planned: 950_000, actual: null },
        { cycleStart: '2025-12-25', state: 'checked', planned: 950_000, actual: null },
        { cycleStart: '2026-10-10', state: 'checked', planned: 600_000, actual: null },
      ],
      2026,
    );
    expect(r).toEqual([1_150_000, 0, 0, 0, 0, 0, 0, 0, 0, 600_000, 0, 0]);
  });
});
