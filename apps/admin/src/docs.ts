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
  group: DocGroup;
}

// 목차 묶음(2026-11-06): 기획서(파일 번호 순) → 디자인 → 개발 가이드 → ADR
export type DocGroup = 'spec' | 'design' | 'dev' | 'adr';
export const DOC_GROUPS: DocGroup[] = ['spec', 'design', 'dev', 'adr'];
const groupOf = (path: string): DocGroup =>
  path.startsWith('spec/')
    ? 'spec'
    : path.startsWith('adr/')
      ? 'adr'
      : path.startsWith('design') || path === 'DESIGN.md'
        ? 'design'
        : 'dev';
// 디자인 안에서는 DESIGN.md → design/*.md → assets → components 순
const rank = (path: string) =>
  path === 'DESIGN.md' || path === 'spec/README.md'
    ? 0
    : path.startsWith('design/components/')
      ? 3
      : path.startsWith('design/assets/')
        ? 2
        : 1;

export const docs: DocEntry[] = Object.entries(files)
  .map(([key, body]) => ({
    path: key.replace('../../../docs/', ''),
    title: body.match(/^#\s+(.+)$/m)?.[1] ?? key,
    body,
    group: groupOf(key.replace('../../../docs/', '')),
  }))
  .sort(
    (a, b) =>
      DOC_GROUPS.indexOf(a.group) - DOC_GROUPS.indexOf(b.group) ||
      rank(a.path) - rank(b.path) ||
      a.path.localeCompare(b.path),
  );

export const DESIGN_PREVIEW_URL = 'https://claude.ai/artifact/5KKC9HnqXVWEja5sif5JjF';
