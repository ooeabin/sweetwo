import { propose, qk, withdrawProposal } from '@sweetwo/api';
import { formatMonthDay, proposalApplyOn, quickChips, spaceBaseDay } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { openSent, useProposals } from '../../proposals';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

// P-07 내 용돈(Q3, 0원 허용). 초기값 = 시작한 사람 용돈과 같은 금액.
// 초기값과 같으면 바로 확정, 다르면 용돈은 초기값으로 두고 시작한 사람에게 제안(좋아요 / 반대만, 08 6장).
export function P07Allowance() {
  const s = useJoinStep('p-07');
  const d = s.d;
  const qc = useQueryClient();
  const proposals = useProposals();
  const [v, setV] = useState<number | null | undefined>(undefined);
  if (!d.ready || !d.me || !d.space || !d.couple || proposals.isLoading) return null;
  const me = d.me;
  const initial = me.allowance ?? d.partner?.allowance ?? null;
  const sent = openSent(proposals.data ?? [], me.id).find((p) => p.item === 'allowance');
  const sentValue =
    sent && typeof sent.after === 'object' && sent.after && !Array.isArray(sent.after)
      ? sent.after.allowance
      : undefined;
  const value = v === undefined ? (typeof sentValue === 'number' ? sentValue : initial) : v;
  const base = spaceBaseDay(d.space, d.couple);
  const differs = value !== null && initial !== null && value !== initial && base !== null;
  const title = copy.allowance(me.nickname ?? '');

  const save = async () => {
    if (value === null) return;
    await saveMe({ allowance: initial ?? value });
    if (differs && base !== null)
      await propose('allowance', { allowance: value }, proposalApplyOn(base));
    else if (sent) await withdrawProposal(sent.id);
    await qc.invalidateQueries({ queryKey: qk.proposals });
  };

  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: value === null, loading: s.saving }}
      onSubmit={() => value !== null && void s.done(save)}
    >
      <AmountInput
        label={title}
        value={value}
        onChange={setV}
        quick={quickChips.small}
        monthly
        allowZero
      />
      {differs && base !== null && (
        <p className="hg-q__help" aria-live="polite">
          {copy.applyNote(formatMonthDay(proposalApplyOn(base)))}
        </p>
      )}
    </QuestionLayout>
  );
}
