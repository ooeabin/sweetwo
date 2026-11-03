import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { useAddDraft, type AddDraft } from './draft';
import { saveFill } from './fill';
import { addPath, addSteps } from './flow';

/** 목표 추가 화면 하나: 진행 막대(고른 템플릿의 화면 수), 뒤로, 다음 */
export function useAddStep(step: string) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const data = useGoalsData();
  const { draft, set, clear } = useAddDraft();
  const fill = draft.fillGoalId;
  // 누구 목표(G-03e)는 혼자 쓰기가 아니면 늘 물음(미합류여도)
  const askOwner = data.space?.couple_state !== 'solo';
  const list = addSteps(draft, askOwner);
  const i = Math.max(list.indexOf(step), 0);
  const go = (to: string) => nav(to === 'g-03a' ? addPath() : addPath(to));
  return {
    data,
    draft,
    set,
    steps: { total: list.length, now: i, fill: 50 },
    onBack: () => (i > 0 ? go(list[i - 1] ?? 'g-03a') : nav(fill ? `/goals/${fill}` : '/goals')),
    /** 저장하고 다음(바뀐 답으로 순서를 다시 셈) */
    next: (patch?: Partial<AddDraft>) => {
      const d = patch ? { ...draft, ...patch } : draft;
      if (patch) set(patch);
      const l = addSteps(d, askOwner);
      const to = l[l.indexOf(step) + 1];
      // 금액 정하기: 마지막 질문 다음에 바로 저장하고 목표 상세로
      if (d.fillGoalId && !to) {
        const id = d.fillGoalId;
        void saveFill(d, qc)
          .then(() => {
            // 금액을 정했으면 매달 넣는 돈(G-03g)까지 묻고 상세로(2026-11-03)
            nav(`/goals/${id}/monthly`, { replace: true });
            // 화면을 떠난 뒤에 비움(먼저 비우면 질문 화면이 목표 추가 첫 화면으로 돌아감)
            setTimeout(clear, 0);
          })
          .catch(() => toast(copy.saveFailed));
        return;
      }
      go(to ?? 'confirm');
    },
  };
}
