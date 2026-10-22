import { trashGoals } from '@sweetwo/api';
import { Button, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type Status = keyof typeof copy.marriedChoices;

// O-11 결혼 상태(Q1). 준비 중 → O-19a~e. 준비 중에서 했어요로 바꾸면 결혼 준비 답과 결혼 비용 목표를 지운다(확인 뒤).
export function O11Marriage() {
  const s = useStep('o-11');
  const [confirm, setConfirm] = useState(false);
  if (!s.ready) return null;
  const sp = s.state.space;
  const hasPrep =
    sp?.marriage_status === 'engaged' &&
    (sp.wedding_budget !== null || sp.prep_money_mode !== null);

  const toMarried = () =>
    s.done(async () => {
      if (hasPrep) {
        await trashGoals(
          (s.state.goals ?? []).filter((g) => g.template === 'wedding').map((g) => g.id),
        );
        await saveSpace({
          marriage_status: 'married',
          wedding_budget: null,
          wedding_budget_estimated: false,
          family_support_answer: null,
          family_support: null,
          family_support_estimated: false,
          wedding_saved: null,
          newlywed_home: null,
          newlywed_home_month: null,
          prep_money_mode: null,
          wedding_month: null,
          wedding_date_estimated: false,
        });
      } else {
        await saveSpace({ marriage_status: 'married' });
      }
    });

  return (
    <QuestionLayout chapter={s.chapter} title={copy.married} onBack={s.onBack}>
      <ChoiceCards<Status>
        label={copy.married}
        value={sp?.marriage_status ?? null}
        onChange={() => undefined}
        onPick={(v) => {
          if (v === 'married' && hasPrep) return setConfirm(true);
          if (v === 'married') return void toMarried();
          void s.done(() => saveSpace({ marriage_status: 'engaged' }));
        }}
        options={[
          { value: 'married', label: copy.marriedChoices.married },
          { value: 'engaged', label: copy.marriedChoices.engaged, sub: copy.engagedSub },
        ]}
      />
      {confirm && (
        <div className="hg-banner hg-banner--info" role="alert">
          <span>{copy.dropPrepAnswers}</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            {copy.cancel}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void toMarried()}>
            {copy.dropConfirm}
          </Button>
        </div>
      )}
    </QuestionLayout>
  );
}
