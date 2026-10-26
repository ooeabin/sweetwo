import { qk, trashGoals, updateGoal, type Goal } from '@sweetwo/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import type { GoalsData } from './data';

export type GoalChange =
  | { item: 'goal_amount'; value: number }
  | { item: 'goal_deadline'; value: string }
  | { item: 'goal_name'; value: string }
  | { item: 'goal_pause'; value: boolean }
  | { item: 'goal_delete' };

// 목표 바꾸기(22 목표 수정, G-02 ⋯). 재기획(ADR 0003): 제안 없이 늘 바로 적용 + Toast ‘되돌리기’. 상대 알림·활동 기록은 서버 `partner_change`(우리 목표만)
export function useGoalChange(d: GoalsData) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.goalRecords, qk.splits, qk.goalSaved].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );

  const direct = async (g: Goal, c: GoalChange) => {
    if (c.item === 'goal_amount') {
      await updateGoal(g.id, { target_amount: c.value, amount_estimated: false });
      return {
        text: copy.amountChanged,
        undo: () =>
          updateGoal(g.id, {
            target_amount: g.target_amount,
            amount_estimated: g.amount_estimated,
          }),
      };
    }
    if (c.item === 'goal_deadline') {
      await updateGoal(g.id, { deadline: c.value, deadline_estimated: false });
      return {
        text: copy.deadlineChanged,
        undo: () =>
          updateGoal(g.id, { deadline: g.deadline, deadline_estimated: g.deadline_estimated }),
      };
    }
    if (c.item === 'goal_name') {
      await updateGoal(g.id, { name: c.value });
      return { text: copy.nameChanged, undo: () => updateGoal(g.id, { name: g.name }) };
    }
    if (c.item === 'goal_pause' && c.value) {
      await updateGoal(g.id, { status: 'paused' });
      return { text: copy.paused, undo: () => updateGoal(g.id, { status: g.status }) };
    }
    if (c.item === 'goal_pause') {
      // 다시 모으면 우선순위 맨 아래
      const last = Math.max(0, ...d.goals.map((x) => x.priority)) + 1;
      await updateGoal(g.id, { status: 'active', priority: last });
      return {
        text: copy.resumed,
        undo: () => updateGoal(g.id, { status: g.status, priority: g.priority }),
      };
    }
    await trashGoals([g.id]);
    return { text: copy.removed, undo: () => updateGoal(g.id, { deleted_at: null }) };
  };

  /** 보내면 true. 실패는 Toast */
  const send = async (g: Goal, c: GoalChange): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await direct(g, c);
      toast(
        r.text,
        r.undo
          ? {
              label: copy.undo,
              onClick: () => void r.undo().then(refresh),
            }
          : undefined,
      );
      await refresh();
      return true;
    } catch {
      toast(copy.loadFailed);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, send };
}
