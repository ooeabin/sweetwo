import { z } from 'zod';

// 자산 관리 서버 응답과 입력 검사(docs/spec/23-assets.md, 2026-11-12 QA 8구간 S8-12·S8-19).
// 응답은 앱이 쓰는 열을 검사하고, 비어 있을 수 있는 열은 없으면 null(앱 화면은 null만 다룸).

const won = z.number().int();
const nullableWon = won.nullable().default(null);
const nullableText = z.string().nullable().default(null);

/** asset 행(select *). 계산 열(asset_editable 등)은 받지 않음 */
export const AssetRowSchema = z.object({
  id: z.string(),
  space_id: z.string().default(''),
  side: z.enum(['asset', 'debt']),
  grp: z.string(),
  kind: z.string(),
  name: z.string(),
  amount: won,
  principal: nullableWon,
  estimated: z.boolean().default(false),
  owner: z.enum(['joint', 'person']),
  owner_user_id: nullableText,
  visibility: z.enum(['all', 'sum', 'private']),
  maturity_date: nullableText,
  monthly_payment: nullableWon,
  interest_rate: z.number().nullable().default(null),
  rate_estimated: z.boolean().default(false),
  paid_count: z.number().int().nullable().default(null),
  goal_id: nullableText,
  pay_from: nullableText,
  status: z.enum(['held', 'sold', 'matured']).default('held'),
  sold_at: nullableText,
  realized_gain: nullableWon,
  created_by: nullableText,
  updated_by: nullableText,
  created_at: z.string().default('1970-01-01T00:00:00Z'),
  updated_at: z.string().default('1970-01-01T00:00:00Z'),
  version: z.number().int().default(1),
  deleted_at: nullableText,
  deleted_by: nullableText,
});
export type AssetRow = z.output<typeof AssetRowSchema>;

/** asset_history 행. source: created(처음 값) / manual(직접 고침) / sell / matured / close(옛 월말 정리) */
export const AssetHistorySchema = z.object({
  id: z.number().int(),
  asset_id: z.string(),
  space_id: z.string().default(''),
  amount: won,
  principal: nullableWon,
  source: z.string(),
  recorded_at: z.string(),
  recorded_by: nullableText,
});
export type AssetHistoryRow = z.output<typeof AssetHistorySchema>;

/** partner_asset_sums(): 파트너 ‘금액만’ 묶음별 개수와 합계 */
export const PartnerAssetSumSchema = z.object({
  side: z.enum(['asset', 'debt']),
  grp: z.string(),
  n: z.number().int(),
  total: won,
  principal_total: won,
});
export type PartnerAssetSumRow = z.output<typeof PartnerAssetSumSchema>;

/** net_worth_history(): 월말 순자산 */
export const NetWorthMonthSchema = z.object({ month: z.string(), net: won, expected: won });

/**
 * 금리 입력(F-03g, F-04 3번, 2026-11-12 D5 = A): 0~30%, 소수 1자리까지. 빈칸은 null.
 * 서버 check(0~100, 소수 2자리)는 그대로 두고 앱이 이 규칙 하나로만 받음
 */
export const RateInput = z
  .string()
  .regex(/^\d{1,2}(\.\d)?$/)
  .transform(Number)
  .refine((n) => n >= 0 && n <= 30);

/** 납입 회차 입력(F-03f 청약, F-04 3번): 숫자 1~3자리(0~999). F-03과 F-04가 같은 규칙 */
export const PaidCountInput = z
  .string()
  .regex(/^\d{1,3}$/)
  .transform(Number);

/** 입력 글자 → 값. 빈칸 = null, 규칙 밖 = 'bad' */
export function parseRate(text: string): number | null | 'bad' {
  const t = text.trim();
  if (t === '') return null;
  const r = RateInput.safeParse(t);
  return r.success ? r.data : 'bad';
}
export function parsePaidCount(text: string): number | null | 'bad' {
  const t = text.trim();
  if (t === '') return null;
  const r = PaidCountInput.safeParse(t);
  return r.success ? r.data : 'bad';
}
