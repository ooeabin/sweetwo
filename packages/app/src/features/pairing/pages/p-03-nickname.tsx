import { QuestionLayout, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe, saveSpace } from '../data';
import { useJoinStep } from '../join-step';

// P-03 호칭 확인(Q5). 시작한 사람이 O-05에 적은 호칭이 채워져 있음, 1~10자. 고치면 양쪽 화면 호칭이 바뀜.
export function P03Nickname() {
  const s = useJoinStep('p-03');
  const d = s.d;
  const [v, setV] = useState<string | null>(null);
  if (!d.ready || !d.me) return null;
  const saved = d.me.nickname ?? '';
  const value = v ?? saved;
  const name = value.trim();
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.nicknameOk(saved)}
      primary={{ label: copy.right, disabled: !name, loading: s.saving }}
      onSubmit={() =>
        name &&
        void s.done(async () => {
          if (name === saved) return;
          await saveMe({ nickname: name });
          await saveSpace({ partner_nickname: name }); // 시작한 사람 화면의 배우자 호칭
        })
      }
    >
      <ShortText
        label={copy.nicknameLabel}
        value={value}
        onChange={setV}
        max={10}
        error={!name && v !== null ? copy.nameRequired : undefined}
      />
    </QuestionLayout>
  );
}
