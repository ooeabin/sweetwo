import { Button, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

// O-05 배우자 호칭(Q5). 앱 전체의 {배우자}, 합류 후 배우자가 수정 가능. 내 호칭과 같으면 한 번 확인.
export function O05PartnerNickname() {
  const s = useStep('o-05');
  const [v, setV] = useState<string | null>(null);
  const [confirmSame, setConfirmSame] = useState(false);
  const value = v ?? s.state.space?.partner_nickname ?? '';
  const trimmed = value.trim();
  if (!s.ready) return null;
  const save = () => s.done(() => saveSpace({ partner_nickname: trimmed }));
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.partnerNickname}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !trimmed, loading: s.saving }}
      onSubmit={() => {
        if (trimmed === s.state.me?.nickname && !confirmSame) return setConfirmSame(true);
        void save();
      }}
    >
      <ShortText
        label={copy.partnerNickname}
        value={value}
        onChange={(x) => {
          setV(x);
          setConfirmSame(false);
        }}
        max={10}
        placeholder={copy.partnerPlaceholder}
        error={value !== '' && !trimmed ? copy.nameRequired : undefined}
      />
      {confirmSame && (
        <div className="hg-banner hg-banner--info" role="alert">
          <span>{copy.sameNickname}</span>
          <Button variant="secondary" size="sm" onClick={() => void save()}>
            {copy.next}
          </Button>
        </div>
      )}
    </QuestionLayout>
  );
}
