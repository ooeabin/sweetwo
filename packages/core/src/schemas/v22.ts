import { z } from 'zod';

// v2.2 서버 응답 검사(ADR 0009, 마이그레이션 20261201090000~20261204090000의 RPC·새 표).
// RPC jsonb 응답과 새 표 행. 비어 있을 수 있는 열은 없으면 null(앱 화면은 null만 다룸).

const won = z.number().int();
const nullableWon = won.nullable().default(null);
const nullableText = z.string().nullable().default(null);
const ts = z.string();

// ───────── 관리 형태(PR 3) ─────────
export const ManageStyleCode = z.enum([
  'one_manager',
  'together',
  'living_saving',
  'living_only',
  'saving_only',
  'separate',
]);
/** my_manage_style() 행 */
export const MyManageStyleSchema = z.object({
  salary_mode: z.enum(['separate', 'joint']),
  manager_user_id: nullableText,
  shared_living: z.boolean().nullable().default(null),
  shared_saving: z.boolean().nullable().default(null),
  style: ManageStyleCode,
});
export type MyManageStyle = z.infer<typeof MyManageStyleSchema>;
/** request_mode_change 응답 */
export const ModeChangeResult = z.enum(['applied', 'requested']);
/** answer_mode_change·answer_split·answer_rank_consent 응답 */
export const AnswerResult = z.enum(['accepted', 'declined', 'expired']);
export type AnswerResult = z.infer<typeof AnswerResult>;

export const ModeChangeRequestRowSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  from_user: z.string(),
  to_mode: z.enum(['separate', 'joint']),
  to_manager: nullableText,
  to_shared_living: z.boolean(),
  to_shared_saving: z.boolean().nullable().default(null),
  phrase: z.enum(['p04_send', 's11f_combine', 's11f_manager']),
  status: z.enum(['open', 'accepted', 'declined', 'cancelled', 'expired']),
  created_at: ts,
  expires_at: ts,
  answered_at: nullableText,
});
export type ModeChangeRequestRow = z.infer<typeof ModeChangeRequestRowSchema>;

// ───────── 공개 단계(PR 3) ─────────
export const PlanShareSchema = z.enum(['all', 'saving_only', 'done_only']);
const lineKind = z.enum([
  'saving',
  'fixed',
  'living',
  'allowance',
  'custom',
  'send',
  'shared_account',
]);
/** partner_plan_view(p_viewer) 응답. 상대가 없으면 null */
export const PartnerPlanViewSchema = z
  .object({
    owner: z.string(),
    nickname: nullableText,
    share: PlanShareSchema,
    mode: z.enum(['separate', 'joint']),
    hidden: z.boolean(),
    income: nullableWon,
    payday: z.number().int().nullable().default(null),
    lines: z.array(
      z.object({
        id: z.string(),
        kind: lineKind,
        goal_id: nullableText,
        name: nullableText,
        user_id: nullableText,
        amount: nullableWon,
        in_checklist: z.boolean(),
        auto_pay: z.boolean(),
        state: nullableText,
      }),
    ),
  })
  .nullable();
export type PartnerPlanViewResponse = z.infer<typeof PartnerPlanViewSchema>;

// ───────── 월급 변경(PR 3) ─────────
export const SalaryChangeRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  space_id: z.string(),
  amount: won,
  effective_from: z.string(),
  until_month: nullableText,
  revert_amount: nullableWon,
  applied_at: nullableText,
  reverted_at: nullableText,
  cancelled_at: nullableText,
  created_at: ts,
});
export type SalaryChangeRowResponse = z.infer<typeof SalaryChangeRowSchema>;

/** home_task_state 행 */
export const HomeTaskStateSchema = z.object({
  user_id: z.string(),
  task_key: z.string(),
  state: z.enum(['dismissed', 'done']),
  at: ts,
});

// ───────── 같이 모으기(PR 4) ─────────
/** bundle_view(p_bundle) 응답 원소 */
export const BundleViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'achieved', 'closed']),
  deadline: nullableText,
  paused: z.boolean(),
  percent_only: z.boolean(),
  show_each: z.boolean(),
  my_show_each: z.boolean(),
  my_percent_only: z.boolean(),
  pct: z.number().int().nullable().default(null),
  total: nullableWon,
  target: nullableWon,
  mine: nullableWon,
  partner: nullableWon,
  goals: z.array(z.object({ id: z.string(), mine: z.boolean(), name: z.string() })),
});
export const BundleViewListSchema = z.array(BundleViewSchema);
export type BundleViewResponse = z.infer<typeof BundleViewSchema>;

