import { qk, saveSplit, updateGoal } from '@sweetwo/api';
import { addMonths, thisMonth, ymToDate, type SplitLineDraft } from '@sweetwo/core';
import { Modal } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace, useSplits } from '../data';
import { emergencyGoalTarget, recommendedDraft } from '../split-draft';
import { SplitEditor, toDraft } from '../split-editor';

// W-01 월급 분배표(20). O-50과 같은 틀. 저장 = 바로 적용 + Toast “분배표를 바꿨어요” + 되돌리기.
// 이번 사이클 체크 안 한 줄도 새 금액으로(서버 sync_checklist). 배우자 탭·상대 알림은 부부 단계에서.
export function W01Split() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const splits = useSplits();
  const partner = usePartner();
  const [draft, setDraft] = useState<SplitLineDraft[] | null>(null);
  const [refill, setRefill] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!me.data || !space.data || !goals.data || !splits.data) return null;
  const m = me.data;
  const joint = space.data.salary_mode === 'joint';
  const owner = joint ? undefined : m.id;
  const mine = splits.data.find((x) => x.owner_user_id === (owner ?? null));
  const saved = mine ? toDraft(mine.split_line) : null;
  const lines = draft ?? saved ?? recommendedDraft(m, goals.data);
  const income = (m.monthly_income ?? 0) + (joint ? (partner.data?.monthly_income ?? 0) : 0);
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/'));

  const write = async (next: SplitLineDraft[]) => {
    await saveSplit(next, owner);
    const emergency = goals.data.find((g) => g.template === 'emergency');
    const target = emergencyGoalTarget(next);
    if (emergency && target !== emergency.target_amount) {
      await updateGoal(emergency.id, {
        target_amount: target,
        deadline: emergency.deadline ?? ymToDate(addMonths(thisMonth(), 12)),
      });
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.splits }),
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goals }),
    ]);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await write(lines);
      const before = saved;
      toast(
        copy.saved,
        before ? { label: copy.undo, onClick: () => void write(before) } : undefined,
      );
      back();
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void save() });
    } finally {
      setSaving(false);
    }
  };

  const name = (id: string | undefined) =>
    id === m.id ? (m.nickname ?? '') : (partner.data?.nickname ?? '');
  return (
    <>
      <SplitEditor
        lines={lines}
        onChange={setDraft}
        income={income}
        payday={m.payday_last ? 'last' : m.payday}
        goals={goals.data}
        personName={name}
        joint={joint}
        title={copy.splitTitle}
        help={copy.splitHelp}
        primaryLabel={copy.save}
        primaryDisabled={!draft}
        saving={saving}
        onBack={back}
        onSave={() => void save()}
        extra={
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setRefill(true)}
          >
            {copy.refill}
          </button>
        }
      />
      {refill && (
        <Modal
          title={copy.refillTitle}
          body={copy.refillBody}
          confirmLabel={copy.refillOk}
          cancelLabel={copy.cancel}
          onCancel={() => setRefill(false)}
          onConfirm={() => {
            setDraft(recommendedDraft(m, goals.data));
            setRefill(false);
          }}
        />
      )}
    </>
  );
}
