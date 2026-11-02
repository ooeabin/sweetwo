// 그림(Illustrations, 512px webp). 2026-11-02 새 3D 이모지로 다시 뽑기 전까지 파일을 비워 둠(docs/design/assets/Illustrations.md ‘다시 만들기 계획’).
// 파일이 없으면 아무것도 그리지 않고, 소비자는 hasIllustration으로 빈 자리 모양을 고른다.
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

export type IllustrationName = keyof typeof illustrations;

/** 그 이름의 그림 파일이 있는지(없으면 소비자가 회색 기본 자리로) */
export const hasIllustration = (name: string | null | undefined): name is string =>
  !!name && name in illustrations;

export function Illustration({
  name,
  className,
  alt = '',
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  const src = illustrations[name];
  if (!src) return null;
  return <img className={className} src={src} alt={alt} style={{ objectFit: 'contain' }} />;
}
