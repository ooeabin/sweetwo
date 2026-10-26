import { moveGoal, qk, undoGoalMove, updateGoal } from '@sweetwo/api';
import { readWon, thisMonth } from '@sweetwo/core';
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
// 매년 목표를 쓰는 달에 꺼내 쓰기를 기록하면 한 번 “내년 여행도 300만 원으로 할까요?”(22 ‘매년 금액’): 그대로 / 바꿀래요(Q3).
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
  const [next, setNext] = useState<'ask' | 'amount' | null>(null);
  const [nextAmount, setNextAmount] = useState<number | null>(null);
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

  // 매년 금액: 그대로 / 바꿀래요
  if (next === 'ask' && g.target_amount !== null) {
    const title = copy.nextYearQ(g.name, readWon(g.target_amount));
    return (
      <QuestionLayout title={title} onBack={back}>
        <ChoiceCards<'keep' | 'change'>
          label={title}
          value={null}
          onChange={() => undefined}
          onPick={(v) => (v === 'keep' ? back() : setNext('amount'))}
          options={[
            { value: 'keep', label: copy.nextYearKeep },
            { value: 'change', label: copy.nextYearChange },
          ]}
        />
      </QuestionLayout>
    );
  }
  if (next === 'amount') {
    const before = g.target_amount;
    return (
      <QuestionLayout
        title={copy.nextYearAmount}
        onBack={() => setNext('ask')}
        primary={{ label: copy.save, disabled: !nextAmount, loading: busy }}
        onSubmit={() =>
          nextAmount &&
          void updateGoal(g.id, { target_amount: nextAmount })
            .then(refresh)
            .then(() => {
              toast(copy.nextYearDone, {
                label: copy.undo,
                onClick: () => void updateGoal(g.id, { target_amount: before }).then(refresh),
              });
              back();
            })
            .catch(() => toast(copy.loadFailed))
        }
      >
        <AmountInput
          label={copy.nextYearAmount}
          value={nextAmount ?? before}
          onChange={setNextAmount}
        />
      </QuestionLayout>
    );
  }

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
        // 매년 목표를 쓰는 달에 꺼내 쓰면 내년 금액을 한 번 물음
        const ym = thisMonth();
        const key = `sweetwo.yearly-asked.${g.id}.${ym.slice(0, 4)}`;
        let asked = false;
        try {
          asked = localStorage.getItem(key) === '1';
          localStorage.setItem(key, '1');
        } catch {
          /* 못 저장해도 물음 */
        }
        if (
          pick === 'use' &&
          g.kind === 'yearly' &&
          g.target_amount !== null &&
          g.deadline?.slice(5, 7) === ym.slice(5, 7) &&
          !asked
        ) {
          setNext('ask');
          return;
        }
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
