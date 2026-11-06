import { describe, expect, it } from 'vitest';
import { bands } from './bands';
import {
  babyDeadline,
  monthlyNeed,
  recommendedGoals,
  skipsTopGoalQuestions,
  templateByKey,
  unsureDeadline,
} from './goals';
import { addYears, nextOccurrence, thisMonth } from './month';

const now = new Date('2026-10-15T03:00:00Z'); // KST 2026-10-15

describe('목표 템플릿', () => {
  it('O-23 내 집 마련 예: 5억 × 30% = 1억 5,000만 원, 5년 뒤 → 매달 250만 원(60개월)', () => {
    const home = templateByKey('home');
    const target = home?.target({ price: 500_000_000, ratio: 30 });
    expect(target).toBe(150_000_000);
    const deadline = home?.defaultDeadline({}, { now }).value ?? null;
    expect(deadline).toBe('2031-10');
    expect(monthlyNeed({ target: target ?? 0, deadline, now })).toEqual({
      need: 2_500_000,
      months: 60,
    });
  });
  it('자동차는 현금 비율 기본 50%', () => {
    expect(templateByKey('car')?.target({ price: 40_000_000 })).toBe(20_000_000);
  });
  it('합계형(이사, 반려동물)', () => {
    expect(templateByKey('moving')?.target({ deposit: 20_000_000, moving: 2_000_000 })).toBe(
      22_000_000,
    );
    expect(templateByKey('pet')?.target({ adopt: 1_000_000 })).toBeNull();
  });
  it('매달, 매년 목표는 O-24를 묻지 않는다', () => {
    for (const k of [
      'education',
      'retirement',
      'anniversary',
      'car_upkeep',
      'annual_fixed',
      'travel',
    ]) {
      expect(templateByKey(k)?.asksDeadline({})).toBe(false);
    }
    expect(templateByKey('custom')?.asksDeadline({ repeat: 'yearly' })).toBe(false);
    expect(templateByKey('custom')?.asksDeadline({ repeat: 'once' })).toBe(true);
  });
  it('여행: 매년이면 매년형, 기한은 가는 달', () => {
    const t = templateByKey('travel');
    expect(t?.kind({ yearly: 'yes' })).toBe('yearly');
    expect(t?.defaultDeadline({ when: '2027-05' }, { now }).value).toBe('2027-05');
  });
  it('연간 고정 지출: 합계, 기한은 가장 먼저 오는 달', () => {
    const items = [
      { name: '재산세', amount: 400_000, month: 7 },
      { name: '자동차보험', amount: 700_000, month: 12 },
    ];
    const t = templateByKey('annual_fixed');
    expect(t?.target({ items })).toBe(1_100_000);
    expect(t?.defaultDeadline({ items }, { now }).value).toBe('2026-12');
  });
  it('결혼기념일은 다음 기념일 달', () => {
    expect(
      templateByKey('anniversary')?.defaultDeadline({}, { now, weddingDate: '2025-05-17' }).value,
    ).toBe('2027-05');
    expect(nextOccurrence(10, now)).toBe('2026-10');
  });
});

describe('기한', () => {
  it('출산 준비(O-18): 1년 안 +1, 1~3년 +2, 3년 뒤 +4, 모르면 +3 추정', () => {
    expect(babyDeadline({ now, childPlan: 'within_1y' })).toEqual({
      value: '2027-10',
      estimated: false,
    });
    expect(babyDeadline({ now, childPlan: 'in_1_3y' })).toEqual({
      value: '2028-10',
      estimated: false,
    });
    expect(babyDeadline({ now, childPlan: 'after_3y' })).toEqual({
      value: '2030-10',
      estimated: false,
    });
    expect(babyDeadline({ now, childPlan: 'unsure' })).toEqual({
      value: '2029-10',
      estimated: true,
    });
  });
  it('잘 모르겠어요 = 3년 뒤 추정', () => {
    expect(unsureDeadline(now)).toEqual({ value: addYears(thisMonth(now), 3), estimated: true });
  });
  it('기한이 이번 달이거나 지났으면 1개월로 본다', () => {
    expect(monthlyNeed({ target: 1_000_000, deadline: '2026-10', now })).toEqual({
      need: 1_000_000,
      months: 1,
    });
    expect(monthlyNeed({ target: 1_000_000, deadline: null, now })).toBeNull();
  });
  it('보유액을 빼고 1만 원 단위 올림', () => {
    expect(monthlyNeed({ target: 10_000_000, held: 1_000_000, deadline: '2027-10', now })).toEqual({
      need: 750_000,
      months: 12,
    });
    expect(monthlyNeed({ target: 1_000_001, deadline: '2026-11', now })?.need).toBe(1_010_000);
  });
});

describe('온보딩 분기', () => {
  it('추천 배지', () => {
    expect(recommendedGoals(true)).toEqual(['wedding']);
    expect(recommendedGoals(false)).toEqual([]);
  });
  it('1순위 질문 생략', () => {
    expect(skipsTopGoalQuestions(undefined)).toBe(true);
    expect(skipsTopGoalQuestions('high_interest_loan')).toBe(false);
    expect(skipsTopGoalQuestions('home')).toBe(false);
  });

  it('구간 중간값(첫 구간 = 상한의 1/2, 끝 구간 = 하한)', () => {
    expect(bands.weddingBudget.map((b) => b.value / 10_000)).toEqual([
      1000, 2500, 4000, 7500, 10000,
    ]);
    expect(bands.goalAmount.map((b) => b.value / 10_000)).toEqual([500, 2000, 6500, 20000, 30000]);
  });
});
