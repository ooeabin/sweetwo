import { z } from 'zod';

// 월 플랜 생성 시점 기준값(monthly_plan.snapshot, O-66 start_first_plan). 화면은 이 스키마로 읽는다.
const won = z.number().int();
export const PlanSnapshot = z
  .object({
    baseDay: z.union([z.number().int().min(1).max(31), z.literal('last')]),
    parts: z.object({ living: won, goalFund: won, emergency: won }),
    income: won,
    saveable: won,
    basis: z.enum(['couple', 'mine']),
  })
  .partial();
export type PlanSnapshot = z.infer<typeof PlanSnapshot>;

/** 깨진 값이면 빈 기준값(화면은 계산값으로 대신 보여 줌) */
export const readPlanSnapshot = (v: unknown): PlanSnapshot => {
  const r = PlanSnapshot.safeParse(v);
  return r.success ? r.data : {};
};
