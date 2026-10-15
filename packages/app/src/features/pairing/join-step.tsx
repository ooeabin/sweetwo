import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useJoinData, type JoinData } from './data';

export const joinPath = (id: string) => `/join/${id}`;

/** 합류 화면 순서(18 흐름 요약). 각자 관리 예비부부는 용돈(P-07), 분담(P-08) 없음 */
export function joinScreens(d: Pick<JoinData, 'space'>): string[] {
  const separate =
    d.space?.marriage_status === 'engaged' && d.space?.prep_money_mode === 'separate';
  return ['p-03', 'p-04', 'p-05', 'p-05d', ...(separate ? [] : ['p-07', 'p-08']), 'p-11'];
}

/** 4칸 진행 막대: P-03·04 / P-05 / P-06·07 / P-08~10. P-11은 모두 채움 */
const PART: Record<string, number> = {
  'p-03': 0,
  'p-04': 0,
  'p-05': 1,
  'p-05d': 1,
  'p-07': 2,
  'p-08': 3,
};
export const joinProgress = (id: string) =>
  id === 'p-11' ? { total: 4, now: 4 } : { total: 4, now: PART[id] ?? 0, fill: 50 };

/** 합류 화면 하나: 멈춘 화면 기록, 저장 뒤 다음, 뒤로 */
export function useJoinStep(id: string) {
  const nav = useNavigate();
  const d = useJoinData();
  const [saving, setSaving] = useState(false);
  const list = joinScreens(d);
  const i = list.indexOf(id);

  const marked = useRef(false);
  useEffect(() => {
    if (!d.ready || !d.me || marked.current || id === 'p-11') return;
    marked.current = true;
    if (d.me.onboarding_step !== id.toUpperCase())
      void saveMe({ onboarding_step: id.toUpperCase() }).catch(() => undefined);
  }, [d.ready, d.me, id]);

  const done = async (save?: () => Promise<unknown>, next?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await save?.();
      await d.refetch();
      setSaving(false);
      nav(joinPath(next ?? list[i + 1] ?? 'p-11'));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  return {
    d,
    saving,
    steps: joinProgress(id),
    done,
    onBack: i > 0 && id !== 'p-11' ? () => nav(joinPath(list[i - 1] ?? 'p-03')) : undefined,
  };
}
