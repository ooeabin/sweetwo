import { z } from 'zod';
import { Constants } from '../db.types';

// 경조사 서버 응답 검사(docs/spec/24-calendar.md, 2026-11-12 QA 9구간 S9-15). 열은 db.types 행 그대로,
// 열거형은 db.types Constants에서. 옛 열(member_id, side, carer, secret 등)도 받기만 함(재기획으로 새로 안 씀).
// 앱이 판단에 쓰는 열(이름, 날짜 규칙, 금액, 상태)은 꼭 있어야 하고, 기록용 열은 없으면 기본값(자산 응답과 같은 방식).

const E = Constants.public.Enums;
const text = z.string().nullable().default(null);
const EPOCH = '1970-01-01T00:00:00Z';

/** care_day 행(select *) */
export const CareDaySchema = z.object({
  id: z.string(),
  space_id: z.string().default(''),
  category: z.enum(E.care_category),
  kind: z.string(),
  name: z.string(),
  member_id: text,
  side: z.enum(E.couple_side).nullable().default(null),
  date_rule: z.enum(E.care_date_rule),
  month: z.number().int().nullable().default(null),
  day: z.number().int().nullable().default(null),
  leap: z.boolean().default(false),
  once_on: text,
  budget: z.number().int().default(0),
  carer: z.enum(E.care_carer).default('together'),
  alerts: z.array(z.number().int()).default([]),
  status: z.enum(E.care_status).default('todo'),
  status_on: text,
  memo: text,
  secret: z.boolean().default(false),
  auto: text,
  auto_moves: z.boolean().default(true),
  created_by: text,
  updated_by: text,
  created_at: z.string().default(EPOCH),
  updated_at: z.string().default(EPOCH),
  version: z.number().int().default(1),
  deleted_at: text,
  deleted_by: text,
});
export type CareDayRow = z.output<typeof CareDaySchema>;

/** care_record 행(select *) */
export const CareRecordSchema = z.object({
  id: z.string(),
  space_id: z.string().default(''),
  care_day_id: z.string(),
  member_id: text,
  occurs_on: z.string(),
  amount: z.number().int(),
  paid_from: z.enum(E.paid_from),
  gifts: z.array(z.string()).default([]),
  gift_name: text,
  memo: text,
  created_by: text,
  updated_by: text,
  created_at: z.string().default(EPOCH),
  updated_at: z.string().default(EPOCH),
  version: z.number().int().default(1),
  deleted_at: text,
  deleted_by: text,
});
export type CareRecordRow = z.output<typeof CareRecordSchema>;

/** record_care 돌려줌: 기록 id(사진 붙일 때). line은 옛 값(늘 0) */
export const RecordCareResultSchema = z.object({
  record: z.string().min(1),
  line: z.number().int().default(0),
});
