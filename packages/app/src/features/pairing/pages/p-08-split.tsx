import { planSummary, readWon, splitShares } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useJoinStep } from '../join-step';

// P-08 분담 방식 확인. 시작한 사람이 고른 방식 + 내 실제 수입으로 다시 계산한 두 사람 금액(‘나중에 할게요’였으면 반반).
// ‘좋아요’ = 즉시 확정 → 합류 완료(P-11). ‘다르게 해볼래요’(O-52 → 제안)는 제안 기능과 함께.
export function P08Split() {
  const s = useJoinStep('p-08');
  const d = s.d;
  if (!d.ready || !d.me || !d.space || !d.couple) return null;
  const sp = d.space;
  const c = d.couple;
  const mode = sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode;
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
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.split}
      onBack={s.onBack}
      primary={{ label: copy.good, loading: s.saving }}
      onSubmit={() =>
        void s.done(() => saveSpace({ split_mode: mode, split_deferred: false }), 'p-11')
      }
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
