import { z } from 'zod';

// 알림 센터 행(14 N-01~N-03, 표 notification). 앱이 쓰는 칸만 검사하고 나머지는 버림(2026-11-12 QA 10구간 S10-13).
// 비어도 되는 칸은 없거나 이상하면 null
const opt = z.string().nullable().catch(null);
export const NotiRow = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  body: opt,
  /** 갈 화면(앱 안 경로) */
  target: z.string().startsWith('/'),
  /** 센터 표시 아이콘(Phosphor 이름, lead-kinds.ts noti) */
  icon: opt,
  /** 한 사람(Avatar) */
  actor_id: opt,
  created_at: z.string().min(1),
  read_at: opt,
});
export type NotiRow = z.infer<typeof NotiRow>;

/** 맞는 행만 남김(이상한 행 하나 때문에 목록 전체를 버리지 않음) */
export function parseNotiRows(data: unknown): NotiRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((x) => {
    const r = NotiRow.safeParse(x);
    return r.success ? [r.data] : [];
  });
}

/** 더 불러오기 커서: 같은 시각 알림도 빠지지 않게 (만든 때, id) 둘 다(최신순, id 내림차순) */
export type NotiCursor = { at: string; id: string };
export const notiCursor = (page: NotiRow[], size: number): NotiCursor | undefined => {
  const last = page[page.length - 1];
  return page.length >= size && last ? { at: last.created_at, id: last.id } : undefined;
};
