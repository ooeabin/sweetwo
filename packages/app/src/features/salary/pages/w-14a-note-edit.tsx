import { addSavingNote, updateSavingNote } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import {
  DateWheelInput,
  FormAmount,
  FormScreen,
  FormSection,
  QuestionSkeleton,
  ShortText,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useNoteTarget } from './w-14-notes';
import { useSavingNotes } from '../together';

/**
 * W-14a 쓸 곳 메모 추가·고치기(20 v2.2): 2026-11-24 한 화면 입력(FormScreen) 이름(Q5, 20자) + 예상 금액(Q3, 선택) + 날짜(Q4, 선택 “날짜 없이 적을게요”).
 * 저장 = saving_note 넣기·고치기(고칠 수 있는 사람만, 열 권한). 고칠 때는 날짜 화면 아래 ‘메모 지우기’(Toast ‘되돌리기’)
 */
export function W14aNoteEdit({ kind }: { kind: 'goal' | 'bundle' }) {
  const { id = '', note = 'new' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const t = useNoteTarget(kind, id);
  const notes = useSavingNotes(kind === 'goal' ? { goalId: id } : { bundleId: id });
  const old = notes.data?.find((n) => n.id === note);
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
  const err = v.date !== null && v.date < todayKst() && !old ? copy.notBeforeToday : undefined;
  const remove = () =>
    old &&
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
      .catch(() => toast(copy.failed));
  return (
    <FormScreen
      title={old ? copy.noteTitleEdit : copy.noteTitleNew}
      onBack={() => nav(-1)}
      primary={{ label: copy.noteSave, disabled: !v.name.trim() || !!err, loading: busy }}
      onSubmit={() => void save({ amount: v.amount || null, date: v.date })}
    >
      <FormSection title={copy.noteNameQ}>
        <ShortText
          label={copy.noteNameQ}
          value={v.name}
          onChange={setName}
          max={20}
          placeholder={copy.noteNamePlaceholder}
          autoFocus={false}
        />
      </FormSection>
      <FormSection title={copy.noteAmountQ} aside={copy.noteOptional}>
        <FormAmount
          label={copy.noteAmountQ}
          sheetTitle={copy.noteAmountQ}
          value={v.amount}
          onChange={setAmount}
          monthly={false}
        />
      </FormSection>
      <FormSection
        title={copy.noteDateQ}
        aside={
          v.date ? (
            <button type="button" className="hg-btn hg-btn--link" onClick={() => setDate(null)}>
              {copy.noteNoDate}
            </button>
          ) : (
            copy.noteOptional
          )
        }
      >
        <DateWheelInput
          label={copy.noteDateQ}
          value={v.date}
          onChange={(x) => setDate(x)}
          error={err}
          today={todayKst()}
          minYear={Number(todayKst().slice(0, 4)) - 1}
        />
      </FormSection>
      {old && (
        <button
          type="button"
          className="hg-btn hg-btn--link hg-form__quick"
          onClick={remove}
        >
          {copy.noteDelete}
        </button>
      )}
    </FormScreen>
  );
}

const listPath = (kind: 'goal' | 'bundle', id: string) =>
  kind === 'goal' ? `/salary/items/${id}/notes` : `/salary/bundles/${id}/notes`;
