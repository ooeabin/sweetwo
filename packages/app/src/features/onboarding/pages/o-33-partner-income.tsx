import { bands, quickChips } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

const EXACT = 'exact';
const UNKNOWN = 'unknown';
const ODD = 100_000_000; // 1억 원 초과면 한 번 확인(O-31과 같음)

// O-33 배우자 수입(Q1). 구간 = 중간값 ‘추정’(P-05에서 덮어씀). ‘정확히 알아요’ = 금액 칸(Q3), ‘추정’ 없이.
// 모르면 ‘{나}님 몫’ 기준.
export function O33PartnerIncome() {
  const s = useStep('o-33');
  const sp = s.state.space;
  const [pick, setPick] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const ok = useConfirmOnce();
  if (!s.ready) return null;
  const partner = sp?.partner_nickname ?? '';
  const title = copy.partnerIncome(partner);
  const band = bands.monthlyIncome.find((b) => b.value === sp?.partner_income);
  const saved = sp?.partner_income_unknown
    ? UNKNOWN
    : sp?.partner_income === null || sp?.partner_income === undefined
      ? null
      : sp.partner_income_estimated && band
        ? band.label
        : EXACT;
  const value = pick ?? saved;
  const exactValue =
    amount === undefined ? (saved === EXACT ? (sp?.partner_income ?? null) : null) : amount;
  const options = [
    ...bands.monthlyIncome.map((b) => ({ value: b.label, label: b.label })),
    { value: EXACT, label: copy.partnerExact },
    { value: UNKNOWN, label: copy.unsure },
  ];
  const exact = value === EXACT;

  return (
    <QuestionLayout
      chapter={s.chapter}
      title={title}
      help={copy.partnerIncomeHelp}
      onBack={s.onBack}
      primary={exact ? { label: copy.next, disabled: !exactValue, loading: s.saving } : undefined}
      onSubmit={() =>
        exact &&
        exactValue &&
        ok.check(exactValue > ODD) &&
        void s.done(() =>
          saveSpace({
            partner_income: exactValue,
            partner_income_estimated: false,
            partner_income_unknown: false,
          }),
        )
      }
    >
      <ChoiceCards<string>
        label={title}
        value={value}
        onChange={setPick}
        onPick={(v) => {
          if (v === EXACT) return; // 금액을 넣고 ‘다음’
          const b = bands.monthlyIncome.find((x) => x.label === v);
          void s.done(() =>
            saveSpace(
              b
                ? {
                    partner_income: b.value,
                    partner_income_estimated: true,
                    partner_income_unknown: false,
                  }
                : {
                    partner_income: null,
                    partner_income_estimated: false,
                    partner_income_unknown: true,
                  },
            ),
          );
        }}
        options={options}
      />
      {exact && (
        <AmountInput
          label={copy.partnerExactLabel(partner)}
          value={exactValue}
          onChange={(x) => {
            setAmount(x);
            ok.reset();
          }}
          quick={quickChips.small}
          monthly
        />
      )}
      {ok.banner}
    </QuestionLayout>
  );
}
