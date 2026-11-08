import { describe, expect, it } from 'vitest';
import {
  celebrationStory,
  deadlineDay,
  defaultDeadline,
  monthsLeft,
  reachedTarget,
  savedFromLines,
  savingBar,
  savingEta,
  savingItemInput,
  savingLate,
  savingNeed,
  savingPct,
  savingState,
} from './saving-item';

// 기획서 예시(06 4장·5장, 20 W-11): 찬우 저금 항목 내 집 마련(목표 1억 5,000만, 기한 2031년 10월, 매달 95만), 오늘 2026년 10월
const now = new Date('2026-10-26T03:00:00Z');
const line = (state: string, planned: number, actual: number | null = null, goal_id = 'h') => ({
  goal_id,
  kind: 'saving',
  state,
  planned,
  actual,
});

describe('모은 돈(06 4장)', () => {
  it('10월 95만 체크, 11월 다른 금액 60만, 12월 못 함 → 155만', () => {
    expect(
      savedFromLines('h', [
        line('checked', 950_000),
        line('checked', 950_000, 600_000),
        line('skipped', 950_000),
      ]),
    ).toBe(1_550_000);
  });
  it('체크 안 한 줄과 다른 항목 줄은 더하지 않음', () => {
    expect(savedFromLines('h', [line('wait', 950_000), line('checked', 300_000, null, 's')])).toBe(
      0,
    );
  });
});

describe('진행(06 5-1)', () => {
  it('2,700만 ÷ 1억 5,000만 = 18%', () => expect(savingPct(27_000_000, 150_000_000)).toBe(18));
  it('목표 금액이 없으면 진행률 없음', () => expect(savingPct(1_000_000, null)).toBeNull());
  it('100% 상한', () => expect(savingPct(2_000_000, 1_000_000)).toBe(100));
  it('막대는 모은 돈이 있으면 최소 2%', () => {
    expect(savingBar(10_000, 150_000_000)).toBe(2);
    expect(savingBar(0, 150_000_000)).toBe(0);
  });
});

describe('기한(06 5-2, 2026-11-09 그 달 말일)', () => {
  it('2026년 11월까지 = 11월 30일, 2028년 2월 = 29일', () => {
    expect(deadlineDay('2026-11')).toBe('2026-11-30');
    expect(deadlineDay('2026-11-01')).toBe('2026-11-30');
    expect(deadlineDay('2028-02')).toBe('2028-02-29');
    expect(deadlineDay('2026-12')).toBe('2026-12-31');
  });
  it('남은 개월은 기한 달까지: 2026년 10월 → 2031년 10월 = 61개월, 같은 달 = 1', () => {
    expect(monthsLeft('2031-10', now)).toBe(61);
    expect(monthsLeft('2026-10', now)).toBe(1);
  });
  it('W-11d 처음 값 = 1년 뒤 같은 달(20)', () => {
    expect(defaultDeadline(now)).toBe('2027-10');
    expect(defaultDeadline(new Date('2026-12-31T16:00:00Z'))).toBe('2028-01');
  });
});

describe('월 필요액(06 5-2)', () => {
  it('1억 5,000만 ÷ 61개월 = 246만(1만 원 단위 올림)', () =>
    expect(savingNeed({ target: 150_000_000, saved: 0, deadline: '2031-10' }, now)).toBe(
      2_460_000,
    ));
  it('1만 원 단위 올림: 100만 ÷ 4개월(10월~1월) = 25만', () =>
    expect(savingNeed({ target: 1_000_000, saved: 0, deadline: '2027-01' }, now)).toBe(250_000));
  it('기한이 이번 달이면 남은 금액 전부', () =>
    expect(savingNeed({ target: 2_000_000, saved: 0, deadline: '2026-10' }, now)).toBe(
      2_000_000,
    ));
  it('기한이 없으면 없음', () =>
    expect(savingNeed({ target: 150_000_000, saved: 0, deadline: null }, now)).toBeNull());
  it('이미 다 모았으면 0', () =>
    expect(savingNeed({ target: 1_000_000, saved: 1_200_000, deadline: '2027-10' }, now)).toBe(0));
});

