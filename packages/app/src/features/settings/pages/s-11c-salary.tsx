import { qk, updateMe } from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import {
  AmountInput,
  DayWheel,
  QuestionLayout,
  SectionHeader,
  QuestionSkeleton,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeBand, track } from '../../../shared/analytics';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Day = number | 'last';

// S-11c 내 월급(O-31과 같음): 금액 + 매달 달라요 + 월급날, ‘지금은 월급이 없어요’. 본인만.
// 저장 = 바로 적용 + Toast ‘되돌리기’(상대 알림은 서버). 금액이 바뀌면 여유 자금만, 월급날은 다음 체크리스트부터(20 ‘다시 계산되는 때’).
export function S11cSalary() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return <QuestionSkeleton />;
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
      // 32 4-5 fact_value_changed(2026-11-12 QA 11구간 S11-06): 바뀐 값마다. 월급날은 날짜 숫자(말일 31)로 변동률
      const dayNum = (n: number | null, last: boolean) => (last ? 31 : (n ?? 0));
      if ((me.monthly_income ?? 0) !== income)
        track('fact_value_changed', {
          field: 'income',
          change_band: changeBand(me.monthly_income ?? 0, income),
          source_screen: 'S-11c',
        });
      const fromDay = dayNum(me.payday, !!me.payday_last);
      const toDay = dayNum(typeof dd === 'number' ? dd : null, dd === 'last');
      if (fromDay !== toDay)
        track('fact_value_changed', {
          field: 'payday',
          change_band: changeBand(fromDay, toDay),
          source_screen: 'S-11c',
        });
      carryToast(copy.salarySaved, {
        label: copy.undo,
        onClick: () =>
          quietly(updateMe(before).then(() => qc.invalidateQueries({ queryKey: qk.me }))),
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
      <DayWheel
        label={copy.payday}
        value={payday}
        onChange={setDay}
        lastLabel={copy.lastDay}
        hint={copy.paydayLastHint}
      />
    </QuestionLayout>
  );
}
