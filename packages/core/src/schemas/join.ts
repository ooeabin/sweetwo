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
    // v2.2(20261205090000): 관리 형태(P-04 형태 이름 확인). 옛 서버 응답에는 없어서 기본값
    shared_living: z.boolean().nullable().default(null),
    shared_saving: z.boolean().nullable().default(null),
    /** 한 사람 관리형의 관리하는 사람: 시작한 사람 / 합류한 사람(합류 전 ‘파트너가 주로 해요’) */
    manager: z.enum(['starter', 'joiner']).nullable().default(null),
    style: z
      .enum(['one_manager', 'together', 'living_saving', 'living_only', 'saving_only', 'separate'])
      .nullable()
      .default(null),
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

/** 대기 화면 ‘알려 주기’ nudge_starter 응답(18 v2.2) */
export const NudgeResultSchema = z.enum(['sent', 'too_soon', 'not_waiting']);
export type NudgeResult = z.infer<typeof NudgeResultSchema>;
