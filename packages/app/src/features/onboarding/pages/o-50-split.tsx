import { saveSplit, updateGoal } from '@sweetwo/api';
import { addMonths, thisMonth, ymToDate, type SplitLineDraft } from '@sweetwo/core';
import { useState } from 'react';
import { emergencyGoalTarget, recommendedDraft, SplitEditor, toDraft } from '../../salary';
import { copy } from '../copy';
import { useSplits } from '../data';
import { useStep } from '../step';

// O-50 월급 분배표(17 온보딩 ②). 추천값이 채워진 목록을 고쳐서 확정(목록 틀은 W-01과 같은 SplitEditor).
// 저장하면 비상금 목표 금액 = (고정지출 + 생활비) × 3, 기한 1년 뒤.
export function O50Split() {
  const s = useStep('o-50');
  const splits = useSplits();
  const [draft, setDraft] = useState<SplitLineDraft[] | null>(null);
  if (!s.ready || splits.isLoading) return null;
  const me = s.state.me;
  const goals = s.state.goals ?? [];
  if (!me) return null;

  const mine = splits.data?.find((x) => x.owner_user_id === me.id || x.owner_user_id === null);
  const saved = mine?.split_line.length ? toDraft(mine.split_line) : null;
  const joint = s.state.space?.salary_mode === 'joint';
  // 합쳐서 + 배우자 합류 뒤: 수입 = 두 사람 합, 용돈은 사람마다 1줄(17 O-50 2·4번)
  const partner = joint ? (s.state.partner ?? null) : null;
  const lines = draft ?? saved ?? recommendedDraft(me, goals, { partner, joint });
  const income = (me.monthly_income ?? 0) + (partner?.monthly_income ?? 0);

  const save = () =>
    s.done(async () => {
      await saveSplit(lines, joint ? undefined : me.id);
      const emergency = goals.find((g) => g.template === 'emergency');
      if (emergency) {
        await updateGoal(emergency.id, {
          target_amount: emergencyGoalTarget(lines),
          amount_estimated: false,
          deadline: ymToDate(addMonths(thisMonth(), 12)),
          deadline_estimated: false,
        });
      }
      await splits.refetch();
    });

  return (
    <SplitEditor
      lines={lines}
      onChange={setDraft}
      income={income}
      payday={me.payday_last ? 'last' : me.payday}
      goals={goals}
      personName={(id) =>
        id && id === partner?.id ? (partner.nickname ?? '') : (me.nickname ?? '')
      }
      joint={joint}
      title={copy.splitTitle}
      help={copy.splitTableHelp}
      primaryLabel={copy.splitDone}
      saving={s.saving}
      progress={s.chapter}
      onBack={s.onBack}
      onSave={() => void save()}
    />
  );
}
