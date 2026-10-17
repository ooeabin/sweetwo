import { completeTodoKind, qk, updateMe } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { weekPath } from '../week/week';

type A = 'yes' | 'no';

// O-38b 생활비 카드 사용(Q1, 첫 주 4일째 마지막). 네 → 월 정산 요약 변동 지출에 ‘지난달 카드 사용분’ 라벨.
// 고르면 할 일 ‘고정지출 나누기·생활비 카드’를 끝냄
export function O38bCard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const [value, setValue] = useState<A | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me) return null;
  const cur = value ?? (d.me.card_main === null ? null : d.me.card_main ? 'yes' : 'no');

  const pick = async (a: A) => {
    if (saving || !d.me) return;
    setSaving(true);
    try {
      await updateMe({ card_main: a === 'yes' });
      await completeTodoKind('fixed_card', d.me.id);
      await Promise.all([qk.me, qk.todos].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.weekFixedDone);
      nav('/', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.weekCard}
      onBack={() => nav(weekPath.fixedStart)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
    >
      <ChoiceCards<A>
        label={copy.weekCard}
        value={cur}
        onChange={setValue}
        onPick={(a) => void pick(a)}
        options={[
          { value: 'yes', label: copy.weekCardYes },
          { value: 'no', label: copy.weekCardNo },
        ]}
      />
    </QuestionLayout>
  );
}
