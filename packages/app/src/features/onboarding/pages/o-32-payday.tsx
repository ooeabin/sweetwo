import { DayChips, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

type Day = number | 'last';

// O-32 월급날(Q4 일만). 1~31 + ‘말일’, 기본값 없음. 29~31일은 짧은 달에 말일로 계산.
export function O32Payday() {
  const s = useStep('o-32');
  const me = s.state.me;
  const [v, setV] = useState<Day | null | undefined>(undefined);
  if (!s.ready) return null;
  const saved: Day | null = me?.payday_last ? 'last' : (me?.payday ?? null);
  const value = v === undefined ? saved : v;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.payday}
      help={typeof value === 'number' && value >= 29 ? copy.paydayShortMonth : undefined}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: value === null, loading: s.saving }}
      onSubmit={() =>
        value !== null &&
        void s.done(() =>
          saveMe(
            value === 'last'
              ? { payday: null, payday_last: true }
              : { payday: value, payday_last: false },
          ),
        )
      }
    >
      <DayChips label={copy.payday} value={value} onChange={setV} lastLabel={copy.paydayLast} />
    </QuestionLayout>
  );
}
