import { completeTodoKind, qk, saveInvestAnswer } from '@sweetwo/api';
import { INVEST_LIMIT, type InvestAnswer } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetsData } from '../data';

const ANSWERS: InvestAnswer[] = ['keep', 'some', 'active', 'unsure'];

// O-53 투자 원칙(17 O-53, 09 6-7, Q1): 첫 주 7일째 할 일과 재정 진단 ‘지금 정하기’에서 엶.
// 고르면 내 답 저장 + 할 일 끝냄 → 재정 진단. 허용 비중 = 두 답 중 보수적인 쪽(core investPrinciple).
export function O53InvestPrinciple() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const [value, setValue] = useState<InvestAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
  const cur = value ?? d.answers.mine;
  const partner = d.answers.partner;

  const save = async (a: InvestAnswer) => {
    if (saving || !d.me) return;
    setSaving(true);
    try {
      await saveInvestAnswer(a);
      await completeTodoKind('invest', d.me.id);
      await Promise.all(
        [qk.investAnswers, qk.todos].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      toast(copy.principleSaved);
      nav('/assets', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.principleTitle}
      help={
        partner && !d.couple?.solo
          ? copy.principlePartner(d.couple?.partnerName ?? '', copy.principleOptions[partner])
          : undefined
      }
      onBack={() => nav(-1)}
    >
      <ChoiceCards<InvestAnswer>
        label={copy.principleTitle}
        value={cur}
        onChange={setValue}
        onPick={(a) => void save(a)}
        options={ANSWERS.map((a) => ({
          value: a,
          label: copy.principleOptions[a],
          sub: a === 'unsure' ? undefined : copy.principleLimit(INVEST_LIMIT[a]),
        }))}
      />
    </QuestionLayout>
  );
}
