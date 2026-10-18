import { completeTodoKind, fetchInvestAnswers, qk, saveInvestAnswer } from '@sweetwo/api';
import { INVEST_LIMIT, type InvestAnswer } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

const ANSWERS: InvestAnswer[] = ['keep', 'some', 'active', 'unsure'];

// P-09 투자 성향(18 P-09, O-53과 같음). 고르면 내 답 저장 + 첫 주 ‘투자 원칙’ 할 일 끝냄.
// 시작한 사람 답과 다르면 보수적인 쪽(core investPrinciple). ‘건너뛰기’ → 첫 주 7일째 할 일 그대로.
export function P09Invest() {
  const s = useJoinStep('p-09');
  const d = s.d;
  const qc = useQueryClient();
  const answers = useQuery({ queryKey: qk.investAnswers, queryFn: fetchInvestAnswers });
  const [value, setValue] = useState<InvestAnswer | null>(null);
  if (!d.ready || !d.me || answers.isLoading) return null;
  const me = d.me;
  const cur = value ?? answers.data?.mine ?? null;
  const partner = answers.data?.partner ?? null;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.invest}
      help={
        partner
          ? copy.investPartner(d.couple?.partnerName ?? '', copy.investOptions[partner])
          : undefined
      }
      onBack={s.onBack}
      later={{ label: copy.skip, onClick: () => void s.done() }}
    >
      <ChoiceCards<InvestAnswer>
        label={copy.invest}
        value={cur}
        onChange={setValue}
        onPick={(a) =>
          void s.done(async () => {
            await saveInvestAnswer(a);
            await completeTodoKind('invest', me.id);
            await Promise.all(
              [qk.investAnswers, qk.todos].map((k) => qc.invalidateQueries({ queryKey: k })),
            );
          })
        }
        options={ANSWERS.map((a) => ({
          value: a,
          label: copy.investOptions[a],
          sub: a === 'unsure' ? undefined : copy.investLimit(INVEST_LIMIT[a]),
        }))}
      />
    </QuestionLayout>
  );
}
