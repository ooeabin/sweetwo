import { useNavigate } from 'react-router-dom';
import { useGoalsData } from '../data';
import { useAddDraft, type AddDraft } from './draft';
import { addPath, addSteps } from './flow';

/** 목표 추가 화면 하나: 진행 막대(고른 템플릿의 화면 수), 뒤로, 다음 */
export function useAddStep(step: string) {
  const nav = useNavigate();
  const data = useGoalsData();
  const { draft, set } = useAddDraft();
  const list = addSteps(draft, data.connected);
  const i = Math.max(list.indexOf(step), 0);
  const go = (to: string) => nav(to === 'g-03a' ? addPath() : addPath(to));
  return {
    data,
    draft,
    set,
    steps: { total: list.length, now: i, fill: 50 },
    onBack: () => (i > 0 ? go(list[i - 1] ?? 'g-03a') : nav('/goals')),
    /** 저장하고 다음(바뀐 답으로 순서를 다시 셈) */
    next: (patch?: Partial<AddDraft>) => {
      const d = patch ? { ...draft, ...patch } : draft;
      if (patch) set(patch);
      const l = addSteps(d, data.connected);
      go(l[l.indexOf(step) + 1] ?? 'confirm');
    },
  };
}