/** money_in 행 */
export const MoneyInKindSchema = z.enum(['salary', 'bonus', 'family', 'work', 'refund', 'etc']);
export const MoneyInRowSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  owner_user_id: z.string(),
  amount: won,
  received_on: z.string(),
  kind: MoneyInKindSchema,
  created_at: ts,
  deleted_at: nullableText,
});
export type MoneyInRowResponse = z.infer<typeof MoneyInRowSchema>;

/** money_in_period(p_user, p_today) 응답(core moneyInPeriod와 같은 값, 이름만 snake) */
export const MoneyInPeriodSchema = z
  .object({
    status: z.enum(['none', 'early', 'bar', 'gap']),
    start: nullableText,
    end: nullableText,
    day: z.number().int().nullable().default(null),
    received: won,
    needed: nullableWon,
    gap_days: z.number().int().nullable().default(null),
  })
  .transform((v) => ({
    status: v.status,
    start: v.start,
    end: v.end,
    day: v.day,
    received: v.received,
    needed: v.needed,
    gapDays: v.gap_days,
  }));

/** saving_note 행 */
export const SavingNoteRowSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  goal_id: nullableText,
  bundle_id: nullableText,
  name: z.string(),
  amount: nullableWon,
  due_on: nullableText,
  paid: z.boolean(),
  paid_at: nullableText,
  paid_move_id: nullableText,
  created_by: nullableText,
  created_at: ts,
  deleted_at: nullableText,
});
export type SavingNoteRow = z.infer<typeof SavingNoteRowSchema>;

/** shared_account 행(분담) */
export const SharedAccountRowSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  name: z.string(),
  monthly_total: won,
  rule: z.enum(['half', 'income_ratio', 'custom']),
  member_a: z.string(),
  member_b: z.string(),
  share_a: won,
  share_b: won,
  ratio_a: z.number().int(),
  status: z.enum(['proposed', 'accepted', 'declined', 'expired', 'cancelled']),
  proposed_by: z.string(),
  expires_at: ts,
  answered_at: nullableText,
  created_at: ts,
});
export type SharedAccountRow = z.infer<typeof SharedAccountRowSchema>;

/** goal_move_public 뷰 행(사유 글 없음) */
export const GoalMovePublicSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  goal_id: z.string(),
  kind: z.enum(['in', 'out']),
  amount: won,
  created_by: nullableText,
  created_at: ts,
  reason_code: z
    .enum(['fix', 'used', 'interest', 'reconcile', 'note_paid', 'custom', 'auto'])
    .nullable()
    .default(null),
  hide_from_summary: z.boolean().default(false),
  money_in_id: nullableText,
  note_id: nullableText,
});
export type GoalMovePublic = z.infer<typeof GoalMovePublicSchema>;

// ───────── 순위·자산(PR 5) ─────────
const band = z.enum(['20s', '30s', '40s', '50s', '60s']).nullable().default(null);
/** networth_rank_pair()·record_rank_view() 응답 */
export const RankPairSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('pair'),
    net: won,
    top_pct: z.number().int(),
    top_open: z.boolean(),
    band,
    basis: z.enum(['all', 'age']),
  }),
  z.object({ mode: z.literal('peer'), band, median: nullableWon }),
]);
export type RankPairResponse = z.infer<typeof RankPairSchema>;

export const RankConsentRequestRowSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  from_user: z.string(),
  status: z.enum(['open', 'accepted', 'declined', 'expired', 'cancelled']),
  created_at: ts,
  expires_at: ts,
  answered_at: nullableText,
});
export type RankConsentRequestRow = z.infer<typeof RankConsentRequestRowSchema>;

/** networth_summary() 응답 */
export const NetworthSummarySchema = z
  .object({ assets: won, debts: won, net: won, principal_net: won })
  .transform((v) => ({
    assets: v.assets,
    debts: v.debts,
    net: v.net,
    principalNet: v.principal_net,
  }));

/** reconnect_request 행 */
export const ReconnectRequestRowSchema = z.object({
  id: z.string(),
  from_user: z.string(),
  to_user: z.string(),
  created_at: ts,
  status: z.enum(['open', 'accepted', 'declined', 'silenced']),
  blocked: z.boolean(),
  answered_at: nullableText,
  invite_code: nullableText,
});

/** 알림 종류 켜기(app_user.push_kinds, 없는 키 = 켬) */
export const PUSH_KINDS = [
  'care',
  'payday',
  'achieved',
  'shared_change',
  'my_allowance',
  'progress_news',
] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export const PushKindsSchema = z.record(z.string(), z.boolean()).default({});
/** 그 종류가 켜져 있나(없는 키 = 켬, 서버 push_kind_on) */
export const pushKindOn = (kinds: Record<string, boolean> | null | undefined, k: PushKind) =>
  kinds?.[k] !== false;
