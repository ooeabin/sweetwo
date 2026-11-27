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
  | 'lump'
  // 2026-11-27 사용자 결정: 칩 묶음 + 칩 이름은 한 가지만(‘출산·육아’ → childcare ‘육아’ + birth ‘출산’, ‘가전·가구’ → appliance ‘가전’ + furniture ‘가구’)
  | 'birth'
  | 'furniture'
  | 'child_edu'
  | 'self_dev'
  | 'family_event'
  | 'holiday'
  | 'yearly'
  | 'housing_sub'
  | 'installment'
  | 'invest'
  | 'pension';

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

/** W-11a 칩 묶음(2026-11-27 사용자 결정, 19 ‘이름 칩 표’): ‘추천’(위 두 사람 사이 6개) 다음 주제마다 한 묶음. 묶음 이름은 앱 copy */
export type SavingChipGroup =
  | 'marriage'
  | 'house'
  | 'together'
  | 'family'
  | 'living'
  | 'emergency'
  | 'big_spend'
  | 'finance'
  | 'retire';
export const SAVING_CHIP_GROUPS: readonly {
  group: SavingChipGroup;
  chips: readonly SavingChip[];
}[] = [
  { group: 'marriage', chips: ['wedding', 'honeymoon', 'dowry'] },
  { group: 'house', chips: ['newlywed_home', 'home', 'moving', 'appliance', 'furniture'] },
  { group: 'together', chips: ['travel', 'date', 'anniv_gift'] },
  { group: 'family', chips: ['birth', 'childcare', 'child_edu'] },
  { group: 'living', chips: ['car', 'self_dev'] },
  { group: 'emergency', chips: ['emergency', 'lump'] },
  { group: 'big_spend', chips: ['family_event', 'holiday', 'yearly'] },
  { group: 'finance', chips: ['housing_sub', 'installment', 'invest'] },
  { group: 'retire', chips: ['pension', 'retire'] },
];

/**
 * 결혼 말 규칙(04, CLAUDE.md ‘결혼 말’): 결혼했어요·결혼 준비 중이 아니면 ‘결혼’ 묶음 전체와 ‘신혼집’ 칩을 숨김(2026-11-27).
 * ‘추천’ 6개(SAVING_CHIPS)는 표 그대로(연애 중 ‘결혼 비용’ 예외 포함). ‘추천’에 이미 있는 칩은 아래 묶음에서 빼고, 빈 묶음은 없앰
 */
export function savingChipGroups(
  m: MarriageStatus | null | undefined,
): { group: SavingChipGroup; chips: SavingChip[] }[] {
  const marriage = m === 'married' || m === 'engaged';
  const top = new Set(savingChips(m));
  return SAVING_CHIP_GROUPS.filter((g) => marriage || g.group !== 'marriage')
    .map((g) => ({
      group: g.group,
      chips: g.chips.filter((c) => !top.has(c) && (marriage || c !== 'newlywed_home')),
    }))
    .filter((g) => g.chips.length > 0);
}

/**
 * 저축·투자 그림 키 표(2026-11-26 사용자 결정, docs/spec/19 H-10 ‘그림 자리’, Illustrations.md ‘나중 과제’ 11번).
 * 이름 칩마다 하나 + 직접 정한 이름은 공통 키 하나. 키 = 파일 이름(`packages/ui/src/assets/illustrations/<키>.webp`).
 * 파일이 없으면 그 자리를 그리지 않음(`Illustration` null). 지금 쓰는 곳: 홈 H-10 같이 모으기 칸 왼쪽
 */
export const SAVING_ART: Record<SavingChip, string> = {
  wedding: 'saving-wedding',
  newlywed_home: 'saving-newlywed-home',
  honeymoon: 'saving-honeymoon',
  dowry: 'saving-dowry',
  emergency: 'saving-emergency',
  home: 'saving-home',
  travel: 'saving-travel',
  car: 'saving-car',
  childcare: 'saving-childcare',
  retire: 'saving-retire',
  moving: 'saving-moving',
  appliance: 'saving-appliance',
  anniv_gift: 'saving-anniv-gift',
  date: 'saving-date',
  lump: 'saving-lump',
  birth: 'saving-birth',
  furniture: 'saving-furniture',
  child_edu: 'saving-child-edu',
  self_dev: 'saving-self-dev',
  family_event: 'saving-family-event',
  holiday: 'saving-holiday',
  yearly: 'saving-yearly',
  housing_sub: 'saving-housing-sub',
  installment: 'saving-installment',
  invest: 'saving-invest',
  pension: 'saving-pension',
};
/** 직접 정한 이름(칩 이름과 다름) */
export const SAVING_ART_CUSTOM = 'saving-custom';
export const SAVING_ART_KEYS = [...Object.values(SAVING_ART), SAVING_ART_CUSTOM] as const;

/**
 * 저축·투자(또는 묶음) 이름 → 그림 키. 저금은 칩 코드를 저장하지 않아 이름이 칩 이름(앱 copy)과 같으면 그 칩,
 * 아니면 직접 정한 이름 공통 키. 칩 이름은 앱 copy가 정하므로 인자로 받음.
 * aliases = 예전 칩 이름 → 칩(2026-11-27 ‘출산·육아’ → childcare, ‘가전·가구’ → appliance: 이미 저장된 이름도 같은 그림)
 */
export function savingArtKey(
  name: string,
  chipNames: Record<SavingChip, string>,
  aliases: Readonly<Record<string, SavingChip>> = {},
): string {
  const n = name.trim();
  const chip =
    (Object.keys(chipNames) as SavingChip[]).find((c) => chipNames[c] === n) ?? aliases[n];
  return chip ? SAVING_ART[chip] : SAVING_ART_CUSTOM;
}

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
