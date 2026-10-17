import { qk, saveIncomeEvents } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { weekPath } from '../week/week';

type A = 'yes' | 'no';

// O-34 상여금 여부(Q1, 첫 주 5일째 ‘나머지 목표·상여금·다른 수입’): 있어요 → O-35, 없어요 → O-35b(내 상여금 기록은 비움)
export function O34Bonus() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [value, setValue] = useState<A | null>(null);
  const pick = async (a: A) => {
    if (a === 'yes') return nav(weekPath.bonusList);
    try {
      await saveIncomeEvents([]);
      await qc.invalidateQueries({ queryKey: qk.incomeEvents });
      nav(weekPath.income);
    } catch {
      toast(copy.loadFailed);
    }
  };
  return (
    <QuestionLayout
      steps={{ total: 3, now: 0 }}
      title={copy.weekBonus}
      onBack={() => nav(-1)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
    >
      <ChoiceCards<A>
        label={copy.weekBonus}
        value={value}
        onChange={setValue}
        onPick={(a) => void pick(a)}
        options={[
          { value: 'yes', label: copy.weekBonusYes },
          { value: 'no', label: copy.weekBonusNo },
        ]}
      />
    </QuestionLayout>
  );
}
