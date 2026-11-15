import { fetchJoinSavingOffer, qk, startJoinSaving } from '@sweetwo/api';
import { amountBand, quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useJoinData } from '../data';
import { joinPath } from '../join-step';

// P-09 합류 때 모은 금액(18, 3차 검토 D2, 2026-11-15): 합류를 마친 뒤 P-10 축하 앞에 한 번. 각자 계열이고 묶을 상대
// 같이 모으기(상대만 든 묶음, 없으면 상대 첫 저금)가 있을 때만(서버 join_saving_offer, 없으면 바로 P-10).
// “지금까지 모은 금액” 한 칸 → ‘같이 모으기’ = 내 새 저금(시작할 때 모은 금액)을 그 묶음에 바로 넣음(join_saving_start),
// 첫날 홈 H-10에 둘이 모은 금액이 보임. ‘나중에 할게요’ = 아무것도 안 만듦(홈 띠 13번 권유는 그대로)
export function P09SavedSoFar() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useJoinData();
  const offer = useQuery({ queryKey: qk.joinSavingOffer, queryFn: fetchJoinSavingOffer });
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const toCelebrate = () => nav(joinPath('p-10'), { replace: true });
  if (!d.ready || offer.isPending)
    return <QuestionSkeleton onBack={null} title={copy.savedTitle} />;
  // 못 불러왔거나 묶을 곳이 없으면 이 화면 없이 축하로
  if (offer.isError || !offer.data) return <Navigate to={joinPath('p-10')} replace />;
  const o = offer.data;
  const valid = amount !== null && amount > 0;
  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await startJoinSaving(amount);
      track('join_saved_answered', {
        entered: true,
        amount_band: amountBand(amount),
        new_bundle: !o.bundle_id,
      });
      void qc.invalidateQueries({ queryKey: qk.bundles });
      void qc.invalidateQueries({ queryKey: qk.goals });
      void qc.invalidateQueries({ queryKey: qk.goalSaved });
      toCelebrate();
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void submit() });
    }
  };
  return (
    <QuestionLayout
      title={copy.savedTitle}
      help={copy.savedHelp(d.starterName, o.name)}
      note={copy.savedNote((d.me?.monthly_income ?? 0) > 0)}
      primary={{ label: copy.savedStart, disabled: !valid, loading: saving }}
      onSubmit={() => void submit()}
      later={{
        label: copy.later,
        onClick: () => {
          track('join_saved_answered', { entered: false, amount_band: null, new_bundle: false });
          toCelebrate();
        },
      }}
    >
      <AmountInput
        label={copy.savedLabel}
        value={amount}
        onChange={setAmount}
        quick={quickChips.small.slice(1)}
        embedded
      />
    </QuestionLayout>
  );
}
