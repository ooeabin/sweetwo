import { propose, qk, updateMe, updateSpace } from '@sweetwo/api';
import {
  formatMonthDay,
  proposalApplyOn,
  quickChips,
  spaceBaseDay,
  type BaseDay,
} from '@sweetwo/core';
import { AmountInput, DayChips, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { onboardingCopy as oc } from '../../onboarding';
import { proposalCopy, recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { moneyPlan, type MoneyPatch } from '../money';

type Field = 'income' | 'fixed' | 'loan' | 'allowance' | 'living';
const FIELDS: Field[] = ['income', 'fixed', 'loan', 'allowance', 'living'];

// F-05a·b 내 수입 → 월급날(사실값: 바로 저장 + 안 나눈 돈 재계산), F-05c 고정지출·대출 상환 합계(바로),
// F-05d 내 용돈·생활비 예산(배분 결정: 연결된 부부는 제안, 미합류·혼자 쓰기는 바로). 입력하는 동안 저축 가능 금액 변화 미리보기.
export function F05Edit() {
  const { field = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [step, setStep] = useState<'amount' | 'payday'>('amount');
  const [payday, setPayday] = useState<BaseDay | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const back = () => nav('/assets/money');

  if (d.loading || !d.me || !d.space || !d.couple) return null;
  const f = field as Field;
  if (!FIELDS.includes(f)) return <Navigate to="/assets/money" replace />;
  const me = d.me;
  const sp = d.space;
  const c = d.couple;
  const connected = sp.couple_state === 'connected';
  const proposal = connected && (f === 'allowance' || f === 'living');

  const current: Record<Field, number | null> = {
    income: me.monthly_income,
    fixed: sp.fixed_total,
    loan: sp.loan_repayment,
    allowance: me.allowance,
    living: sp.living_budget,
  };
  const v = value === undefined ? current[f] : value;
  const patchOf = (x: number): MoneyPatch =>
    f === 'income'
      ? { myIncome: x }
      : f === 'fixed'
        ? { fixedTotal: x }
        : f === 'loan'
          ? { loanRepayment: x }
          : f === 'allowance'
            ? { myAllowance: x }
            : { livingBudget: x };
  const before = moneyPlan(me, sp, d.partnerProfile).sum.saveable;
  const after = v === null ? before : moneyPlan(me, sp, d.partnerProfile, patchOf(v)).sum.saveable;
  const diff = after - before;
  const base = spaceBaseDay(sp, c);
  const curPayday: BaseDay | null = me.payday_last ? 'last' : (me.payday ?? null);
  const pd = payday === undefined ? curPayday : payday;

  const title: Record<Field, string> = {
    income: oc.income(c.myName),
    fixed: oc.fixedTotal,
    loan: oc.loan,
    allowance: oc.allowance(c.myName),
    living: oc.living,
  };

  const done = async (text: string) => {
    await Promise.all(
      [qk.me, qk.space, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })),
    );
    toast(text);
    back();
  };
  const save = async () => {
    if (saving || v === null) return;
    setSaving(true);
    try {
      if (proposal && base !== null) {
        if (f === 'allowance') await propose('allowance', { allowance: v }, proposalApplyOn(base));
        else await propose('living_budget', { living_budget: v }, proposalApplyOn(base));
        return await done(copy.proposed(c.partnerName));
      }
      if (f === 'income')
        await updateMe({
          monthly_income: v,
          ...(pd === 'last'
            ? { payday: null, payday_last: true }
            : pd !== null
              ? { payday: pd, payday_last: false }
              : {}),
        });
      if (f === 'allowance') await updateMe({ allowance: v });
      if (f === 'fixed') await updateSpace({ fixed_total: v, fixed_total_estimated: false });
      if (f === 'loan') await updateSpace({ loan_repayment: v });
      if (f === 'living') await updateSpace({ living_budget: v, living_budget_estimated: false });
      // 사실값 저장 직후 이번 사이클 안 나눈 돈 재계산(분담)
      const n = await recalcPendingShares();
      await done(n ? copy.savedRecalc : copy.savedNoPending);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  const preview =
    v !== null && diff !== 0 ? (
      <p className="hg-q__help" aria-live="polite">
        {diff > 0 ? copy.previewUp(m(diff)) : copy.previewDown(m(-diff))}
      </p>
    ) : null;

  // 내 수입 다음 월급날(F-05b)
  if (f === 'income' && step === 'payday')
    return (
      <QuestionLayout
        title={oc.payday}
        onBack={() => setStep('amount')}
        primary={{ label: copy.saveEdit, disabled: pd === null, loading: saving }}
        onSubmit={() => void save()}
      >
        <DayChips
          label={oc.payday}
          value={pd}
          lastLabel={oc.paydayLast}
          onChange={(x) => setPayday(x)}
        />
      </QuestionLayout>
    );

  return (
    <QuestionLayout
      title={title[f]}
      help={
        proposal && base !== null && v !== current[f]
          ? proposalCopy.applyNote(formatMonthDay(proposalApplyOn(base)))
          : undefined
      }
      onBack={back}
      primary={{
        label:
          f === 'income' ? copy.next : proposal ? copy.proposeTo(c.partnerName) : copy.saveEdit,
        disabled: v === null || (f !== 'income' && v === current[f]),
        loading: saving,
      }}
      onSubmit={() => (f === 'income' ? setStep('payday') : void save())}
    >
      <AmountInput
        label={title[f]}
        value={v}
        onChange={setValue}
        quick={quickChips.small}
        monthly
        allowZero={f !== 'income'}
      />
      {preview}
    </QuestionLayout>
  );
}
