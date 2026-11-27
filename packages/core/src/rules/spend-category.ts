import { z } from 'zod';

/**
 * 지출 묶음(대분류) code(2026-11-27 사용자 결정 ‘대분류 안 소분류’, docs/spec/20 ‘W-01e 지출 칩 표’).
 * 서버 split_line.category check 제약(20270105090000_split_line_category)과 같은 값·순서(W-01 지출 카드 묶음 순서).
 * 묶음 이름과 칩은 앱 copy(spendChipGroups)가 정함
 */
export const SPEND_CATEGORIES = [
  'living',
  'housing',
  'telecom',
  'subscription',
  'transport',
  'car',
  'insurance',
  'loan',
  'family',
  'relation',
] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];
export const spendCategorySchema = z.enum(SPEND_CATEGORIES);

/**
 * 지출 줄의 묶음. 생활비 기본 줄(kind living)은 늘 living(서버 트리거와 같음), 직접 추가 줄은 저장된 값(모르는 값이면 null),
 * 그 밖(고정지출, 용돈, 보내기, 같이 쓰는 통장, 저축·투자)은 묶음 없음
 */
export function spendCategoryOf(l: {
  kind: string;
  category?: string | null;
}): SpendCategory | null {
  if (l.kind === 'living') return 'living';
  if (l.kind !== 'custom') return null;
  const c = spendCategorySchema.safeParse(l.category);
  return c.success ? c.data : null;
}

/**
 * W-01 지출 카드 묶기(20 W-01 5i): 묶음 순서대로 [묶음, 줄들](줄이 있는 묶음만, 줄 순서는 그대로) + 묶음 없는 줄(맨 아래).
 * 금액 소계는 부르는 쪽이 줄 금액을 더함
 */
export function groupSpendLines<T extends { kind: string; category?: string | null }>(
  lines: readonly T[],
): { groups: { category: SpendCategory; lines: T[] }[]; rest: T[] } {
  const groups = SPEND_CATEGORIES.map((category) => ({
    category,
    lines: lines.filter((l) => spendCategoryOf(l) === category),
  })).filter((g) => g.lines.length > 0);
  return { groups, rest: lines.filter((l) => spendCategoryOf(l) === null) };
}
