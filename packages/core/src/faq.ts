// 자주 묻는 질문 마크다운(apps/site/src/content/faq.md) 읽기: ## 묶음, ### {번호}. 질문, 그다음 줄들이 답.
export type FaqItem = { n: number; q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export function parseFaq(md: string): FaqGroup[] {
  const groups: FaqGroup[] = [];
  let item: FaqItem | null = null;
  const body = md.replace(/<!--[\s\S]*?-->/g, '');
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const g = /^## (.+)$/.exec(line);
    const q = /^### (\d+)\. (.+)$/.exec(line);
    if (g?.[1]) {
      groups.push({ title: g[1], items: [] });
      item = null;
    } else if (q?.[1] && q[2]) {
      item = { n: Number(q[1]), q: q[2], a: '' };
      groups[groups.length - 1]?.items.push(item);
    } else if (item && line) {
      item.a = item.a ? `${item.a} ${line}` : line;
    }
  }
  return groups;
}

/** 검색: 질문·답에 모든 낱말이 들어 있는 것(띄어쓰기로 나눔, 대소문자 무시) */
export function searchFaq(groups: FaqGroup[], query: string): FaqItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return groups
    .flatMap((g) => g.items)
    .filter((i) => words.every((w) => `${i.q} ${i.a}`.toLowerCase().includes(w)));
}
