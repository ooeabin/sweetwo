import logoCherry from '../assets/brand/logo-cherry.svg';

// sweeTwo 워드마크(docs/design/assets/Brand.md). 흰 바탕, 다크 바탕 모두 logo-cherry.
// 56은 A-02 로그인 첫 화면 히어로 전용.
export function Wordmark({ height = 32 }: { height?: 24 | 32 | 40 | 56 }) {
  return (
    <img
      src={logoCherry}
      alt="sweeTwo"
      height={height}
      style={{ display: 'block', width: 'auto' }}
    />
  );
}
