import { bands } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

// O-33 배우자 수입 구간(Q1). 구간 중간값 ‘추정’ 저장(P-05에서 덮어씀). 모르면 ‘{나}님 몫’ 기준.
export function O33PartnerIncome() {
  const s = useStep('o-33');
  const sp = s.state.space;
  const [pick, setPick] = useState<string | null>(null);
  if (!s.ready) return null;
  const title = copy.partnerIncome(sp?.partner_nickname ?? '');
  const saved = sp?.partner_income_unknown
    ? 'unknown'
    : (bands.monthlyIncome.find((b) => b.value === sp?.partner_income)?.label ?? null);
  const options = [
    ...bands.monthlyIncome.map((b) => ({ value: b.label, label: b.label })),
    { value: 'unknown', label: copy.unsure },
  ];
  return (
    <QuestionLayout steps={s.steps} title={title} onBack={s.onBack}>
      <ChoiceCards<string>
        label={title}
        value={pick ?? saved}
        onChange={setPick}
        onPick={(v) => {
          const band = bands.monthlyIncome.find((b) => b.label === v);
          void s.done(() =>
            saveSpace(
              band
                ? {
                    partner_income: band.value,
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
    </QuestionLayout>
  );
}
