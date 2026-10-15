import type { Won } from '../money';

// ‘잘 모르겠어요’ 구간 칩(docs/spec/09-data-items.md 5장). 저장값 = 구간 중간값(첫 구간 = 상한의 1/2, 끝 구간 = 하한) + ‘추정’.
export interface Band {
  label: string;
  value: Won;
}
const M = 10_000;
export const bands = {
  monthlyIncome: [
    { label: '200만 미만', value: 100 * M },
    { label: '200~300만', value: 250 * M },
    { label: '300~400만', value: 350 * M },
    { label: '400~500만', value: 450 * M },
    { label: '500만 이상', value: 500 * M },
  ],
  livingCost: [
    { label: '50만 미만', value: 25 * M },
    { label: '50~100만', value: 75 * M },
    { label: '100~150만', value: 125 * M },
    { label: '150~200만', value: 175 * M },
    { label: '200만 이상', value: 200 * M },
  ],
  weddingBudget: [
    { label: '2천만 미만', value: 1_000 * M },
    { label: '2~3천', value: 2_500 * M },
    { label: '3~5천', value: 4_000 * M },
    { label: '5천~1억', value: 7_500 * M },
    { label: '1억 이상', value: 10_000 * M },
  ],
  goalAmount: [
    { label: '1천만 미만', value: 500 * M },
    { label: '1~3천', value: 2_000 * M },
    { label: '3천~1억', value: 6_500 * M },
    { label: '1~3억', value: 20_000 * M },
    { label: '3억 이상', value: 30_000 * M },
  ],
  travelPerPerson: [
    { label: '50만 미만', value: 25 * M },
    { label: '50~100', value: 75 * M },
    { label: '100~200', value: 150 * M },
    { label: '200~300', value: 250 * M },
    { label: '300만 이상', value: 300 * M },
  ],
} as const satisfies Record<string, readonly Band[]>;
export type BandKind = keyof typeof bands;

/** 빠른 금액 칩(Q3). 큰 금액 4곳만 big. */
export const quickChips = {
  small: [
    { label: '+1만', value: 1 * M },
    { label: '+10만', value: 10 * M },
    { label: '+50만', value: 50 * M },
    { label: '+100만', value: 100 * M },
  ],
  big: [
    { label: '+1,000만', value: 1_000 * M },
    { label: '+5,000만', value: 5_000 * M },
    { label: '+1억', value: 10_000 * M },
  ],
} as const;
export type QuickKind = keyof typeof quickChips;
