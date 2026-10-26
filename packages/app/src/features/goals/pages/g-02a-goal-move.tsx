import { moveGoal, qk, undoGoalMove, updateGoal } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoalsModel } from '../model';

type Kind = 'in' | 'out' | 'use' | 'held';

// G-02a 넣기·빼기(Q1 → Q3), G-02b 꺼내 쓰기(Q3), ‘이미 모은 돈 넣기’(G-02 3a, Q3 → goal.other_held).
// 빼기·꺼내 쓰기는 모은 돈보다 많으면 저장 꺼짐. 저장 = 바로 반영 + Toast + 되돌리기.
// ?amount= 로 금액을 채워 열 수 있음(캘린더 Y-08 ‘목표 고르기’).
export function G02aGoalMove({ spend = false }: { spend?: boolean }) {
  const { id = '', kind } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const [pick, setPick] = useState<Kind | null>(
    spend ? 'use' : ((kind as Kind | undefined) ?? null),
  );
  const [params] = useSearchParams();
  const [amount, setAmount] = useState<number | null>(() => {
    const v = Number(params.get('amount') ?? '');
    return Number.isInteger(v) && v > 0 ? v : null;
  });
  const [busy, setBusy] = useState(false);
  if (!d.ready) return null;
  const i = d.byId(id);
  if (!i || !i.canEdit) return null;
  const g = i.goal;
  const back = () => nav(`/goals/${id}`);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.goalSaved }),
      qc.invalidateQueries({ queryKey: qk.goalMoves(id) }),
      qc.invalidateQueries({ queryKey: qk.goals }),
    ]);

  if (!pick) {
    return (
      <QuestionLayout title={copy.moveTitle} onBack={back}>
        <ChoiceCards<'in' | 'out'>
          label={copy.moveTitle}
          value={null}
          onChange={() => undefined}
          onPick={(v) => setPick(v)}
          options={[
            { value: 'in', label: copy.moveIn },
            { value: 'out', label: copy.moveOut, disabled: i.saved <= 0 },
          ]}
        />
      </QuestionLayout>
    );
  }
  const title =
    pick === 'in'
      ? copy.moveInAmount
      : pick === 'out'
        ? copy.moveOutAmount
        : pick === 'use'
          ? copy.useTitle(g.name)
          : copy.heldAsk;
  const over = (pick === 'out' || pick === 'use') && amount !== null && amount > i.saved;
  const save = async () => {
    if (!amount || over || busy) return;
    setBusy(true);
    try {
      if (pick === 'held') {
        const before = g.other_held;
        await updateGoal(g.id, { other_held: before + amount });
        await refresh();
        toast(copy.movedIn(g.name, readWon(amount)), {
          label: copy.undo,
          onClick: () => void updateGoal(g.id, { other_held: before }).then(refresh),
        });
      } else {
        const r = await moveGoal(g.id, pick, amount);
        if (r === 'too_much') {
          toast(copy.tooMuch);
          return;
        }
        await refresh();
        const text =
          pick === 'in'
            ? copy.movedIn(g.name, readWon(amount))
            : pick === 'out'
              ? copy.movedOut(g.name, readWon(amount))
              : copy.used(g.name, readWon(amount));
        toast(text, { label: copy.undo, onClick: () => void undoGoalMove(r.id).then(refresh) });
      }
      back();
    } catch {
      toast(copy.loadFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={title}
      help={
        pick === 'use' || pick === 'out'
          ? over
            ? copy.tooMuch
            : copy.useHelp(readWon(i.saved))
          : undefined
      }
      onBack={spend || kind ? back : () => setPick(null)}
      primary={{ label: copy.save, disabled: !amount || over, loading: busy }}
      onSubmit={() => void save()}
    >
      <AmountInput label={title} value={amount} onChange={setAmount} />
    </QuestionLayout>
  );
}

export const G02bGoalUse = () => <G02aGoalMove spend />;
