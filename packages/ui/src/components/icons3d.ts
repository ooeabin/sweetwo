// 작은 3D 아이콘(2026-11-05, docs/design/assets/Illustrations.md D 묶음). assets/icons3d/{이름}.webp, 160px, 바탕 투명.
// 줄 앞 32~40px(Lead art3d). 파일이 없으면 undefined → 소비자가 Phosphor 아이콘으로.
const files = import.meta.glob('../assets/icons3d/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const icons: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    (path.split('/').pop() ?? '').replace('.webp', ''),
    url,
  ]),
);

/** 3D 아이콘 주소(없으면 undefined) */
export const icon3d = (name: string | null | undefined): string | undefined =>
  name ? icons[name] : undefined;

/** 자산·부채 묶음(core asset.ts 그룹 key) → 3D 아이콘 이름 */
const ASSET: Record<string, string> = {
  cash: 'line-custom',
  deposit: 'asset-deposit',
  subscription: 'asset-real-estate',
  invest: 'asset-invest',
  pension: 'asset-pension',
  insurance: 'asset-insurance',
  real_estate: 'asset-real-estate',
  etc: 'asset-car',
  housing_loan: 'asset-real-estate',
  credit: 'asset-credit',
  installment: 'asset-installment',
  student: 'asset-student',
  other_loan: 'asset-other-loan',
  personal: 'asset-personal',
};
export const assetIcon3d = (group: string): string | undefined => icon3d(ASSET[group]);
