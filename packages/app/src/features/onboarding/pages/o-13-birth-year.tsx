import { deleteMinorAccount } from '@sweetwo/api';
import { isMinorBirthYear } from '@sweetwo/core';
import { QuestionLayout, YearInput } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

// O-13 내 출생연도(Q4 연도). 1950~(올해 − 18). 만 18세 미만이면 안내 후 계정 즉시 삭제(입력값 남기지 않음).
export function O13BirthYear() {
  const s = useStep('o-13');
  const nav = useNavigate();
  const [year, setYear] = useState<number | null>(null);
  const me = s.state.me;
  if (!s.ready) return null;
  const y = year ?? me?.birth_year ?? null;
  const error = y !== null && y < 1950 ? copy.from1950 : undefined;

  const submit = async (v: number) => {
    if (v < 1950) return;
    if (isMinorBirthYear(v)) {
      try {
        await deleteMinorAccount(v);
      } finally {
        await session.signOut().catch(() => undefined);
        toast(copy.adultsOnly);
        nav('/start', { replace: true });
      }
      return;
    }
    await s.done(() => saveMe({ birth_year: v }));
  };

  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.birthYear(me?.nickname ?? '')}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: y === null || !!error, loading: s.saving }}
      onSubmit={() => y !== null && void submit(y)}
    >
      <YearInput
        label={copy.birthYear(me?.nickname ?? '')}
        value={y}
        onChange={setYear}
        error={error}
        onComplete={(v) => void submit(v)}
      />
    </QuestionLayout>
  );
}
