import { goalPreset } from '@sweetwo/core';
import { Icon, Illustration, goalIcon, goalPhotoArt, hasIllustration } from '@sweetwo/ui';
import { usePhotoUrls } from '../../shared/photo';

// 목표 그림(22 G-01 10번, G-02 1번). 2026-11-03 모든 목표가 사진: 올린 사진 → 지정 사진(고른 것, 없으면 그 종류 1번) →
// 그림 파일이 아직 없으면 템플릿 그림 → 회색 기본 자리 + 아이콘. 장식이라 alt 없음
export function GoalArt({
  g,
  hero = false,
  tile = false,
}: {
  /** G-02 머리 사진(꽉 찬 히어로, 2026-11-03 시안 B3) */
  hero?: boolean;
  /** G-01 타일 위 사진(2026-11-03 시안 B) */
  tile?: boolean;
  g: {
    illustration: string | null;
    custom: boolean;
    goal?: { photo_path?: string | null; photo_preset?: string | null; template?: string };
  };
}) {
  const path = g.goal?.photo_path ?? null;
  const url = usePhotoUrls([path])[path ?? ''];
  const preset = g.goal?.template
    ? goalPhotoArt(goalPreset({ template: g.goal.template, photo_preset: g.goal.photo_preset }))
    : undefined;
  const src = url ?? preset;
  if (hero || tile)
    return (
      <span
        className={(tile ? 'hg-goaltile__photo' : 'hg-goalhero__photo') + (src ? '' : ' is-empty')}
        aria-hidden="true"
      >
        {src ? (
          <img src={src} alt="" />
        ) : (
          <Icon name={g.custom ? 'flag-pennant' : goalIcon(g.goal?.template ?? '')} />
        )}
      </span>
    );
  if (src)
    return (
      <span className="hg-card__art hg-card__art--photo" aria-hidden="true">
        <img src={src} alt="" />
      </span>
    );
  // 사진 파일이 없으면(힉스필드로 만들기 전) 템플릿 그림, 그것도 없으면 회색 기본 자리
  const art = !g.custom && hasIllustration(g.illustration) ? g.illustration : null;
  return (
    <span className={art ? 'hg-card__art' : 'hg-card__art hg-card__art--custom'} aria-hidden="true">
      {/* 그림이 아직 없으면 템플릿 아이콘(목표 고르기 O-21과 같음, 2026-11-03). 직접 만든 목표는 깃발 */}
      {art ? (
        <Illustration name={art} />
      ) : (
        <Icon name={g.custom ? 'flag-pennant' : goalIcon(g.goal?.template ?? '')} />
      )}
    </span>
  );
}
