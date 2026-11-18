import { addDays, daysBetween } from '../date';
import type { Won } from '../money';
import { deadlineDay } from './saving-item';

// 저금 이름 칩과 다음 저금 권유(docs/spec/19 ‘이름 칩 표’, 20 W-11a·W-12b, G4).
// 칩은 코드만 돌려주고 이름(“결혼 비용” 등)은 앱 copy가 정함.

export type MarriageStatus = 'married' | 'engaged' | 'undecided' | 'dating' | 'living_together';
export type SavingChip =
  | 'wedding'
  | 'newlywed_home'
  | 'honeymoon'
  | 'dowry'
  | 'emergency'
  | 'home'
  | 'travel'
  | 'car'
  | 'childcare'
  | 'retire'
  | 'moving'
  | 'appliance'
  | 'anniv_gift'
  | 'date'
  | 'lump';

/**
 * 19 ‘이름 칩 표’(H-10 빈 상태, W-11a, W-12b가 같이 씀). 두 사람 사이마다 6개(2026-11-18).
 * ‘같이 살 집’은 칩에 없음. 결혼 말(‘신혼집’ ‘신혼여행’ ‘혼수’)은 결혼 준비 중에만.
 * 연애 중의 ‘결혼 비용’은 사용자 결정(2026-11-18)이라 결혼 말 규칙의 예외로 둠
 */
export const SAVING_CHIPS: Record<MarriageStatus, readonly SavingChip[]> = {
  engaged: ['wedding', 'newlywed_home', 'honeymoon', 'dowry', 'emergency', 'home'],
  married: ['home', 'travel', 'emergency', 'car', 'childcare', 'retire'],
  living_together: ['travel', 'moving', 'emergency', 'home', 'car', 'appliance'],
  dating: ['travel', 'emergency', 'anniv_gift', 'wedding', 'date', 'lump'],
  // 옛 값 ‘아직 안 정했어요’(O-11 4지선다 전)와 안 고름: 연애 중과 같은 칩 [확인 필요]
  undecided: ['travel', 'emergency', 'anniv_gift', 'wedding', 'date', 'lump'],
};

export const savingChips = (m: MarriageStatus | null | undefined): readonly SavingChip[] =>
  SAVING_CHIPS[m ?? 'undecided'];

/** H-10 빈 상태 칩(2026-11-18): 이름 칩 6개 + 맨 끝 ‘직접 정하기’(W-11a를 이름 칸 빈 채로 엶) */
export const savingStartChips = (
  m: MarriageStatus | null | undefined,
): (SavingChip | 'custom')[] => [...savingChips(m), 'custom'];

export interface NextSavingGoal {
  status: string;
  closed_at: string | null;
  target_amount: Won | null;
  /** 기한 'YYYY-MM'(또는 그 달 아무 날) */
  deadline: string | null;
  saved: Won;
}

/** 기한 지남(06 5-5): 기한 달 말일이 지났고 목표 금액에 못 닿음 */
export function deadlinePassed(g: NextSavingGoal, today: string): boolean {
  if (!g.deadline || g.target_amount === null || g.closed_at) return false;
  return deadlineDay(g.deadline) < today && g.saved < g.target_amount;
}

/** W-12b를 여는 까닭: 다 모음(achieved) / 기한 지남(deadline). 둘 다 아니면 null */
export function nextSavingReason(g: NextSavingGoal, today: string): 'achieved' | 'deadline' | null {
  if (g.status === 'achieved' || (g.target_amount !== null && g.saved >= g.target_amount))
    return 'achieved';
  return deadlinePassed(g, today) ? 'deadline' : null;
}

/** W-12b 선택지(20): 기한 지남이면 맨 위 ‘기한 새로 정하기’, 그다음 이름 칩 6개 + ‘직접 정할게요’ */
export function nextSavingOptions(
  reason: 'achieved' | 'deadline',
  m: MarriageStatus | null | undefined,
): ('redeadline' | SavingChip | 'custom')[] {
  return [...(reason === 'deadline' ? (['redeadline'] as const) : []), ...savingChips(m), 'custom'];
}

/** 다음 저금 띠 날 수(H-06 11번): 기한 지난 달 다음 달 1일부터 14일 */
export const NEXT_SAVING_TASK_DAYS = 14;

/** 다음 저금 띠(H-06 11번)가 열려 있나: 기한 지남이고 오늘이 기한 다음 달 1일부터 14일 안 */
export function nextSavingTaskOpen(g: NextSavingGoal, today: string): boolean {
  if (!g.deadline || !deadlinePassed(g, today)) return false;
  const from = addDays(deadlineDay(g.deadline), 1);
  const d = daysBetween(from, today);
  return d >= 0 && d < NEXT_SAVING_TASK_DAYS;
}
