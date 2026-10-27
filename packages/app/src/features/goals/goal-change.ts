import { qk, trashGoals, updateGoal, updateIfUnchanged, type Goal } from '@sweetwo/api';
import { conflictDecision } from '@sweetwo/core';
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

/** 배우자가 1분 안에 같은 칸을 바꿈(30 동기화 2장): 고를 때까지 저장하지 않음 */
export interface GoalConflict {
  goal: Goal;
  change: GoalChange;
  /** 서버 지금 값(배우자 값) */
  current: Goal;
}
class ConflictFound extends Error {
  constructor(readonly current: Goal) {
    super('conflict');
  }
}

// 목표 바꾸기(22 목표 수정, G-02 ⋯). 재기획(ADR 0003): 제안 없이 늘 바로 적용 + Toast ‘되돌리기’. 상대 알림·활동 기록은 서버 `partner_change`(우리 목표만)
// 금액·기한·이름은 ‘화면을 열 때 값’(opened)이 서버에 그대로일 때만 바꿈. 아니면 conflictDecision:
// 이미 같은 값이면 끝, 배우자가 1분 안에 바꿨으면 “어느 쪽으로 할까요?”(conflict), 그 밖은 마지막 저장 우선으로 덮음.
// 저장 실패: “저장하지 못했어요” + ‘다시 시도’(화면 값은 서버 값으로 돌아감)
export function useGoalChange(d: GoalsData) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<GoalConflict | null>(null);
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.goalRecords, qk.splits, qk.goalSaved].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );

  /** 열 때 값(base)이 그대로면 바꿈. force면 묻지 않고 덮음(‘내 값’ 고름) */
  const guarded = async (g: Goal, patch: Partial<Goal>, base: Partial<Goal>, force: boolean) => {
    if (force) return updateGoal(g.id, patch);
    const r = await updateIfUnchanged('goal', g.id, patch, base);
    if (r.ok) return;
    const dec = conflictDecision(r.current, patch, d.me?.id ?? '');
    if (dec === 'same') return;
    if (dec === 'choose') throw new ConflictFound(r.current);
    await updateGoal(g.id, patch);
  };

  const direct = async (g: Goal, c: GoalChange, force = false) => {
    if (c.item === 'goal_amount') {
      await guarded(
        g,
        { target_amount: c.value, amount_estimated: false },
        { target_amount: g.target_amount },
        force,
      );
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
      await guarded(
        g,
        { deadline: c.value, deadline_estimated: false },
        { deadline: g.deadline },
        force,
      );
      return {
        text: copy.deadlineChanged,
        undo: () =>
          updateGoal(g.id, { deadline: g.deadline, deadline_estimated: g.deadline_estimated }),
      };
    }
    if (c.item === 'goal_name') {
      await guarded(g, { name: c.value }, { name: g.name }, force);
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

  /** 보내면 true. 충돌이면 false + conflict, 실패는 Toast(다시 시도). g = 화면을 열 때의 목표 */
  const send = async (g: Goal, c: GoalChange, force = false): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await direct(g, c, force);
      setConflict(null);
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
    } catch (e) {
      if (e instanceof ConflictFound) {
        setConflict({ goal: g, change: c, current: e.current });
        return false;
      }
      // 안내 먼저(오프라인이면 다시 읽기가 연결될 때까지 기다림)
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void send(g, c, force) });
      void refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** 충돌 고르기: 내 값이면 덮어 저장, 배우자 값이면 그대로 둠. 끝나면 true */
  const resolve = async (mine: boolean): Promise<boolean> => {
    if (!conflict) return true;
    if (mine) return send(conflict.goal, conflict.change, true);
    setConflict(null);
    await refresh();
    return true;
  };

  return { busy, send, conflict, resolve };
}
