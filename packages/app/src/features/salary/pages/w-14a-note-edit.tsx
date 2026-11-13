import { addSavingNote, updateSavingNote } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { AmountInput, DateInput, QuestionLayout, QuestionSkeleton, ShortText } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useNoteTarget } from './w-14-notes';
import { useSavingNotes } from '../together';

type Step = 'name' | 'amount' | 'date';
const STEPS: Step[] = ['name', 'amount', 'date'];

/**
 * W-14a 쓸 곳 메모 추가·고치기(20 v2.2): 이름(Q5, 20자) → 예상 금액(Q3, 선택 “금액 없이 적을게요”) → 날짜(Q4, 선택 “날짜 없이 적을게요”).
 * 저장 = saving_note 넣기·고치기(고칠 수 있는 사람만, 열 권한). 고칠 때는 날짜 화면 아래 ‘메모 지우기’(Toast ‘되돌리기’)
 */
export function W14aNoteEdit({ kind }: { kind: 'goal' | 'bundle' }) {
  const { id = '', note = 'new' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const t = useNoteTarget(kind, id);
  const notes = useSavingNotes(kind === 'goal' ? { goalId: id } : { bundleId: id });
  const old = notes.data?.find((n) => n.id === note);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [date, setDate] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  if (!t.ready || notes.isLoading) return <QuestionSkeleton title={copy.noteNameQ} />;
  if (!t.found || !t.canEdit || (note !== 'new' && (!old || old.paid)))
    return <Navigate to={t.ready && t.found ? listPath(kind, id) : '/salary'} replace />;
  const v = {
    name: name ?? old?.name ?? '',
    amount: amount === undefined ? (old?.amount ?? null) : amount,
    date: date === undefined ? (old?.due_on ?? null) : date,
  };
  const now = STEPS.indexOf(step);
  const steps = { total: STEPS.length, now };
  const back = () => (now > 0 ? setStep(STEPS[now - 1] ?? 'name') : nav(-1));
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['saving_note'] });
    nav(listPath(kind, id), { replace: true });
  };
  const save = async (o: { amount: number | null; date: string | null }) => {
    if (busy || !t.d.ready) return;
    setBusy(true);
    try {
      if (old)
        await updateSavingNote(old.id, { name: v.name.trim(), amount: o.amount, dueOn: o.date });
      else
        await addSavingNote({
          spaceId: t.d.space.id,
          goalId: t.goalId,
          bundleId: t.bundleId,
          name: v.name.trim(),
          amount: o.amount,
          dueOn: o.date,
        });
      track('saving_note_saved', { has_due: !!o.date, subtracted: false });
      carryToast(copy.noteSaved);
      done();
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  if (step === 'name')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.noteNameQ}
        onBack={back}
        primary={{ label: copy.next, disabled: !v.name.trim() }}
        onSubmit={() => setStep('amount')}
      >
        <ShortText
          label={copy.noteNameQ}
          value={v.name}
          onChange={setName}
          max={20}
          placeholder={copy.noteNamePlaceholder}
        />
      </QuestionLayout>
    );
  if (step === 'amount')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.noteAmountQ}
        onBack={back}
        primary={{ label: copy.next, disabled: !v.amount }}
        onSubmit={() => setStep('date')}
        later={{
          label: copy.noteNoAmount,
          onClick: () => {
            setAmount(null);
            setStep('date');
          },
        }}
      >
        <AmountInput label={copy.noteAmountQ} value={v.amount} onChange={setAmount} />
      </QuestionLayout>
    );
  const err = v.date !== null && v.date < todayKst() && !old ? copy.notBeforeToday : undefined;
  return (
    <QuestionLayout
      steps={steps}
      title={copy.noteDateQ}
      onBack={back}
      primary={{ label: copy.noteSave, disabled: !v.date || !!err, loading: busy }}
      onSubmit={() => void save({ amount: v.amount, date: v.date })}
      later={{
        label: copy.noteNoDate,
        loading: busy,
        onClick: () => void save({ amount: v.amount, date: null }),
      }}
      secondary={
        old
          ? {
              label: copy.noteDelete,
              onClick: () =>
                void updateSavingNote(old.id, { deleted: true })
                  .then(() => {
                    carryToast(copy.noteDeleted, {
                      label: copy.undo,
                      onClick: () =>
                        quietly(
                          updateSavingNote(old.id, { deleted: false }).then(() =>
                            qc.invalidateQueries({ queryKey: ['saving_note'] }),
                          ),
                        ),
                    });
                    done();
                  })
                  .catch(() => toast(copy.failed)),
            }
          : undefined
      }
    >
      <DateInput label={copy.noteDateQ} value={v.date} onChange={(x) => setDate(x)} error={err} />
    </QuestionLayout>
  );
}

const listPath = (kind: 'goal' | 'bundle', id: string) =>
  kind === 'goal' ? `/salary/items/${id}/notes` : `/salary/bundles/${id}/notes`;
