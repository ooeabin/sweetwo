import { qk, updateMe } from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import { AmountInput, DayChips, QuestionLayout, SectionHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Day = number | 'last';

// S-11c 내 월급(O-31과 같음): 금액 + 매달 달라요 + 월급날, ‘지금은 월급이 없어요’. 본인만.
// 저장 = 바로 적용 + Toast ‘되돌리기’(상대 알림은 서버). 금액이 바뀌면 남는 돈만, 월급날은 다음 체크리스트부터(20 ‘다시 계산되는 때’).
export function S11cSalary() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
  const me = d.me;
  const value = amount === undefined ? (me.monthly_income ?? null) : amount;
  const isVariable = variable ?? me.income_variable ?? false;
  const savedDay: Day | null = me.payday_last ? 'last' : (me.payday ?? null);
  const payday = day === undefined ? savedDay : day;
  const valid = value !== null && value > 0 && payday !== null;
  const back = () => nav('/settings/me');

  const save = async (income: number, dd: Day | null) => {
    if (saving) return;
    const before = {
      monthly_income: me.monthly_income,
      income_variable: me.income_variable,
      payday: me.payday,
      payday_last: me.payday_last,
    };
    setSaving(true);
    try {
      await updateMe({
        monthly_income: income,
        income_variable: income > 0 && isVariable,
        payday: typeof dd === 'number' ? dd : null,
        payday_last: dd === 'last',
      });
      await qc.invalidateQueries({ queryKey: qk.me });
      toast(copy.salarySaved, {
        label: copy.undo,
        onClick: () => void updateMe(before).then(() => qc.invalidateQueries({ queryKey: qk.me })),
      });
      nav('/settings/me', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.salaryQ}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={back}
      primary={{ label: copy.save, disabled: !valid, loading: saving }}
      onSubmit={() => valid && void save(value, payday)}
    >
      <AmountInput
        label={copy.salaryQ}
        value={value}
        onChange={setAmount}
        quick={quickChips.small.slice(1)}
        monthly
        embedded
        zeroLink={{ label: copy.noSalary, onClick: () => void save(0, null) }}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={isVariable}
        className="hg-consent__check"
        onClick={() => setVariable(!isVariable)}
      >
        <span className={isVariable ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
        <span className="hg-consent__label">{copy.variable}</span>
      </button>
      <SectionHeader title={copy.payday} />
      <DayChips label={copy.payday} value={payday} onChange={setDay} lastLabel={copy.lastDay} />
    </QuestionLayout>
  );
}
