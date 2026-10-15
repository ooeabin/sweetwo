import { describe, expect, it } from 'vitest';
import { spendTotal, defaultSpendCategories } from './spend';
import { todoDefs, visibleTodos, type TodoState } from './todo';

const base: TodoState = {
  startedOn: '2026-10-07',
  joined: false,
  solo: false,
  separate: false,
  engaged: false,
  weddingDateUnknown: false,
  noLoan: false,
  noSaving: false,
  estimates: 1,
  splitDeferred: false,
};

describe('첫 주 할 일(17 O-67 표)', () => {
  it('오늘 초대, 2일째 자산, 3일째 대출, 4일째 고정지출, 5일째 나머지, 7일째 투자 원칙', () => {
    expect(todoDefs(base).map((d) => [d.kind, d.openOn, d.minutes])).toEqual([
      ['invite', '2026-10-07', 1],
      ['assets', '2026-10-08', 3],
      ['loans', '2026-10-09', 2],
      ['fixed_card', '2026-10-10', 2],
      ['rest', '2026-10-11', 3],
      ['invest', '2026-10-13', 1],
    ]);
  });
  it('생략: 합류했거나 혼자 쓰기면 초대 없음, 대출 없음, 각자 관리 예비부부는 고정지출 없음', () => {
    const kinds = todoDefs({ ...base, joined: true, noLoan: true, separate: true }).map(
      (d) => d.kind,
    );
    expect(kinds).toEqual(['assets', 'rest', 'invest']);
    expect(todoDefs({ ...base, solo: true }).map((d) => d.kind)).not.toContain('invite');
  });
  it('지출 점검이 맨 위, 추정값 3개 이상이면 정확한 값 입력, 예식일 미정이면 예식일 정하기', () => {
    const kinds = todoDefs({
      ...base,
      noSaving: true,
      estimates: 3,
      engaged: true,
      weddingDateUnknown: true,
    })
      .slice(0, 4)
      .map((d) => d.kind);
    expect(kinds).toEqual(['spend_check', 'invite', 'exact_values', 'wedding_date']);
  });
  it('하루 하나씩 열리고, 미룬 것은 다음 날, 끝낸 것은 빠짐', () => {
    const defs = todoDefs(base);
    expect(visibleTodos(defs, [], '2026-10-08').map((d) => d.kind)).toEqual(['invite', 'assets']);
    const rows = [
      { kind: 'invite', status: 'done' as const, snoozed_until: null },
      { kind: 'assets', status: 'snoozed' as const, snoozed_until: '2026-10-09' },
    ];
    expect(visibleTodos(defs, rows, '2026-10-08').map((d) => d.kind)).toEqual([]);
    expect(visibleTodos(defs, rows, '2026-10-09').map((d) => d.kind)).toEqual(['assets', 'loans']);
  });
});

describe('지출 적기(W-04j)', () => {
  it('기본 항목 18개, 쓴 돈 = 고정 + 변동(비운 칸 0)', () => {
    expect(defaultSpendCategories).toHaveLength(18);
    expect(spendTotal([1_000_000, 300_000], [410_000, null, 90_000])).toEqual({
      fixed: 1_300_000,
      variable: 500_000,
      total: 1_800_000,
    });
  });
});
