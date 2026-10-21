import { deleteUnderageAccount } from '@sweetwo/api';
import { birthYearRange, isUnderage, manAge, ymdText } from '@sweetwo/core';
import { Button, ChoiceCards, DateWheel, QuestionLayout, type YMD } from '@sweetwo/ui';
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
  const [birth, setBirth] = useState<YMD | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  if (!d.ready || !d.me) return null;
  const savedYear = d.me.birth_year;
  const savedWork = d.me.employment;
  // 찬우가 대신 입력한 건 출생연도만이라, 월, 일이 비어 있으면 확인 대신 휠로 물음
  const savedFull =
    savedYear !== null && d.me.birth_month !== null && d.me.birth_day !== null
      ? { y: savedYear, m: d.me.birth_month, d: d.me.birth_day }
      : null;
  const filled = savedFull !== null && savedWork !== null;
  const asking = edit || !filled;
  const w = work ?? savedWork;
  const range = birthYearRange();

  const submit = async () => {
    if (birth === null || w === null) return;
    if (isUnderage(birth)) {
      try {
        await deleteUnderageAccount(ymdText(birth));
      } finally {
        await session.signOut().catch(() => undefined);
        toast(copy.adultsOnly);
        nav('/start', { replace: true });
      }
      return;
    }
    await s.done(() =>
      saveMe({ birth_year: birth.y, birth_month: birth.m, birth_day: birth.d, employment: w }),
    );
  };

  if (!asking && savedFull !== null && savedWork !== null)
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.profileTitle}
        onBack={s.onBack}
        primary={{ label: copy.right, loading: s.saving }}
        onSubmit={() => void s.done()}
      >
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.profileLineFull(savedFull.y, savedFull.m, savedFull.d, copy.works[savedWork])}
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
        disabled: birth === null || w === null,
        loading: s.saving,
      }}
      onSubmit={() => void submit()}
    >
      <DateWheel
        label={copy.birthYearLabel}
        value={birth}
        onChange={setBirth}
        minYear={range.min}
        maxYear={range.max}
        initial={
          savedYear !== null
            ? { y: savedYear, m: d.me.birth_month ?? 1, d: d.me.birth_day ?? 1 }
            : undefined
        }
      />
      {birth && (
        <p className="hg-wheel__age" aria-live="polite">
          {copy.age(Math.max(manAge(birth), 0))}
        </p>
      )}
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
