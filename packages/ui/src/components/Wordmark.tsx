import logoBlack from '../assets/brand/logo-black.svg';
import logoCherry from '../assets/brand/logo-cherry.svg';
import logoWhite from '../assets/brand/logo-white.svg';

// sweeTwo 워드마크(docs/design/assets/Brand.md). 흰 바탕, 다크 바탕 모두 logo-cherry.
// tone="mono"는 어드민 전용(2026-11-06): 밝은 화면 검정(logo-black), 다크 화면 흰색(logo-white).
// 56은 A-02 로그인 첫 화면 히어로 전용.
export function Wordmark({
  height = 32,
  tone = 'brand',
}: {
  height?: 20 | 24 | 32 | 40 | 56;
  tone?: 'brand' | 'mono';
}) {
  if (tone === 'mono')
    return (
      <span className="hg-wordmark--mono" style={{ display: 'inline-flex' }}>
        <img
          className="hg-wordmark__light"
          src={logoBlack}
          alt="sweeTwo"
          height={height}
          style={{ width: 'auto' }}
        />
        <img
          className="hg-wordmark__dark"
          src={logoWhite}
          alt=""
          aria-hidden="true"
          height={height}
          style={{ width: 'auto' }}
        />
      </span>
    );
  return (
    <img
      src={logoCherry}
      alt="sweeTwo"
      height={height}
      style={{ display: 'block', width: 'auto' }}
    />
  );
}
