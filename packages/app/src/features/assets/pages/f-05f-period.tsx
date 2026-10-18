import { quickChips, thisMonth } from '@sweetwo/core';
import { AmountInput, QuestionLayout, YearMonthInput } from '@sweetwo/ui';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { copy } from '../copy';
import { replanPath, useReplan } from '../replan/draft';

// F-05f 기간(연·월 시작 → 끝, 이번 달부터, 끝은 시작 이후) → F-05g “그 기간 월 수입은 얼마예요?”(‘수입이 없어요’ = 0원) → F-07c.
// 내 수입만. 줄어드는 폭과 무관.
export function F05fPeriod() {
  const { step = 'start' } = useParams();
  const nav = useNavigate();
  const p = useReplan((x) => x.period);
  const set = useReplan((x) => x.set);
  const now = thisMonth();

  if (step === 'end') {
    if (!p.start) return <Navigate to={replanPath.period('start')} replace />;
    const bad = p.end !== null && p.end < p.start;
    return (
      <QuestionLayout
        title={copy.periodEnd}
        onBack={() => nav(replanPath.period('start'))}
        primary={{ label: copy.next, disabled: !p.end || bad }}
        onSubmit={() => p.end && !bad && nav(replanPath.period('amount'))}
      >
        <YearMonthInput
          label={copy.periodEnd}
          value={p.end}
          onChange={(end) => set({ period: { ...p, end } })}
          error={bad ? copy.periodEndBefore : undefined}
        />
      </QuestionLayout>
    );
  }

  if (step === 'amount') {
    if (!p.start || !p.end) return <Navigate to={replanPath.period('start')} replace />;
    const go = (amount: number) => {
      set({ period: { ...p, amount } });
      nav(replanPath.compare('period'));
    };
    return (
      <QuestionLayout
        title={copy.periodAmount}
        onBack={() => nav(replanPath.period('end'))}
        primary={{ label: copy.next, disabled: p.amount === null }}
        onSubmit={() => p.amount !== null && go(p.amount)}
      >
        <AmountInput
          label={copy.periodAmount}
          value={p.amount}
          onChange={(amount) => set({ period: { ...p, amount } })}
          quick={quickChips.small}
          monthly
          allowZero
          zeroLink={{ label: copy.periodNoIncome, onClick: () => go(0) }}
        />
      </QuestionLayout>
    );
  }

  const past = p.start !== null && p.start < now;
  return (
    <QuestionLayout
      title={copy.periodStart}
      onBack={() => nav('/assets/money')}
      primary={{ label: copy.next, disabled: !p.start || past }}
      onSubmit={() => p.start && !past && nav(replanPath.period('end'))}
    >
      <YearMonthInput
        label={copy.periodStart}
        value={p.start}
        onChange={(start) => set({ period: { ...p, start } })}
        error={past ? copy.periodPast : undefined}
      />
    </QuestionLayout>
  );
}
