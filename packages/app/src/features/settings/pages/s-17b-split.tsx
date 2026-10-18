import { propose, qk, updateSpace } from '@sweetwo/api';
import { formatMonthDay, planSummary, proposalApplyOn, spaceBaseDay } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { SplitPicker, type SplitPick } from '../../proposals';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-17 파트 5 분담 방식 다시 답하기(O-52와 같은 화면). 연결된 부부는 제안(적용일 = 72시간이 지난 첫 기준일), 아니면 바로.
export function S17bSplit() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [pick, setPick] = useState<SplitPick | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me || !d.space || !d.c) return null;
  const sp = d.space;
  const c = d.c;
  const back = () => nav('/settings/answers', { replace: true });
  const mode = sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode;
  const cur: SplitPick = pick ?? { mode, myPct: c.myRatio };
  const base = spaceBaseDay(sp, c);
  const connected = sp.couple_state === 'connected';
  const same = cur.mode === mode && (mode !== 'custom' || cur.myPct === c.myRatio);
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
  const save = async () => {
    if (saving || !cur.mode || same) return;
    setSaving(true);
    try {
      const starter = cur.mode === 'custom' ? (c.starter ? cur.myPct : 100 - cur.myPct) : null;
      if (connected && base !== null) {
        await propose(
          'split',
          cur.mode === 'custom' ? { mode: cur.mode, starter_ratio: starter } : { mode: cur.mode },
          proposalApplyOn(base),
        );
        await qc.invalidateQueries({ queryKey: qk.proposals });
        toast(copy.proposedTo(c.partnerName));
      } else {
        await updateSpace({
          split_mode: cur.mode,
          split_deferred: false,
          ...(starter !== null ? { split_ratio: starter } : {}),
        });
        await qc.invalidateQueries({ queryKey: qk.space });
        toast(copy.savedAnswer);
      }
      back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.askSplit}
      help={
        connected && !same && base !== null
          ? copy.applyNote(formatMonthDay(proposalApplyOn(base)))
          : undefined
      }
      onBack={back}
      primary={{
        label: connected ? copy.proposeTo(c.partnerName) : copy.save,
        disabled: !cur.mode || same,
        loading: saving,
      }}
      onSubmit={() => void save()}
    >
      <SplitPicker
        label={copy.askSplit}
        value={cur}
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
