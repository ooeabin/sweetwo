import { fetchChecklistDone, qk } from '@sweetwo/api';
import { parseChecklist, parseGuides, todayKst, weddingStage } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import checklistMd from '../../content/checklist.md?raw';
import guidesMd from '../../content/guides.md?raw';

// 가이드 원본(packages/app/src/content). 한 번만 읽음
export const CHECKLIST = parseChecklist(checklistMd);
export const GUIDES = parseGuides(guidesMd);
export const TOPIC_KEYS = ['money-merge', 'emergency', 'home', 'baby', 'retirement', 'family'];

export const guidesPath = '/settings/guides';
export const checkPath = (key: string, fromTodo = false) =>
  `/settings/guides/check/${key}${fromTodo ? '?from=todo' : ''}`;
export const readPath = (key: string) => `/settings/guides/read/${key}`;

/** 지금 단계 체크리스트 + 완료 */
export function useChecklist(
  space: { marriage_status: string | null; wedding_date: string | null } | null,
) {
  const done = useQuery({ queryKey: qk.checklistDone, queryFn: fetchChecklistDone });
  const stageKey = space ? weddingStage(todayKst(), space) : null;
  const stage = CHECKLIST.find((s) => s.key === stageKey) ?? null;
  const doneOf = (key: string) => (done.data ?? []).find((x) => x.key === key) ?? null;
  return {
    loading: done.isLoading,
    stage,
    doneOf,
    count: stage ? stage.items.filter((i) => doneOf(i.key)).length : 0,
    total: stage?.items.length ?? 0,
  };
}
