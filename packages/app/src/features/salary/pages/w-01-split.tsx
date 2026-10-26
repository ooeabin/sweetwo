import { qk, saveSplit, updateGoal } from '@sweetwo/api';
import { addMonths, thisMonth, ymToDate, type SplitLineDraft } from '@sweetwo/core';
import { Modal, Tabs } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace, useSplits } from '../data';
import { emergencyGoalTarget, ourLinesOf, recommendedDraft } from '../split-draft';
import { SplitEditor, toDraft } from '../split-editor';

// W-01 월급 분배표(20). O-50과 같은 틀. 저장 = 바로 적용 + Toast “분배표를 바꿨어요” + 되돌리기, 상대 알림은 서버.
// 이번 사이클 체크 안 한 줄도 새 금액으로(서버 sync_checklist).
// 각자 + 배우자 합류: 사람 탭(내 탭 기본, `?who=`). 배우자 탭도 고칠 수 있음, 단 배우자 내 목표 줄 금액은 잠금(서버도 확인).
// 수입 줄 → 설정 내 월급(S-11, 내 탭만). 합쳐서면 내 목표 줄 앞에 주인 이름. 연결 해제 대기 중이면 보기만.
export function W01Split() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const splits = useSplits();
  const partner = usePartner();
  const [who, setWho] = useState<string | null>(() => params.get('who'));
  const [drafts, setDrafts] = useState<Record<string, SplitLineDraft[]>>({});
  const [refill, setRefill] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!me.data || !space.data || !goals.data || !splits.data) return null;
  const m = me.data;
  const p = partner.data ?? null;
  const joint = space.data.salary_mode === 'joint';
  const connected =
    space.data.couple_state === 'connected' || space.data.couple_state === 'unlink_pending';
  const pending = space.data.couple_state === 'unlink_pending';
  const tabs = !joint && connected && p;
  const ownerId = joint ? null : tabs && who === p.id ? p.id : m.id;
  const owner = ownerId === p?.id && p ? p : m;
  const theirs = !joint && ownerId !== m.id;
  const key = ownerId ?? 'joint';
  const splitOf = (id: string | null) => splits.data.find((x) => x.owner_user_id === id);
  const mine = splitOf(ownerId);
  const saved = mine ? toDraft(mine.split_line) : null;
  /** 배우자 탭: 배우자 내 목표 줄은 잠금 */
  const lockedGoal = (goalId?: string) =>
    theirs && goals.data.some((g) => g.id === goalId && g.owner_user_id === ownerId);
  const recommend = () =>
    recommendedDraft(owner, goals.data, {
      joint,
      partner: p,
      others:
        joint || !p ? undefined : ourLinesOf(splitOf(ownerId === m.id ? p.id : m.id), goals.data),
      keep: theirs
        ? Object.fromEntries(
            (saved ?? [])
              .filter((l) => l.kind === 'saving' && lockedGoal(l.goalId))
              .map((l) => [l.goalId ?? '', l.amount]),
          )
        : undefined,
    });
  const draft = drafts[key] ?? null;
  const lines = draft ?? saved ?? recommend();
  const income = joint
    ? (m.monthly_income ?? 0) + (p?.monthly_income ?? 0)
    : (owner.monthly_income ?? 0);
  const payday = owner.payday_last ? 'last' : owner.payday;
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/'));

  const write = async (next: SplitLineDraft[]) => {
    await saveSplit(next, ownerId ?? undefined);
    const emergency = goals.data.find((g) => g.template === 'emergency');
    const target = emergencyGoalTarget(next);
    if (!theirs && emergency && target !== emergency.target_amount) {
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

  const name = (id: string | undefined) => (id === m.id ? (m.nickname ?? '') : (p?.nickname ?? ''));
  return (
    <>
      <SplitEditor
        key={key}
        lines={lines}
        onChange={(next) => setDrafts({ ...drafts, [key]: next })}
        income={income}
        payday={payday}
        goals={goals.data}
        personName={name}
        joint={joint}
        title={copy.splitTitle}
        help={copy.splitHelp}
        primaryLabel={copy.save}
        primaryDisabled={!draft || pending}
        saving={saving}
        onBack={back}
        onSave={() => void save()}
        locked={(l) => l.kind === 'saving' && lockedGoal(l.goalId)}
        readOnly={pending}
        onIncome={ownerId === m.id || joint ? () => nav('/settings/me') : undefined}
        notice={
          <>
            {tabs && (
              <Tabs
                label={copy.splitTitle}
                value={ownerId ?? m.id}
                onChange={setWho}
                items={[
                  { value: m.id, label: m.nickname ?? '' },
                  { value: p.id, label: p.nickname ?? '' },
                ]}
              />
            )}
            {pending && <p className="hg-q__help">{copy.splitPending}</p>}
          </>
        }
        extra={
          !pending && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setRefill(true)}
            >
              {copy.refill}
            </button>
          )
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
            setDrafts({ ...drafts, [key]: recommend() });
            setRefill(false);
          }}
        />
      )}
    </>
  );
}
