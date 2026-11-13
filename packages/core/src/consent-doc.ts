// 동의 문서 마크다운(apps/site/src/content/consents/*.md) 읽기(A-05 ‘보기’ 시트, 2026-11-10).
// 맨 위 frontmatter(version, title) + ## 제목, 문단, - 목록만. 주석(<!-- -->)은 버림.
export type DocBlock =
  { kind: 'h2'; text: string } | { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };
export type ConsentDoc = { title: string; version: string; blocks: DocBlock[] };

export function parseConsentDoc(md: string): ConsentDoc {
  const body = md.replace(/<!--[\s\S]*?-->/g, '').trim();
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(body);
  const meta: Record<string, string> = {};
  for (const line of (fm?.[1] ?? '').split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (m?.[1]) meta[m[1]] = (m[2] ?? '').trim();
  }
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of body.slice(fm?.[0].length ?? 0).split('\n')) {
    const line = raw.trim();
    const h = /^##\s+(.+)$/.exec(line);
    const li = /^[-*]\s+(.+)$/.exec(line);
    if (h?.[1]) {
      flush();
      blocks.push({ kind: 'h2', text: h[1] });
    } else if (li?.[1]) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(li[1]);
      else blocks.push({ kind: 'ul', items: [li[1]] });
    } else if (line) para.push(line);
    else flush();
  }
  flush();
  return { title: meta.title ?? '', version: meta.version ?? '', blocks };
}
