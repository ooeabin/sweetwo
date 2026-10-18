import { z } from 'zod';

// 어드민 함수가 돌려주는 jsonb(27 어드민 화면). 서버 응답은 Zod로 검사한다.

export const AdminRole = z.enum(['super', 'ops', 'cs', 'analyst']);
export type AdminRole = z.infer<typeof AdminRole>;

export const AdminMe = z.object({
  email: z.string(),
  name: z.string(),
  roles: z.array(AdminRole),
  mfa: z.boolean(),
  last_seen_at: z.string().nullable(),
});
export type AdminMe = z.infer<typeof AdminMe>;

export const AdminDashboard = z.object({
  inquiries: z.object({ received: z.number(), in_progress: z.number() }),
  failed: z.object({ plans: z.number(), notifications: z.number() }),
  at: z.string(),
});
export type AdminDashboard = z.infer<typeof AdminDashboard>;

const AccessRow = z.object({
  id: z.string(),
  status: z.string(),
  scope: z.array(z.string()),
  raw: z.boolean().optional(),
  expires_at: z.string().nullable(),
});

export const AdminUserDetail = z.object({
  user_id: z.string(),
  email_masked: z.string().nullable(),
  provider: z.string().nullable(),
  created_at: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  status: z.string(),
  deletion_requested_at: z.string().nullable(),
  space_id: z.string().nullable(),
  couple_state: z.string().nullable(),
  marriage_status: z.string().nullable(),
  partner_id: z.string().nullable(),
  subscription: z.string(),
  invites: z.array(
    z.object({ created_at: z.string(), expires_at: z.string(), used_at: z.string().nullable() }),
  ),
  consents: z.array(
    z.object({ kind: z.string(), version: z.string(), agreed: z.boolean(), at: z.string() }),
  ),
  counts: z.object({
    assets: z.number(),
    assets_estimated: z.number(),
    goals: z.number(),
    closes: z.number(),
  }),
  plan_status: z.string().nullable(),
  sessions: z.number(),
  access: z.array(AccessRow),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetail>;

export const AdminReveal = z.object({
  email: z.string().nullable().optional(),
  sign_ins: z
    .array(
      z.object({
        created_at: z.string().nullable(),
        updated_at: z.string().nullable(),
        user_agent: z.string().nullable(),
      }),
    )
    .optional(),
  payments: z.array(z.unknown()).optional(),
});
export type AdminReveal = z.infer<typeof AdminReveal>;

export const AdminInquiry = z.object({
  id: z.string(),
  no: z.string(),
  category: z.string(),
  status: z.string(),
  channel: z.string(),
  user_id: z.string().nullable(),
  created_at: z.string(),
  done_at: z.string().nullable(),
  attach: z.record(z.unknown()).nullable(),
  messages: z.array(z.object({ author: z.string(), body: z.string(), created_at: z.string() })),
  access: z.array(AccessRow),
});
export type AdminInquiry = z.infer<typeof AdminInquiry>;

/** L2 보기: 범위별로 오는 값(금액은 구간 글자 또는 원값) */
const amount = z.union([z.string(), z.number()]).nullable();
export const AdminAccessData = z.object({
  expires_at: z.string(),
  raw: z.boolean(),
  scope: z.array(z.string()),
  income_spend: z
    .object({
      monthly_income: amount,
      fixed_total: amount,
      living_budget: amount,
      loan_repayment: amount,
    })
    .optional(),
  goals: z
    .array(
      z.object({
        name: z.string(),
        kind: z.string(),
        status: z.string(),
        deadline: z.string().nullable(),
        target: amount,
      }),
    )
    .optional(),
  assets: z
    .array(
      z.object({
        name: z.string(),
        grp: z.string(),
        side: z.string(),
        estimated: z.boolean(),
        amount,
      }),
    )
    .optional(),
  plan: z
    .object({
      label_month: z.string(),
      cycle_start: z.string(),
      cycle_end: z.string(),
      status: z.string(),
      lines: z.number(),
      done: z.number(),
    })
    .nullable()
    .optional(),
  close: z
    .object({ status: z.string(), closed_at: z.string().nullable(), income: amount, spent: amount })
    .nullable()
    .optional(),
  calendar: z.array(z.object({ name: z.string(), kind: z.string() })).optional(),
});
export type AdminAccessData = z.infer<typeof AdminAccessData>;

/** 사용자 화면 범위(S-19b와 같은 키) */
export const ACCESS_SCOPES = [
  'month',
  'plan',
  'close',
  'goals',
  'assets',
  'income_spend',
  'calendar',
] as const;
