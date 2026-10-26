import { describe, expect, it } from 'vitest';
import { conflictDecision } from './conflict';

const NOW = new Date('2026-10-27T10:00:00Z');
const row = (o: Record<string, unknown>) => ({
  updated_by: 'yebin',
  updated_at: '2026-10-27T09:59:30Z',
  target_amount: 100_000_000,
  deadline: '2030-12-01',
  ...o,
});

describe('conflictDecision(30 동기화 2장)', () => {
  it('배우자가 1분 안에 같은 칸을 다르게 바꿨으면 고르기', () => {
    expect(conflictDecision(row({}), { target_amount: 120_000_000 }, 'chanwoo', NOW)).toBe(
      'choose',
    );
  });
  it('1분이 넘었으면 마지막 저장 우선(덮음)', () => {
    expect(
      conflictDecision(
        row({ updated_at: '2026-10-27T09:58:59Z' }),
        { target_amount: 1 },
        'chanwoo',
        NOW,
      ),
    ).toBe('overwrite');
  });
  it('내가(다른 기기에서) 바꾼 것이면 덮음', () => {
    expect(
      conflictDecision(row({ updated_by: 'chanwoo' }), { target_amount: 1 }, 'chanwoo', NOW),
    ).toBe('overwrite');
  });
  it('이미 같은 값이면 할 일 없음(날짜 모양이 달라도)', () => {
    expect(conflictDecision(row({}), { target_amount: 100_000_000 }, 'chanwoo', NOW)).toBe('same');
    expect(conflictDecision(row({}), { deadline: '2030-12-01T00:00:00' }, 'chanwoo', NOW)).toBe(
      'same',
    );
  });
  it('오프라인 대기 입력은 배우자가 그 뒤에 바꿨으면 오래전이어도 고르기', () => {
    expect(
      conflictDecision(
        row({ updated_at: '2026-10-20T09:00:00Z' }),
        { target_amount: 1 },
        'chanwoo',
        NOW,
        { queued: true },
      ),
    ).toBe('choose');
  });
});
