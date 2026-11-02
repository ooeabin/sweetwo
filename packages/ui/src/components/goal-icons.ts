import type { IconName } from './Icon';

// 목표 템플릿(core onboarding/goals.ts key) → 그림이 아직 없을 때 쓰는 Phosphor 아이콘(GoalPick).
// 3D 이모지가 생기면 그림이 대신함(docs/design/assets/Illustrations.md ‘다시 만들기 계획’).
const ICONS: Record<string, IconName> = {
  emergency: 'first-aid-kit',
  high_interest_loan: 'hand-coins',
  prepay_mortgage: 'bank',
  home: 'house',
  moving: 'truck',
  furniture: 'couch',
  wedding: 'diamond',
  baby: 'baby',
  education: 'graduation-cap',
  family_event: 'users-three',
  pet: 'paw-print',
  travel: 'airplane-tilt',
  anniversary: 'heart',
  big_purchase: 'shopping-bag',
  hobby: 'palette',
  car: 'car',
  car_upkeep: 'wrench',
  annual_fixed: 'calendar-check',
  retirement: 'plant',
  invest_seed: 'coins',
};

export const goalIcon = (template: string): IconName => ICONS[template] ?? 'flag-pennant';
