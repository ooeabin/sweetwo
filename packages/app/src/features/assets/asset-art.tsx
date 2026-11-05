import { assetIcon, assetIcon3d, Icon } from '@sweetwo/ui';

/** 자산·부채 묶음 그림(F-01 빈 상태 항목별 등록, F-03a 묶음 타일): 3D 아이콘(2026-11-05), 파일이 없으면 Phosphor */
export function AssetArt({ group }: { group: string }) {
  const src = assetIcon3d(group);
  return src ? (
    <img className="hg-pick__art" src={src} alt="" aria-hidden="true" />
  ) : (
    <Icon name={assetIcon(group)} />
  );
}
