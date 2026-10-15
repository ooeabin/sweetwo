import { deleteMinorAccount } from '@sweetwo/api';
import { isMinorBirthYear } from '@sweetwo/core';
import { Button, ChoiceCards, QuestionLayout, YearInput } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { session } from '../../auth';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useJoinStep } from '../join-step';

type Work = keyof typeof copy.works;

// P-04 출생연도·일하는 방식. 대신 입력돼 있으면 확인만(‘맞아요’ / ‘고칠게요’), 비어 있으면 묻기(O-13, O-16과 같은 규칙).
// 만 18세 미만이면 계정 삭제(O-13과 같음).
export function P04Profile() {
  const s = useJoinStep('p-04');
  const d = s.d;
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  if (!d.ready || !d.me) return null;
  const savedYear = d.me.birth_year;
  const savedWork = d.me.employment;
  const filled = savedYear !== null && savedWork !== null;
  const asking = edit || !filled;
  const y = year ?? savedYear;
  const w = work ?? savedWork;
  const yearError = y !== null && y < 1950 ? copy.from1950 : undefined;

  const submit = async () => {
    if (y === null || w === null || yearError) return;
    if (isMinorBirthYear(y)) {
      try {
        await deleteMinorAccount(y);
      } finally {
        await session.signOut().catch(() => undefined);
        toast(copy.adultsOnly);
        nav('/start', { replace: true });
      }
      return;
    }
    await s.done(() => saveMe({ birth_year: y, employment: w }));
  };

  if (!asking && savedYear !== null && savedWork !== null)
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.profileTitle}
        onBack={s.onBack}
        primary={{ label: copy.right, loading: s.saving }}
        onSubmit={() => void s.done()}
      >
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.profileLine(savedYear, copy.works[savedWork])}
        </p>
        <Button variant="secondary" onClick={() => setEdit(true)}>
          {copy.fix}
        </Button>
      </QuestionLayout>
    );

  return (
    <QuestionLayout
      steps={s.steps}
      title={filled ? copy.profileTitle : copy.profileAsk}
      onBack={s.onBack}
      primary={{
        label: copy.next,
        disabled: y === null || w === null || !!yearError,
        loading: s.saving,
      }}
      onSubmit={() => void submit()}
    >
      <YearInput label={copy.birthYearLabel} value={y} onChange={setYear} error={yearError} />
      <ChoiceCards<Work>
        label={copy.workLabel}
        value={w}
        onChange={setWork}
        autoAdvance={false}
        autoFocus={false}
        options={(Object.keys(copy.works) as Work[]).map((k) => ({
          value: k,
          label: copy.works[k],
        }))}
      />
    </QuestionLayout>
  );
}
