import type { MonthUsCard } from '../schemas/v22';

/**
 * 이번 달 우리 둘 카드(19 H-14)의 저금 줄 고르기. 서버 month_us(20261216090000 계약 3)가 정한 값을 문장 종류로만 나눔.
 * hidden(했어요만 공개) → 개수만, 처음 카드(변화 없음) → 지금까지 합, 그 뒤 → 지난 카드보다 늘었나·줄었나·그대로
 */
export type MonthUsSaving =
  | { kind: 'none' }
  | { kind: 'hidden'; count: number }
  | { kind: 'first'; total: number }
  | { kind: 'up' | 'down'; amount: number }
  | { kind: 'same' };

export function monthUsSaving(card: NonNullable<MonthUsCard>): MonthUsSaving {
  if (card.saving_count === 0) return { kind: 'none' };
  if (card.hidden || card.saved_total === null) return { kind: 'hidden', count: card.saving_count };
  if (card.saved_delta === null) return { kind: 'first', total: card.saved_total };
  if (card.saved_delta > 0) return { kind: 'up', amount: card.saved_delta };
  if (card.saved_delta < 0) return { kind: 'down', amount: -card.saved_delta };
  return { kind: 'same' };
}
