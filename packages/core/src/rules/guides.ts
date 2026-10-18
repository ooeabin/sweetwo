import { daysBetween } from '../date';

// 가이드(25 S-01~S-03, 24 단계별 체크리스트). 원본은 packages/app/src/content/checklist.md, guides.md.

export interface ChecklistItem {
  key: string;
  title: string;
  desc: string;
  steps: string[];
  sources: { name: string; url: string; checked: string }[];
  feature: { label: string; path: string } | null;
}
export interface ChecklistStage {
  key: string;
  name: string;
  items: ChecklistItem[];
}
export interface Guide {
  key: string;
  title: string;
  topic: string;
  paragraphs: string[];
  apply: { label: string; path: string } | null;
}

const split = (s: string) => s.split('|').map((x) => x.trim());
const noComments = (md: string) => md.replace(/<!--[\s\S]*?-->/g, '');

/** checklist.md → 단계 → 항목 */
export function parseChecklist(md: string): ChecklistStage[] {
  const stages: ChecklistStage[] = [];
  let item: ChecklistItem | null = null;
  for (const raw of noComments(md).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      const [key = '', name = ''] = split(line.slice(3));
      stages.push({ key, name, items: [] });
      item = null;
    } else if (line.startsWith('### ')) {
      const [key = '', title = ''] = split(line.slice(4));
      item = { key, title, desc: '', steps: [], sources: [], feature: null };
      stages[stages.length - 1]?.items.push(item);
    } else if (item) {
      if (line.startsWith('- ')) item.steps.push(line.slice(2));
      else if (line.startsWith('출처:')) {
        const [name = '', url = '', checked = ''] = split(line.slice(3));
        item.sources.push({ name, url, checked });
      } else if (line.startsWith('기능:')) {
        const [label = '', path = ''] = split(line.slice(3));
        item.feature = { label, path };
      } else item.desc = item.desc ? `${item.desc} ${line}` : line;
    }
  }
  return stages;
}

/** guides.md → 글. 빈 줄로 문단을 나눔 */
export function parseGuides(md: string): Guide[] {
  const out: Guide[] = [];
  let g: Guide | null = null;
  let para: string[] = [];
  const flush = () => {
    if (g && para.length) g.paragraphs.push(para.join(' '));
    para = [];
  };
  for (const raw of noComments(md).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      flush();
      const [key = '', title = '', topic = ''] = split(line.slice(3));
      g = { key, title, topic, paragraphs: [], apply: null };
      out.push(g);
    } else if (!line) flush();
    else if (g && line.startsWith('적용:')) {
      flush();
      const [label = '', path = ''] = split(line.slice(3));
      g.apply = { label, path };
    } else para.push(line);
  }
  flush();
  return out;
}

/** 결혼일 기준 단계(24 단계별 체크리스트): 예정일 전 = 예비부부, 1년 안 = 신혼 첫해, 3년 안 = 2~3년차, 그 뒤·모름 = null */
export function weddingStage(
  today: string,
  o: { marriage_status: string | null; wedding_date: string | null },
): 'engaged' | 'first-year' | 'years-2-3' | null {
  if (o.marriage_status === 'engaged') return 'engaged';
  if (!o.wedding_date) return null;
  const d = daysBetween(o.wedding_date, today);
  if (d < 0) return 'engaged';
  if (today < addYearsDay(o.wedding_date, 1)) return 'first-year';
  if (today < addYearsDay(o.wedding_date, 3)) return 'years-2-3';
  return null;
}
const addYearsDay = (d: string, n: number) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;

/**
 * 내 상황 맞춤 글 3개(S-01): 목표·거주 형태·자녀 계획 기준.
 * 전세 → 전세 만기 전 점검, 내 집 마련 목표 → 내 집 마련, 자녀 계획 3년 안 → 출산·육아, 그다음 비상금, 돈 합치기 순으로 채움.
 */
export function pickGuides(o: {
  housing: string | null;
  childPlan: string | null;
  templates: string[];
}): string[] {
  const keys: string[] = [];
  if (o.housing === 'jeonse') keys.push('lease-end');
  if (o.templates.includes('home')) keys.push('home');
  if (o.childPlan === 'within_1y' || o.childPlan === 'in_1_3y') keys.push('baby');
  for (const k of ['emergency', 'money-merge', 'family', 'retirement'])
    if (!keys.includes(k)) keys.push(k);
  return keys.slice(0, 3);
}
