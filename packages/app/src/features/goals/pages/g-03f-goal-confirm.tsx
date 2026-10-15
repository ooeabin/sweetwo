import { insertGoals, propose, qk } from '@sweetwo/api';
import { formatManWon, formatMonthDay, formatYm, proposalApplyOn } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { useAddDraft } from '../add/draft';
import { addPath } from '../add/flow';
import { addPayload, previewGoal } from '../add/payload';
import { useAddStep } from '../add/step';

const man = (v: number) => `${formatManWon(v)} 원`;

// G-03f 미리보기(Q7): “매달 25만 원씩 모으면 2028년 3월에 달성해요”. 우선순위는 맨 아래(위치 고르기는 G-06과 함께).
// 연결된 부부 = “{배우자}님께 제안하기”(goal_add), 아니면 “추가하기”. 저축 가능 금액이 모자라면 안내(G-04는 다음 단계).
export function G03fGoalConfirm() {
  const s = useAddStep('confirm');
  const nav = useNavigate();
  const qc = useQueryClient();
  const clear = useAddDraft((x) => x.clear);
  const [saving, setSaving] = useState(false);
  const d = s.data;
  const p = addPayload(s.draft, d.connected);
  if (!p) return <Navigate to={addPath()} replace />;
  if (d.loading || !d.me) return null;

  const priority = Math.max(0, ...d.goals.map((g) => g.priority)) + 1;
  const after = d.viewAdd(previewGoal(p, { spaceId: d.me.space_id ?? '', me: d.me.id, priority }));
  const line = after?.lines.find((l) => l.id === 'new');
  const title =
    line && p.kind === 'monthly' && line.alloc > 0
      ? copy.confirmMonthly(man(line.alloc))
      : line && line.alloc > 0 && line.expected
        ? copy.confirmTitle(man(line.alloc), formatYm(line.expected))
        : copy.confirmUnknown(p.name);
  const shortNow = d.view?.shortfall ?? 0;
  const shortAfter = after?.shortfall ?? 0;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (d.connected && d.base !== null) {
        await propose('goal_add', p, proposalApplyOn(d.base));
        toast(copy.proposed(d.couple?.partnerName ?? ''));
      } else {
        await insertGoals([{ ...p, priority }]);
        toast(copy.added);
      }
      clear();
      await Promise.all([qk.goals, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })));
      nav('/goals', { replace: true });
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
      help={
        d.connected && d.base !== null
          ? proposalCopy.applyNote(formatMonthDay(proposalApplyOn(d.base)))
          : undefined
      }
      onBack={s.onBack}
      primary={{
        label: d.connected ? copy.proposeTo(d.couple?.partnerName ?? '') : copy.addDone,
        loading: saving,
      }}
      onSubmit={() => void submit()}
    >
      <section className="hg-card hg-stack" aria-label={p.name}>
        <span className="hg-card__label">{p.name}</span>
        {p.target_amount !== null && <span className="hg-card__value">{man(p.target_amount)}</span>}
        <span className="hg-card__meta">{copy.confirmPosition}</span>
      </section>
      {shortAfter > shortNow && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{copy.shortAfterAdd(man(shortAfter))}</span>
        </p>
      )}
    </QuestionLayout>
  );
}
