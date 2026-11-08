import { assetIcon3d } from '@sweetwo/ui';

/** 자산·부채 묶음 그림(F-01 빈 상태 항목별 등록, F-03a 묶음 타일). 2026-11-08 다시 만들 때까지 빈 자리 */
export function AssetArt({ group }: { group: string }) {
  const src = assetIcon3d(group);
  return src ? (
    <img className="hg-pick__art" src={src} alt="" aria-hidden="true" />
  ) : (
    <span className="hg-pick__art hg-artslot" aria-hidden="true" />
  );
}
