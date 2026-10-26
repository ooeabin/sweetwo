import { insertGoal, qk } from '@sweetwo/api';
import { formatManWon, formatYm, goalNeed } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { toAllocGoal } from '../../salary';
import { copy } from '../copy';
import { useAddDraft } from '../add/draft';
import { addPath } from '../add/flow';
import { addPayload, previewGoal } from '../add/payload';
import { useAddStep } from '../add/step';

const man = (v: number) => `${formatManWon(v)} 원`;

// G-03f 미리보기(Q7, 22): “매달 25만 원씩 모으면 2028년 3월에 이뤄요”(월 필요액 기준) /
// 보조 “분배표에 이 목표 줄을 0원으로 만들어 둘게요. 금액은 분배표에서 정해요”. 추가하기 → 바로 저장,
// 분배표에 0원 저금 줄(서버 트리거) → G-02. 우선순위는 그 종류 묶음 맨 아래.
export function G03fGoalConfirm() {
  const s = useAddStep('confirm');
  const nav = useNavigate();
  const qc = useQueryClient();
  const clear = useAddDraft((x) => x.clear);
  const [saving, setSaving] = useState(false);
  const d = s.data;
  const solo = d.space?.couple_state === 'solo';
  const meId = d.me?.id ?? null;
  const p = addPayload(solo ? { ...s.draft, owner: 'me' } : s.draft, meId);
  if (!p) return <Navigate to={addPath()} replace />;
  if (d.loading || !d.me) return null;

  const group = d.goals.filter(
    (g) => g.owner_user_id === p.owner_user_id && g.template !== 'emergency',
  );
  const priority = Math.max(0, ...group.map((g) => g.priority)) + 1;
  const draft = previewGoal(p, { spaceId: d.me.space_id ?? '', me: d.me.id, priority, linked: 0 });
  const need = p.target_amount !== null ? goalNeed(toAllocGoal(draft)) : null;
  const title =
    p.kind === 'monthly' && p.target_amount
      ? copy.confirmMonthly(man(p.target_amount))
      : need && p.deadline
        ? copy.confirmTitle(man(need), formatYm(p.deadline))
        : copy.confirmUnknown(p.name);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const id = await insertGoal({ ...p, priority });
      toast(copy.added);
      clear();
      await Promise.all(
        [qk.goals, qk.splits, qk.goalSaved].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      await qc.invalidateQueries({ queryKey: ['pay_checklist'] });
      nav(`/goals/${id}`, { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      help={copy.confirmZeroLine}
      onBack={s.onBack}
      primary={{ label: copy.addDone, loading: saving }}
      onSubmit={() => void submit()}
    >
      <section className="hg-card hg-stack" aria-label={p.name}>
        <span className="hg-card__label">{p.name}</span>
        {p.target_amount !== null && <span className="hg-card__value">{man(p.target_amount)}</span>}
        <span className="hg-card__meta">{copy.confirmPosition}</span>
      </section>
    </QuestionLayout>
  );
}
