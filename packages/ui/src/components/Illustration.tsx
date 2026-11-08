// 그림(Illustrations, 512px webp). 2026-11-08 3D 그림을 모두 지우고 2D 플랫으로 다시 만들 때까지 빈 자리(docs/design/assets/Illustrations.md ‘나중 과제’).
// 파일이 없으면 같은 크기의 빈 자리(hg-artslot, 회색 판)를 그린다.
const files = import.meta.glob('../assets/illustrations/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const illustrations: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    (path.split('/').pop() ?? '').replace('.webp', ''),
    url,
  ]),
);

// 움직이는 그림(같은 이름, 한 번 재생하고 마지막 장면에서 멈추는 WebP, 2026-11-05). 마지막 장면 = 정지 그림
const motionFiles = import.meta.glob('../assets/motion/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
export const motionIllustrations: Record<string, string> = Object.fromEntries(
  Object.entries(motionFiles).map(([path, url]) => [
    (path.split('/').pop() ?? '').replace('.webp', ''),
    url,
  ]),
);

export type IllustrationName = keyof typeof illustrations;

/** 그 이름의 그림 파일이 있는지(없으면 소비자가 회색 기본 자리로) */
export const hasIllustration = (name: string | null | undefined): name is string =>
  !!name && name in illustrations;

export function Illustration({
  name,
  className,
  alt = '',
  motion = false,
}: {
  name: string;
  className?: string;
  alt?: string;
  /** 움직이는 그림이 있으면 그것(화면 주인공 자리 96px 이상만, DESIGN ‘움직이는 그림’). ‘동작 줄이기’면 정지 그림 */
  motion?: boolean;
}) {
  const src = illustrations[name];
  if (!src)
    return (
      <span className={className ? `${className} hg-artslot` : 'hg-artslot'} aria-hidden="true" />
    );
  const moving = motion ? motionIllustrations[name] : undefined;
  if (moving)
    return (
      <picture className="hg-motion-wrap">
        <source media="(prefers-reduced-motion: reduce)" srcSet={src} />
        <img
          className={className ? `${className} hg-motion` : 'hg-motion'}
          src={moving}
          alt={alt}
          style={{ objectFit: 'contain' }}
        />
      </picture>
    );
  return <img className={className} src={src} alt={alt} style={{ objectFit: 'contain' }} />;
}
