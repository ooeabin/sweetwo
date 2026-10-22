import { deleteUnderageAccount } from '@sweetwo/api';
import { birthYearRange, isUnderage, manAge, ymdText } from '@sweetwo/core';
import { DateWheel, QuestionLayout, type YMD } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

// O-13 내 생년월일(연, 월, 일 3열 휠). 1950년 ~ (올해 − 18)년. 만 18세 미만이면 안내 후 계정 즉시 삭제(입력값 남기지 않음).
// 처음 위치는 저장된 값, 없으면 출생연도만 있으면 그 해 1월 1일, 둘 다 없으면 올해 − 30년 1월 1일.
export function O13BirthYear() {
  const s = useStep('o-13');
  const nav = useNavigate();
  const [b, setB] = useState<YMD | null>(null);
  const me = s.state.me;
  if (!s.ready) return null;
  const saved: YMD | undefined = me?.birth_year
    ? { y: me.birth_year, m: me.birth_month ?? 1, d: me.birth_day ?? 1 }
    : undefined;
  const title = copy.birthYear(me?.nickname ?? '');
  const range = birthYearRange();

  const submit = async () => {
    if (!b) return;
    if (isUnderage(b)) {
      try {
        await deleteUnderageAccount(ymdText(b));
      } finally {
        await session.signOut().catch(() => undefined);
        toast(copy.adultsOnly);
        nav('/start', { replace: true });
      }
      return;
    }
    await s.done(() => saveMe({ birth_year: b.y, birth_month: b.m, birth_day: b.d }));
  };

  return (
    <QuestionLayout
      chapter={s.chapter}
      title={title}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !b, loading: s.saving }}
      onSubmit={() => void submit()}
    >
      <DateWheel
        label={title}
        value={b}
        onChange={setB}
        minYear={range.min}
        maxYear={range.max}
        initial={saved}
      />
      {b && (
        <p className="hg-wheel__age" aria-live="polite">
          {copy.age(Math.max(manAge(b), 0))}
        </p>
      )}
    </QuestionLayout>
  );
}
