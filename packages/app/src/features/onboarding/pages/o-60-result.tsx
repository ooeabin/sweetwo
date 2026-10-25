import { startChecklist } from '@sweetwo/api';
import { formatYm, goalEta, readWon, templateByKey } from '@sweetwo/core';
import { Illustration, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSplits } from '../data';
import { topGoal } from '../flow';
import { toAllocGoal } from '../../salary';
import { useStep } from '../step';

/** 늦은 기간: “n년 m개월”, 딱 떨어지면 “n년”, 1년 미만은 “m개월” */
const lateText = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return copy.months(m);
  return m ? `${copy.years(y)} ${copy.months(m)}` : copy.years(y);
};

// O-60 결과(17 온보딩 ②). 1순위 목표(없으면 비상금)를 매달 저금 줄 금액으로 언제 이루는지.
// ‘시작할게요’ → 첫 체크리스트를 바로 만들고(지금이 든 사이클) 온보딩을 마치고 홈으로.
export function O60Result() {
  const s = useStep('o-60');
  const splits = useSplits();
  const [busy, setBusy] = useState(false);
  if (!s.ready || splits.isLoading) return null;
  const me = s.state.me;
  const goals = s.state.goals ?? [];
  const goal = topGoal(goals) ?? goals.find((g) => g.template === 'emergency');
  const split = splits.data?.find((x) => x.owner_user_id === me?.id || x.owner_user_id === null);
  const monthly =
    split?.split_line.find((l) => l.kind === 'saving' && l.goal_id === goal?.id)?.amount ?? 0;
  const eta = goal ? goalEta(toAllocGoal(goal), monthly) : null;
  const art = goal ? templateByKey(goal.template)?.illustration : null;
  const payday = me?.payday_last ? copy.paydayLast : me?.payday ? `${me.payday}일` : null;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (split) await startChecklist(split.owner_user_id ?? undefined);
    } catch {
      setBusy(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void start() });
      return;
    }
    await s.finish();
    setBusy(false);
  };

  return (
    <QuestionLayout
      title={
        eta?.expected && goal
          ? copy.resultTitle(readWon(monthly), formatYm(eta.expected), goal.name)
          : copy.resultNoSaving
      }
      help={
        eta?.lateMonths === null || eta?.lateMonths === undefined
          ? undefined
          : eta.lateMonths > 0
            ? `${copy.resultLate(lateText(eta.lateMonths))}. ${copy.resultLateHelp}`
            : copy.resultOnTime
      }
      primary={{ label: copy.resultStart, loading: busy }}
      onSubmit={() => void start()}
    >
      {art && <Illustration name={art} className="hg-empty__art" />}
      {payday && <p className="hg-help">{copy.resultTodo(payday)}</p>}
    </QuestionLayout>
  );
}
