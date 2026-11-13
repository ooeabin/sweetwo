import { Checkbox, DayWheel, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

type Day = number | 'last';

// P-05b 월급날(18, O-32와 같음, 2026-11-03 P-05에서 나눔). 저장 → 관리하지 않는 쪽이면 P-05c 용돈, 아니면 추천 월급 계획으로
// 합류 완료 → P-10. 같이 계열이고 시작한 사람이 아직 온보딩 중이면 합류만(홈 대기).
// 2026-11-13 v2.2: ‘매달 금액이 달라요’면 휠 아래 ‘날짜가 정해져 있지 않아요’(O-32와 같음, 확인 목록 없음)
export function P05bPayday() {
  const s = useJoinStep('p-05b');
  const me = s.d.me;
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [none, setNone] = useState<boolean | undefined>(undefined);
  if (!s.d.ready || !me)
    return (
      <QuestionSkeleton title={copy.paydayTitle} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
  const saved: Day | null = me.payday_last ? 'last' : (me.payday ?? null);
  const payday = day === undefined ? saved : day;
  const variable = !!me.income_variable;
  const noDate = variable && (none ?? !!me.payday_none);
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.paydayTitle}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !noDate && payday === null, loading: s.saving }}
      onSubmit={() =>
        (noDate || payday !== null) &&
        void s.done(() =>
          saveMe(
            noDate
              ? { payday: null, payday_last: false, payday_none: true }
              : {
                  payday: typeof payday === 'number' ? payday : null,
                  payday_last: payday === 'last',
                  payday_none: false,
                },
          ),
        )
      }
    >
      <DayWheel
        label={copy.paydayTitle}
        value={payday}
        onChange={(d) => {
          setDay(d);
          setNone(false);
        }}
        lastLabel={copy.paydayLast}
        hint={copy.paydayLastHint}
      />
      {variable && <Checkbox label={copy.paydayNone} checked={noDate} onChange={setNone} />}
    </QuestionLayout>
  );
}
