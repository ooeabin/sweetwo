import { z } from 'zod';

// 합류 흐름 서버 응답(docs/spec/18-partner-join.md, join_context RPC). 2026-11-11 D1: 합류를 마치기 전에는
// 공간 구성원이 아니라서 꼭 필요한 것만 이 RPC로 받음
export const JoinContextSchema = z
  .object({
    space_id: z.string(),
    member: z.boolean(),
    reserved_until: z.string().nullable(),
    starter_id: z.string().nullable(),
    starter_nickname: z.string().nullable(),
    salary_mode: z.enum(['separate', 'joint']),
    has_plan: z.boolean(),
    prefill: z.array(
      z.object({ id: z.string(), name: z.string(), amount: z.number(), estimated: z.boolean() }),
    ),
    joint: z
      .object({
        version: z.number(),
        lines: z.array(
          z.object({
            kind: z.enum([
              'saving',
              'fixed',
              'living',
              'allowance',
              'custom',
              'send',
              'shared_account',
            ]),
            amount: z.number(),
            goal_id: z.string().nullable(),
            user_id: z.string().nullable(),
            name: z.string().nullable(),
          }),
        ),
        items: z.array(
          z.object({
            id: z.string(),
            target: z.number().nullable(),
            deadline: z.string().nullable(),
            saved: z.number(),
          }),
        ),
      })
      .nullable(),
  })
  .nullable();
export type JoinContext = NonNullable<z.infer<typeof JoinContextSchema>>;
