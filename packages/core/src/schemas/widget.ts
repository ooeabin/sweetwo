import { z } from 'zod';

// 트레이 위젯(26 트레이 위젯 창) 값. 앱 창이 계산해 데스크톱 main으로 보내고, 위젯 창이 받아 그림(브리지를 거치므로 검사).
export const TraySnapshot = z.object({
  /** 만든 시각(ISO). 오프라인이면 “오전 10:30 기준” */
  at: z.string(),
  /** split = 월급 나누기 남은 몫, living = 이번 달 남은 생활비, gather = 결혼 자금 모으기, no_plan = 온보딩 전 */
  kind: z.enum(['split', 'living', 'gather', 'no_plan']),
  amount: z.number().int(),
  over: z.boolean(),
  /** 가림일 때 큰 숫자: 나눈 비율 또는 생활비 남은 %(없으면 null) */
  pct: z.number().int().nullable(),
  done: z.number().int(),
  total: z.number().int(),
  /** 다음 내 월급날 일(1~31) */
  payday: z.number().int().nullable(),
  /** 월말 정리 기간이면 D-n */
  closeDays: z.number().int().nullable(),
  task: z.object({ title: z.string(), to: z.string() }).nullable(),
  days: z
    .array(
      z.object({
        dday: z.number().int(),
        name: z.string(),
        date: z.string(),
        money: z.boolean(),
        to: z.string(),
      }),
    )
    .max(3),
  /** 누르면 갈 곳(이번 달 줄) */
  to: z.string(),
  unlink: z.boolean(),
});
export type TraySnapshot = z.infer<typeof TraySnapshot>;

/** 위젯 설정(S-22, 기기마다) */
export const WidgetSettings = z.object({
  tray: z.boolean(),
  showAmounts: z.boolean(),
  goalId: z.string().nullable(),
});
export type WidgetSettings = z.infer<typeof WidgetSettings>;
export const WIDGET_DEFAULTS: WidgetSettings = { tray: true, showAmounts: false, goalId: null };

/** 트레이 창이 받는 상태: 로그인 전, 잠김, 값 */
export const TrayState = z.object({
  signedIn: z.boolean(),
  locked: z.boolean(),
  snapshot: TraySnapshot.nullable(),
  settings: WidgetSettings,
});
export type TrayState = z.infer<typeof TrayState>;
