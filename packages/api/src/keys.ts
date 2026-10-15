// TanStack Query 키는 여기에만 모은다.
export const qk = {
  me: ['me'] as const,
  space: ['space'] as const,
  goals: ['goals'] as const,
  fixedExpenses: ['fixed_expense'] as const,
  accounts: ['account'] as const,
  currentPlan: (today: string) => ['monthly_plan', today] as const,
  monthClose: (spaceId: string, month: string) => ['month_close', spaceId, month] as const,
};
