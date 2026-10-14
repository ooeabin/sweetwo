// 그림(Illustrations, 512px webp, 무광 3D). 다시 그리거나 색을 바꾸지 않는다(docs/design/assets/Illustrations.md)
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
