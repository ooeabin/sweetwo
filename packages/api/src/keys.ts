// TanStack Query 키는 여기에만 모은다.
export const qk = {
  me: ['me'] as const,
  space: ['space'] as const,
  goals: ['goals'] as const,
  partner: ['partner'] as const,
  proposals: ['proposal'] as const,
  fixedExpenses: ['fixed_expense'] as const,
  accounts: ['account'] as const,
  currentPlan: (today: string) => ['monthly_plan', today] as const,
  todos: ['todo'] as const,
  spendCategories: ['spend_category'] as const,
  monthClose: (planId: string) => ['month_close', planId] as const,
};
