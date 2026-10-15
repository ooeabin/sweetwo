import logoCherry from '../assets/brand/logo-cherry.svg';

// sweeTwo 워드마크(docs/design/assets/Brand.md). 흰 바탕, 다크 바탕 모두 logo-cherry.
export function Wordmark({ height = 32 }: { height?: 24 | 32 | 40 }) {
  return (
    <img
      src={logoCherry}
      alt="sweeTwo"
      height={height}
      style={{ display: 'block', width: 'auto' }}
    />
  );
}
