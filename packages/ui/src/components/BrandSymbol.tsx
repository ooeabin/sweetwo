import symbol from '../assets/brand/symbol.png';

// sweeTwo 3D 심볼(파이 차트, docs/design/assets/Brand.md). 바탕 없음 512px를 줄여 씀.
// 96은 O-01 시작, A-02 로그인 첫 화면 히어로.
export function BrandSymbol({ size = 96 }: { size?: 48 | 96 }) {
  return (
    <img
      src={symbol}
      alt="sweeTwo"
      width={size}
      height={size}
      className="hg-symbol"
      style={{ display: 'block' }}
    />
  );
}
