import { fetchWeddingItems, fetchWeddingPayments, qk } from '@sweetwo/api';
import {
  addDays,
  daysBetween,
  monthsBetween,
  proposalApplyOn,
  thisMonth,
  todayKst,
  weddingMonths,
  weddingSummary,
} from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGoalsData } from '../data';

export const weddingPath = '/goals/wedding';
export const weddingItemPath = (id: string | 'new', step: 'a' | 'b' | 'c' | 'd' = 'a') =>
  `/goals/wedding/item/${id}/${step}`;
export const weddingPayPath = (id: string, part: 'deposit' | 'balance') =>
  `/goals/wedding/pay/${id}/${part}`;

// 결혼 비용 화면 데이터(22 G-07): 공간(총예산, 양가 지원, 예식일), 결혼 비용 목표(모아둔 돈 = 보유액, 월 모으기 = 배분), 항목, 결제.
export function useWedding() {
  const d = useGoalsData();
  const items = useQuery({ queryKey: qk.weddingItems, queryFn: fetchWeddingItems });
  const pays = useQuery({ queryKey: qk.weddingPayments, queryFn: fetchWeddingPayments });
  const qc = useQueryClient();
  const sp = d.space;
  const goal = d.view?.lines.find((l) => l.template === 'wedding') ?? null;
  const now = thisMonth();
  const loading = d.loading || items.isLoading || pays.isLoading;
  const list = items.data ?? [];
  const payments = pays.data ?? [];
  const budget = sp?.wedding_budget ?? 0;
  const support = sp?.family_support ?? 0;
  const saved = goal ? goal.held : (sp?.wedding_saved ?? 0);
  const monthlyPlan = goal?.alloc ?? 0;
  const end = goal?.deadline ?? (sp?.wedding_date ? sp.wedding_date.slice(0, 7) : null);
  const monthsLeft = end ? monthsBetween(now, end) : 0;
  const summary = weddingSummary({
    budget,
    support,
    saved,
    monthlyPlan,
    monthsLeft,
    items: list,
    payments,
  });
  const months = end
    ? weddingMonths({
        from: now,
        to: end as `${number}-${string}`,
        saved,
        monthlyPlan,
        items: list,
        payments,
      })
    : { months: [], total: 0 };
  return {
    d,
    loading,
    items: list,
    payments,
    goal,
    budget,
    support,
    saved,
    summary,
    months,
    dday: sp?.wedding_date ? daysBetween(todayKst(), sp.wedding_date) : null,
    applyOn: d.base !== null ? proposalApplyOn(d.base) : addDays(todayKst(), 3),
    refresh: () =>
      Promise.all(
        [qk.weddingItems, qk.weddingPayments, qk.space, qk.goals, qk.goalRecords, qk.proposals].map(
          (k) => qc.invalidateQueries({ queryKey: k }),
        ),
      ),
  };
}
export type WeddingData = ReturnType<typeof useWedding>;
