import { z } from 'zod';

// 트레이 위젯(26 트레이 위젯 창) 값. 앱 창이 계산해 데스크톱 main으로 보내고, 위젯 창이 받아 그림(브리지를 거치므로 검사).
export const TraySnapshot = z.object({
  /** 만든 시각(ISO). 오프라인이면 “오전 10:30 기준” */
  at: z.string(),
  /** 이번 달 월급(WG-01): none = 온보딩 전, no_salary = 월급 없음, progress·review(월말 확인 기간)·done */
  salary: z.object({
    state: z.enum(['none', 'no_salary', 'progress', 'review', 'done']),
    label: z.string(),
    done: z.number().int(),
    total: z.number().int(),
    left: z.number().int(),
    /** 다음 월급날(YYYY-MM-DD) */
    payday: z.string().nullable(),
  }),
  /** 다음 할 일(홈 H-06과 같음) */
  task: z.object({ title: z.string(), to: z.string() }).nullable(),
  /** 다가오는 날(WG-03) 가까운 3개 */
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
