import { describe, expect, it } from 'vitest';
import {
  allocate,
  cutSpending,
  emergencyBase,
  extendDeadlines,
  lowerTargets,
  type AllocGoal,
} from './allocation';
import { diagnose, needsLook } from './diagnosis';
import { formatYm } from './month';

const M = 10_000;
const now = new Date('2026-10-15T03:00:00Z'); // KST 2026-10-15
const goal = (o: Partial<AllocGoal> & Pick<AllocGoal, 'id' | 'template'>): AllocGoal => ({
  name: o.template,
  kind: 'once',
  priority: 1,
  target: null,
  held: 0,
  deadline: null,
  ...o,
});

// 온보딩 ② 예시: 저축 가능 240만, 비상금 = (130 + 130) × 3 = 780만 12개월, 내 집 1.5억 60개월
const emergency = goal({
  id: 'e',
  template: 'emergency',
  priority: 0,
  target: 780 * M,
  deadline: '2027-10',
});
const home = goal({
  id: 'h',
  template: 'home',
  priority: 1,
  target: 15_000 * M,
  deadline: '2031-10',
});
const travel = goal({ id: 't', template: 'travel', priority: 2 });

describe('목표 배분(06 4장)', () => {
  it('비상금 먼저, 남은 돈은 다음 순위가 받고 모자라면 부족', () => {
    const a = allocate(240 * M, [travel, home, emergency], now);
    expect(a.lines.map((l) => [l.goal.id, l.need, l.alloc])).toEqual([
      ['e', 65 * M, 65 * M],
      ['h', 250 * M, 175 * M],
      ['t', null, 0],
    ]);
    expect(a.short).toBe(true);
    expect(a.shortfall).toBe(75 * M);
    expect(a.emergency).toBe(65 * M);
    expect(a.goals).toBe(175 * M);
    expect(a.lines[0]?.expected).toBe('2027-10');
    expect(a.lines[1]?.expected).toBe('2033-12'); // 1.5억 ÷ 175만 = 86개월 뒤
  });
  it('다 채우고 남으면 주거 목표에 더함', () => {
    const a = allocate(400 * M, [home, emergency], now);
    expect(a.short).toBe(false);
    expect(a.lines.find((l) => l.goal.id === 'h')?.alloc).toBe(335 * M);
  });
  it('결혼 비용은 비상금 다음, 사용자 목표보다 먼저. 결혼 후 목표는 배분 없음', () => {
    const wedding = goal({
      id: 'w',
      template: 'wedding',
      priority: 0,
      target: 3_000 * M,
      deadline: '2027-05',
    });
    const after = goal({
      id: 'x',
      template: 'home',
      priority: 1,
      target: 100 * M,
      deadline: '2027-10',
      afterMarriage: true,
    });
    const a = allocate(1_000 * M, [after, wedding, emergency], now);
    expect(a.lines.map((l) => l.goal.id)).toEqual(['e', 'w']);
  });
  it('저축 가능 금액이 0 이하면 배분 0', () => {
    const a = allocate(-10 * M, [emergency], now);
    expect(a.lines[0]?.alloc).toBe(0);
    expect(a.lines[0]?.expected).toBeNull();
  });
});

describe('부족 조정 안', () => {
  const a = allocate(240 * M, [home, emergency], now);
  it('기한 연장: 지금 배분액으로 채우는 달', () => {
    expect(extendDeadlines(a, now)).toEqual([{ goal: home, deadline: '2033-12' }]);
  });
  it('금액 조정: 기한까지 모을 수 있는 금액', () => {
    expect(lowerTargets(a, now)).toEqual([{ goal: home, target: 10_500 * M }]);
  });
  it('배분 0인 목표가 모자라면 기한, 금액 안은 없음', () => {
    const b = allocate(65 * M, [home, emergency], now);
    expect(extendDeadlines(b, now)).toBeNull();
    expect(lowerTargets(b, now)).toBeNull();
  });
  it('지출 줄이기: 생활비부터, 모자라면 내 용돈(합류 전 용돈은 두 배로 효과)', () => {
    expect(
      cutSpending({
        shortfall: 75 * M,
        livingBudget: 130 * M,
        myAllowance: 50 * M,
        allowanceFactor: 2,
      }),
    ).toEqual({
      livingBudget: 55 * M,
      myAllowance: 50 * M,
      livingCut: 75 * M,
      allowanceCut: 0,
    });
    expect(
      cutSpending({
        shortfall: 150 * M,
        livingBudget: 130 * M,
        myAllowance: 50 * M,
        allowanceFactor: 2,
      }),
    ).toEqual({
      livingBudget: 0,
      myAllowance: 40 * M,
      livingCut: 130 * M,
      allowanceCut: 10 * M,
    });
    expect(
      cutSpending({
        shortfall: 300 * M,
        livingBudget: 130 * M,
        myAllowance: 50 * M,
        allowanceFactor: 1,
      }),
    ).toBeNull();
  });
});

describe('비상금 기준과 재정 진단(06 8장)', () => {
  it('정규직만이면 3개월, 한 명이라도 다른 형태면 6개월', () => {
    expect(
      emergencyBase({ fixed: 130 * M, living: 130 * M, employments: ['regular', null] }),
    ).toEqual({ months: 3, amount: 780 * M });
    expect(
      emergencyBase({ fixed: 130 * M, living: 130 * M, employments: ['regular', 'freelance'] })
        .months,
    ).toBe(6);
  });
  it('온보딩 예시: 저축률 40% 양호, 대출 5% 양호, 고정 21.7% 양호, 비상금·투자 원칙은 아직 몰라요', () => {
    const d = diagnose({
      income: 600 * M,
      saving: 240 * M,
      emergencyBalance: null,
      emergencyBase: 780 * M,
      loanRepayment: 30 * M,
      fixed: 130 * M,
      invest: null,
    });
    expect(d.map((x) => [x.key, x.signal, x.pct])).toEqual([
      ['savingRate', 'good', 40],
      ['emergency', 'unknown', null],
      ['loanBurden', 'good', 5],
      ['fixedRatio', 'good', 21.7],
      ['investPrinciple', 'unknown', null],
    ]);
    expect(needsLook(d)).toEqual([]);
  });
  it('경계값: 저축률 10%는 주의, 대출 35%는 주의, 고정 60% 초과는 위험, 수입 0이면 아직 몰라요', () => {
    const d = diagnose({
      income: 100 * M,
      saving: 10 * M,
      emergencyBalance: 390 * M,
      emergencyBase: 780 * M,
      loanRepayment: 35 * M,
      fixed: 61 * M,
      invest: 'one',
    });
    expect(d.map((x) => x.signal)).toEqual(['caution', 'caution', 'caution', 'danger', 'caution']);
    const z = diagnose({
      income: 0,
      saving: 0,
      emergencyBalance: null,
      emergencyBase: 0,
      loanRepayment: 0,
      fixed: 0,
      invest: 'none',
    });
    expect(z.map((x) => x.signal)).toEqual(['unknown', 'unknown', 'unknown', 'unknown', 'danger']);
  });
});

it('연월 표시', () => {
  expect(formatYm('2033-12')).toBe('2033년 12월');
  expect(formatYm('2027-05-01')).toBe('2027년 5월');
});
