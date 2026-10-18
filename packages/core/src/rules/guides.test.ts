import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { parseChecklist, parseGuides, pickGuides, weddingStage } from './guides';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../app/src/content/${name}`, import.meta.url)), 'utf8');

it('체크리스트 원본: 단계 3개, 항목마다 제목과 설명, 출처는 주소와 확인일', () => {
  const s = parseChecklist(read('checklist.md'));
  expect(s.map((x) => x.key)).toEqual(['engaged', 'first-year', 'years-2-3']);
  for (const st of s)
    for (const i of st.items) {
      expect(i.title).not.toBe('');
      expect(i.desc).not.toBe('');
      for (const src of i.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  const ins = s[1]?.items.find((i) => i.key === 'insurance');
  expect(ins?.steps).toHaveLength(2);
  expect(ins?.sources[0]?.name).toBe('내보험찾아줌');
});

it('가이드 원본: 주제 6개 + 상황 글, 문단과 적용', () => {
  const g = parseGuides(read('guides.md'));
  expect(g.map((x) => x.key)).toContain('money-merge');
  const e = g.find((x) => x.key === 'emergency');
  expect(e?.paragraphs).toHaveLength(3);
  expect(e?.apply).toEqual({ label: '비상금 목표 보기', path: '/goals' });
});

it('단계: 예비부부, 신혼 첫해, 2~3년차, 그 뒤', () => {
  expect(
    weddingStage('2026-10-18', { marriage_status: 'engaged', wedding_date: '2027-01-09' }),
  ).toBe('engaged');
  expect(
    weddingStage('2026-10-18', { marriage_status: 'married', wedding_date: '2026-05-17' }),
  ).toBe('first-year');
  expect(
    weddingStage('2026-10-18', { marriage_status: 'married', wedding_date: '2024-05-17' }),
  ).toBe('years-2-3');
  expect(
    weddingStage('2026-10-18', { marriage_status: 'married', wedding_date: '2020-05-17' }),
  ).toBeNull();
});

it('맞춤 글 3개: 전세 + 내 집 마련 → 전세 만기, 내 집 마련, 그다음 비상금', () => {
  expect(pickGuides({ housing: 'jeonse', childPlan: 'none', templates: ['home'] })).toEqual([
    'lease-end',
    'home',
    'emergency',
  ]);
  expect(pickGuides({ housing: 'own', childPlan: 'within_1y', templates: [] })).toEqual([
    'baby',
    'emergency',
    'money-merge',
  ]);
});
