import { describe, expect, it } from 'vitest';
import { checkCells, checkHeadline, splitCheckLines } from './month-check';

const L = (state: string, sort: number, auto = false) => ({ state, sort, auto });

describe('W-02 칸 막대', () => {
  it('칸 수 = 줄 수, 채운 칸 = 대기가 아닌 줄', () => {
    const c = checkCells([L('checked', 1), L('skipped', 2), L('wait', 3), L('wait', 4, true)]);
    expect(c).toEqual({ total: 4, filled: 2, segmented: true });
  });
  it('12개까지는 칸, 13개부터 이어진 막대', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => L('wait', i));
    expect(checkCells(mk(12)).segmented).toBe(true);
    expect(checkCells(mk(13)).segmented).toBe(false);
    expect(checkCells([]).segmented).toBe(false);
  });
});

describe('W-02 한 목록 정렬', () => {
  it('남은 줄(손·자동) 먼저, 확인·건너뛴 줄은 아래, 각각 템플릿 순서', () => {
    const lines = [
      { id: 'a', ...L('checked', 1) },
      { id: 'b', ...L('wait', 2, true) },
      { id: 'c', ...L('skipped', 3) },
      { id: 'd', ...L('wait', 4) },
      { id: 'e', ...L('wait', 0) },
    ];
    const r = splitCheckLines(lines);
    expect(r.open.map((l) => l.id)).toEqual(['e', 'b', 'd']);
    expect(r.done.map((l) => l.id)).toEqual(['a', 'c']);
  });
});

describe('W-02 큰 숫자', () => {
  it('월급날 전은 D-n, 당일은 D-day', () => {
    expect(checkHeadline({ preview: { today: '2026-10-19', payday: '2026-10-25' } }).text).toBe(
      'D-6',
    );
    expect(checkHeadline({ preview: { today: '2026-10-25', payday: '2026-10-25' } }).kind).toBe(
      'dday',
    );
  });
  it('확인 중은 남은 손 줄 수(자동 줄은 세지 않음)', () => {
    const h = checkHeadline({
      lines: [L('wait', 1), L('wait', 2), L('wait', 3, true), L('checked', 4)],
    });
    expect(h).toEqual({ kind: 'left', text: '2개 남음' });
  });
  it('손 줄을 다 끝냈으면 확인 끝(건너뜀 포함, 자동 줄이 남아도)', () => {
    expect(
      checkHeadline({ lines: [L('checked', 1), L('skipped', 2), L('wait', 3, true)] }),
    ).toEqual({ kind: 'done', text: '확인 끝' });
  });
});
