// AD-20 문서: 저장소 docs/의 md를 빌드에 포함한다(읽기 전용).
const files = import.meta.glob('../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface DocEntry {
  path: string;
  title: string;
  body: string;
}

export const docs: DocEntry[] = Object.entries(files)
  .map(([key, body]) => ({
    path: key.replace('../../../docs/', ''),
    title: body.match(/^#\s+(.+)$/m)?.[1] ?? key,
    body,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

export const DESIGN_PREVIEW_URL = 'https://claude.ai/artifact/5KKC9HnqXVWEja5sif5JjF';
