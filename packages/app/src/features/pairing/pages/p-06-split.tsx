import { QuestionSkeleton } from '@sweetwo/ui';
import { completeJoin } from '@sweetwo/api';
import { formatManWon, readWon, type SplitLineDraft } from '@sweetwo/core';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { SplitEditor } from '../../salary';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';
import { joinDraft } from '../join-split';

// P-06 월급 계획(18, O-50과 같은 틀). 2026-11-03부터 합류 흐름에서는 안 보임(P-05b에서 추천으로 저장 → 홈 할 일 ‘월급 계획 확인’).
// 예전에 이 화면에서 멈춘 사람만 이어서 봄. 저장 = 합류 완료 → 홈.
// 각자: 내 월급 계획 만들기(core joinerSplit: 고정 25%, 생활 25%, 용돈 10%, 저금 줄 없음(ADR 0007, 저금 항목은 월급 탭에서 직접)). 줄 옆 “찬우님이 매달 95만 원 넣어요”.
// 합쳐서: 공동 월급 계획 다시 채우기(core jointRefill: 있던 줄은 그대로, 내 용돈 줄 + 늘어난 수입을 저금 줄 순서대로). 바뀐 줄은 “95만 원 → 246만 원”.
//   대기 뒤 이어서면 시작한 사람이 이미 두 사람 합으로 만든 월급 계획을 확인만. 그 사이 월급 계획이 바뀌었으면 알리고 다시 계산.
export function P06Split() {
  const s = useJoinStep('p-06');
  const d = s.d;
  const nav = useNavigate();
  const [draft, setDraft] = useState<SplitLineDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!d.ready || !d.me || !d.space || !d.couple)
    return <QuestionSkeleton onBack={s.onBack ?? null} />;
  const me = d.me;
  const starter = d.couple.partnerName;
  const joint = d.space.salary_mode === 'joint';
  const myIncome = me.monthly_income ?? 0;
  const partnerIncome = d.partner?.monthly_income ?? 0;
  const won = (v: number) => readWon(v);

  const x = joinDraft(d);
  if (!x) return null;
  const base = x.lines;
  const before = new Map(
    x.current.filter((l) => l.kind === 'saving').map((l) => [l.goalId ?? '', l.amount]),
  );
  const others = x.others;
  const jointSplit = d.splits.find((sp) => sp.owner_user_id === null);
  const lines = draft ?? base;
  const noteOf = (l: SplitLineDraft) => {
    if (l.kind !== 'saving' || !l.goalId) return undefined;
    if (joint) {
      const b = before.get(l.goalId);
      return b !== undefined && b !== l.amount ? copy.changed(won(b), won(l.amount)) : undefined;
    }
    const o = others[l.goalId] ?? 0;
    return o > 0 ? copy.partnerPuts(starter, `${formatManWon(o)} 원`) : undefined;
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await completeJoin(lines, joint ? jointSplit?.version : undefined);
      if (r === 'split_changed') {
        toast(copy.splitChanged(starter));
        setDraft(null);
        await d.refetch();
        return;
      }
      await d.refetch();
      nav('/', { replace: true });
    } catch {
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void save() });
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string | undefined) =>
    id === me.id ? (me.nickname ?? '') : id === d.partner?.id ? starter : '';
  return (
    <SplitEditor
      lines={lines}
      onChange={setDraft}
      income={joint ? myIncome + partnerIncome : myIncome}
      incomeSub={
        joint
          ? copy.incomes(
              copy.personIncome(starter, won(partnerIncome)),
              copy.personIncome(me.nickname ?? '', won(myIncome)),
            )
          : undefined
      }
      payday={me.payday_last ? 'last' : me.payday}
      goals={d.goals}
      personName={nameOf}
      joint={joint}
      title={joint ? copy.splitJointTitle : copy.splitTitle}
      help={joint && !d.resumed ? copy.splitJointHelp(me.nickname ?? '') : copy.splitHelp}
      primaryLabel={copy.splitDone}
      saving={busy}
      progress={s.chapter}
      onBack={s.onBack}
      noteOf={noteOf}
      onSave={() => void save()}
    />
  );
}
