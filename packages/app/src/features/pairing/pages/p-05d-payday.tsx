import { DayChips, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

type Day = number | 'last';

// P-05 월급날(Q4 일만, O-32와 같음). 기본 기준일 = 두 월급날 중 늦은 날(이번 달 계산이 따라감).
export function P05dPayday() {
  const s = useJoinStep('p-05d');
  const d = s.d;
  const [v, setV] = useState<Day | null | undefined>(undefined);
  if (!d.ready || !d.me) return null;
  const saved: Day | null = d.me.payday_last ? 'last' : (d.me.payday ?? null);
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
