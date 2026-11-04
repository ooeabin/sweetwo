import type { IconName } from './Icon';

// 자산·부채 묶음(core asset.ts 그룹 key) → Phosphor 아이콘(F-03a 묶음 타일, F-01 빈 상태 항목별 등록, 2026-11-04)
const ICONS: Record<string, IconName> = {
  cash: 'wallet',
  deposit: 'piggy-bank',
  subscription: 'house',
  invest: 'trending-up',
  pension: 'shield-check',
  insurance: 'coins',
  real_estate: 'couch',
  etc: 'car',
  housing_loan: 'house',
  credit: 'bank',
  installment: 'shopping-bag',
  student: 'graduation-cap',
  other_loan: 'hand-coins',
  personal: 'users-three',
};

export const assetIcon = (group: string): IconName => ICONS[group] ?? 'wallet';
