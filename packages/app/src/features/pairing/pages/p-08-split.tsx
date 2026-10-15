import { propose, qk, withdrawProposal } from '@sweetwo/api';
import {
  formatMonthDay,
  planSummary,
  proposalApplyOn,
  readWon,
  spaceBaseDay,
  splitShares,
} from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { openSent, SplitPicker, useProposals, type SplitPick } from '../../proposals';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useJoinStep } from '../join-step';

// P-08 분담 방식 확인. 시작한 사람이 고른 방식 + 내 실제 수입으로 다시 계산한 두 사람 금액(‘나중에 할게요’였으면 반반).
// ‘좋아요’ = 즉시 확정. ‘다르게 해볼래요’ = O-52 선택지·슬라이더에서 고른 안을 시작한 사람에게 제안(확정 전엔 지금 방식 유지).
export function P08Split() {
  const s = useJoinStep('p-08');
  const d = s.d;
  const qc = useQueryClient();
  const proposals = useProposals();
  const [pick, setPick] = useState<SplitPick | null>(null);
  if (!d.ready || !d.me || !d.space || !d.couple || proposals.isLoading) return null;
  const sp = d.space;
  const c = d.couple;
  const mode = sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode;
  const sent = openSent(proposals.data ?? [], d.me.id).find((p) => p.item === 'split');
  const base = spaceBaseDay(sp, c);
  const plan = planSummary({
    myIncome: c.myIncome,
    partnerIncome: c.partnerIncome,
    partnerUnknown: c.partnerUnknown,
    myAllowance: c.myAllowance,
    partnerAllowance: c.partnerAllowance,
    fixedTotal: sp.fixed_total,
    loanRepayment: sp.loan_repayment,
    livingBudget: sp.living_budget,
  });
  const x = splitShares({
    total: plan.commonFund,
    mode,
    myRatio: c.myRatio,
    myIncome: c.myIncome ?? 0,
    partnerIncome: c.partnerIncome ?? 0,
  });
  const done = () => qc.invalidateQueries({ queryKey: qk.proposals });

  const like = () =>
    void s.done(async () => {
      await saveSpace({ split_mode: mode, split_deferred: false });
      if (sent) await withdrawProposal(sent.id);
      await done();
    });

  if (pick) {
    const same = pick.mode === mode && (mode !== 'custom' || pick.myPct === c.myRatio);
    const send = () =>
      void s.done(async () => {
        if (!pick.mode || base === null) return;
        if (same) {
          await saveSpace({ split_mode: mode, split_deferred: false });
          if (sent) await withdrawProposal(sent.id);
        } else {
          await propose(
            'split',
            // 합류한 사람 화면: 시작한 사람 몫 = 100 − 내 몫(직접 정할 때만)
            pick.mode === 'custom'
              ? { mode: pick.mode, starter_ratio: 100 - pick.myPct }
              : { mode: pick.mode },
            proposalApplyOn(base),
          );
        }
        await done();
      });
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.split}
        help={
          same || base === null ? undefined : copy.applyNote(formatMonthDay(proposalApplyOn(base)))
        }
        onBack={() => setPick(null)}
        primary={{
          label: same ? copy.good : copy.proposeTo(c.partnerName),
          disabled: !pick.mode,
          loading: s.saving,
        }}
        onSubmit={send}
      >
        <SplitPicker
          label={copy.split}
          value={pick}
          onChange={setPick}
          total={plan.commonFund}
          myName={c.myName}
          partnerName={c.partnerName}
          myIncome={c.myIncome ?? 0}
          partnerIncome={c.partnerIncome ?? 0}
          partnerUnknown={c.partnerUnknown}
        />
      </QuestionLayout>
    );
  }

  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.split}
      onBack={s.onBack}
      primary={{ label: copy.good, loading: s.saving }}
      later={{
        label: copy.differently,
        onClick: () => setPick({ mode, myPct: c.myRatio }),
      }}
      onSubmit={like}
    >
      <div className="hg-option hg-option--card is-on" style={{ padding: 'var(--space-4)' }}>
        <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
          <span>{copy.splitModes[mode]}</span>
          <span className="hg-row" style={{ gap: 'var(--space-4)' }}>
            <span>
              <span className="hg-help">{c.myName}</span> <b>{readWon(x.me)}</b>
            </span>
            <span>
              <span className="hg-help">{c.partnerName}</span> <b>{readWon(x.partner)}</b>
            </span>
          </span>
        </span>
      </div>
    </QuestionLayout>
  );
}
