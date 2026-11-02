import { Icon, Illustration, hasIllustration } from '@sweetwo/ui';
import { usePhotoUrls } from '../../shared/photo';

// 목표 그림(22 G-01 10번, G-02 1번): 기본 목표는 템플릿 그림, 직접 만든 목표는 올린 사진(없으면 회색 기본 그림 + 깃발). 장식이라 alt 없음
export function GoalArt({
  g,
}: {
  g: { illustration: string | null; custom: boolean; goal?: { photo_path?: string | null } };
}) {
  const path = g.custom ? (g.goal?.photo_path ?? null) : null;
  const url = usePhotoUrls([path])[path ?? ''];
  if (url)
    return (
      <span className="hg-card__art hg-card__art--photo" aria-hidden="true">
        <img src={url} alt="" />
      </span>
    );
  // 그림 파일이 없으면(다시 뽑는 중) 직접 만든 목표와 같은 회색 기본 자리
  const art = !g.custom && hasIllustration(g.illustration) ? g.illustration : null;
  return (
    <span className={art ? 'hg-card__art' : 'hg-card__art hg-card__art--custom'} aria-hidden="true">
      {art ? <Illustration name={art} /> : <Icon name="flag-pennant" />}
    </span>
  );
}
