// ?inline: 파일 주소 대신 data: URL로 번들에 넣음(2026-11-10). 오프라인·첫 그리기에도 네트워크 없이 바로 보임
import logoCherry from '../assets/brand/logo-cherry.svg?inline';

// sweeTwo 워드마크(docs/design/assets/Brand.md). 흰 바탕, 다크 바탕 모두 logo-cherry.
// 56은 A-02 로그인 첫 화면 히어로 전용.
// ink: 어드민 전용(2026-11-06). 글자 모양 마스크(hg-wordmark)에 잉크 색, 밝은 화면 검정, 다크 화면 흰색.
export function Wordmark({ height = 32, ink }: { height?: 24 | 32 | 40 | 56; ink?: boolean }) {
  if (ink)
    return (
      <span
        className="hg-wordmark hg-wordmark--ink"
        role="img"
        aria-label="sweeTwo"
        style={{ height }}
      />
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
