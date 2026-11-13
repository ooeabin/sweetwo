import { Lead, leadOf } from '@sweetwo/ui';

/** 자산·부채 묶음 아이콘(F-01 빈 상태 항목별 등록, F-03a 묶음 타일). 2026-11-09 영역 색 원 + Phosphor(ui lead-kinds.ts ‘asset’ 표) */
export function AssetArt({ group }: { group: string }) {
  return <Lead {...leadOf('asset', group)} />;
}