describe('예상 달성(06 5-3)', () => {
  it('1억 5,000만 ÷ 95만 = 158개월째 → 2039년 11월(이번 달이 1개월째)', () =>
    expect(savingEta({ target: 150_000_000, saved: 0 }, 950_000, now)).toBe('2039-11'));
  it('한 달에 다 모으면 이번 달', () =>
    expect(savingEta({ target: 900_000, saved: 0 }, 950_000, now)).toBe('2026-10'));
  it('매달 0원이면 없음', () =>
    expect(savingEta({ target: 150_000_000, saved: 0 }, 0, now)).toBeNull());
  it('목표 금액이 없으면 없음', () =>
    expect(savingEta({ target: null, saved: 0 }, 1, now)).toBeNull());
});

describe('기한보다 늦어짐(06 5-4, 20 W-10 3번)', () => {
  const o = { target: 2_000_000, saved: 0, deadline: '2026-11' as const };
  it('200만, 11월까지, 매달 20만 → 월 필요액 100만 > 20만, 예상 2027년 7월 → 8개월 늦어요', () => {
    expect(savingNeed(o, now)).toBe(1_000_000);
    expect(savingEta(o, 200_000, now)).toBe('2027-07');
    expect(savingLate(o, 200_000, now)).toBe(8);
  });
  it('내 집 마련 매달 95만, 2031년 10월까지(필요 246만) → 2039년 11월, 97개월 늦어요', () =>
    expect(
      savingLate({ target: 150_000_000, saved: 0, deadline: '2031-10' }, 950_000, now),
    ).toBe(97));
  it('월 필요액 이하로 모으면 없음', () => {
    expect(savingLate(o, 1_000_000, now)).toBeNull();
    expect(savingLate(o, 2_000_000, now)).toBeNull();
  });
  it('기한·목표 금액이 없거나 매달 0원이면 없음', () => {
    expect(savingLate({ ...o, deadline: null }, 100_000, now)).toBeNull();
    expect(savingLate({ ...o, target: null }, 100_000, now)).toBeNull();
    expect(savingLate(o, 0, now)).toBeNull();
  });
});

describe('달성과 그만 모음(20)', () => {
  const g = { status: 'active', closed_at: null, target_amount: 1_000_000 };
  it('모은 돈이 목표 금액에 닿으면 달성 축하', () => {
    expect(reachedTarget(g, 1_000_000)).toBe(true);
    expect(reachedTarget(g, 999_999)).toBe(false);
  });
  it('목표 금액이 없거나 이미 달성·그만 모음이면 아님', () => {
    expect(reachedTarget({ ...g, target_amount: null }, 5_000_000)).toBe(false);
    expect(reachedTarget({ ...g, status: 'achieved' }, 5_000_000)).toBe(false);
    expect(reachedTarget({ ...g, closed_at: '2026-11-01' }, 5_000_000)).toBe(false);
  });
  it('상태', () => {
    expect(savingState({ status: 'active', closed_at: null })).toBe('saving');
    expect(savingState({ status: 'achieved', closed_at: null })).toBe('achieved');
    expect(savingState({ status: 'achieved', closed_at: '2026-11-01' })).toBe('closed');
  });
});

describe('저금 항목 추가 입력(W-11)', () => {
  const ok = { name: '내 집 마련', monthly: 950_000, target: 150_000_000, deadline: '2031-10' };
  it('예시는 통과', () => expect(savingItemInput(now).safeParse(ok).success).toBe(true));
  it('매달 금액은 1만 원 단위', () =>
    expect(savingItemInput(now).safeParse({ ...ok, monthly: 955_000 }).success).toBe(false));
  it('기한은 목표 금액이 있을 때만', () =>
    expect(savingItemInput(now).safeParse({ ...ok, target: null }).success).toBe(false));
  it('이번 달 이전 기한은 안 됨', () =>
    expect(savingItemInput(now).safeParse({ ...ok, deadline: '2026-09' }).success).toBe(false));
  it('이름은 20자까지', () =>
    expect(savingItemInput(now).safeParse({ ...ok, name: '가'.repeat(21) }).success).toBe(false));
});

it('달성 축하 문장: 모두 함께 / 일부 / 혼자, 모은 달이 없으면 없음(20 W-12)', () => {
  expect(celebrationStory(16, 16, false)).toEqual({ kind: 'all', months: 16, together: 16 });
  expect(celebrationStory(16, 14, false)).toEqual({ kind: 'some', months: 16, together: 14 });
  expect(celebrationStory(16, 0, false)).toEqual({ kind: 'solo', months: 16, together: 0 });
  expect(celebrationStory(16, 14, true)).toEqual({ kind: 'solo', months: 16, together: 0 });
  expect(celebrationStory(0, 0, false)).toBeNull();
});
