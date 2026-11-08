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
  // 상시 경보(27 AD-01 1번). 지금은 AD-19 평균 금리 90일 넘음만
  alerts: z.array(z.object({ kind: z.string(), value: z.number(), limit: z.number() })).default([]),
  // 2026-11-06 AD-01 4~7번: 회원 현황, 최근 7일 추이, 앱 버전, 최근 활동(운영·CS·최고 관리자만, 아니면 null)
  members: z
    .object({
      total: z.number(),
      joined_today: z.number(),
      joined_yesterday: z.number(),
      deletion_today: z.number(),
      connected: z.number(),
    })
    .nullable()
    .default(null),
  trend: z
    .array(
      z.object({ day: z.string(), joined: z.number(), connected: z.number(), checked: z.number() }),
    )
    .nullable()
    .default(null),
  versions: z
    .object({
      below_min: z.number(),
      top: z.array(z.object({ platform: z.string(), version: z.string(), devices: z.number() })),
    })
    .nullable()
    .default(null),
  recent: z
    .object({
      approvals: z.number().nullable(),
      inquiries: z
        .array(
          z.object({
            id: z.string(),
            no: z.string(),
            category: z.string(),
            channel: z.string(),
            status: z.string(),
            created_at: z.string(),
          }),
        )
        .nullable(),
      audit: z
        .array(
          z.object({
            at: z.string(),
            admin_email: z.string().nullable(),
            action: z.string(),
            screen: z.string(),
          }),
        )
        .nullable(),
    })
    .nullable()
    .default(null),
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
  // 2026-11-06 추가(AD-03 4·5번). 예전 서버 응답에도 맞게 기본값
  salary_mode: z.enum(['separate', 'joint']).nullable().default(null),
  checklist: z
    .object({ state: z.string(), label: z.string(), checked: z.number(), total: z.number() })
    .nullable()
    .default(null),
  devices: z
    .array(z.object({ platform: z.string(), app_version: z.string(), last_seen_at: z.string() }))
    .default([]),
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
  /** 이메일 문의만: 제목, 가린 보낸 주소(전체 주소는 보여 주지 않음), 받지 않은 첨부 수 */
  email: z
    .object({
      from_masked: z.string().nullable(),
      subject: z.string().nullable(),
      attachments: z.number(),
    })
    .nullable()
    .optional(),
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
// 2026-11-06: 지금 앱에 있는 화면만(‘월급 플랜’ plan은 month와 같은 데이터, ‘월말 정리’ close와 ‘월 수입·지출’ income_spend는 없앤 화면).
// 예전 요청 기록의 키는 그대로 읽음. goals = 월급 화면(2026-11-08 ADR 0007, 목표 탭 자리, 키는 그대로).
export const ACCESS_SCOPES = ['month', 'goals', 'assets', 'calendar'] as const;

// ── AD-10 공지 대상(27 AD-10·11 2·4번) ───────────────────────────────────
/** 커플 상태: 미합류 / 연결 / 해제 대기 / 혼자 쓰기(AD-03과 같은 값) */
export const NOTICE_COUPLE_STATES = ['not_joined', 'connected', 'unlink_pending', 'solo'] as const;
export const NOTICE_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/**
 * 공지 대상 조건(notice.target, 서버 notice_target_valid와 같은 모양). 빈 객체 = 모두.
 * 금액·목표 금액 조건은 없음. 가입 주차는 가입한 날이 1주차.
 */
export const NoticeTarget = z
  .object({
    couple_states: z.array(z.enum(NOTICE_COUPLE_STATES)).min(1).optional(),
    version_below: z.string().regex(NOTICE_VERSION).optional(),
    weeks_min: z.number().int().min(1).max(520).optional(),
    weeks_max: z.number().int().min(1).max(520).optional(),
  })
  .strict()
  .refine(
    (t) => t.weeks_min === undefined || t.weeks_max === undefined || t.weeks_min <= t.weeks_max,
  );
export type NoticeTarget = z.infer<typeof NoticeTarget>;

/** 대상 수(숫자만). 메일이면 반송·수신 거부로 막힌 주소를 제외(blocked)로 */
export const NoticeAudience = z.object({
  target: z.number().int(),
  excluded: z.number().int(),
  blocked: z.number().int(),
});
export type NoticeAudience = z.infer<typeof NoticeAudience>;

/** 앱이 읽는 공지(my_notices) */
export const ActiveNotice = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  importance: z.enum(['normal', 'must']).catch('normal'),
  platforms: z.array(z.string()),
});
export type ActiveNotice = z.infer<typeof ActiveNotice>;
