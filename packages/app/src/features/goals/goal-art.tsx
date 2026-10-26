import { Icon, Illustration } from '@sweetwo/ui';

// 목표 그림(Card hg-card__art): 기본 목표는 템플릿 그림, 직접 만든 목표는 회색 기본 그림(깃발). 장식이라 alt 없음
export function GoalArt({ g }: { g: { illustration: string | null; custom: boolean } }) {
  return (
    <span
      className={g.custom ? 'hg-card__art hg-card__art--custom' : 'hg-card__art'}
      aria-hidden="true"
    >
      {g.illustration ? <Illustration name={g.illustration} /> : <Icon name="flag-pennant" />}
    </span>
  );
}
