import { QuestionLayout, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe, saveSpace } from '../data';
import { useJoinStep } from '../join-step';

// P-03 내 이름(Q5, O-03과 같음): 1~10자, 시작한 사람이 적어 둔 이름(또는 소셜 로그인 이름)이 채워짐. 앱 전체의 {나}.
export function P03Name() {
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
      title={copy.nameTitle}
      help={copy.nameHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !name, loading: s.saving }}
      onSubmit={() =>
        name &&
        void s.done(async () => {
          if (name === saved) return;
          await saveMe({ nickname: name });
          await saveSpace({ partner_nickname: name }); // 시작한 사람 화면의 배우자 이름
        })
      }
    >
      <ShortText
        label={copy.nameTitle}
        value={value}
        onChange={setV}
        max={10}
        placeholder={copy.namePlaceholder}
        error={!name && v !== null ? copy.nameRequired : undefined}
      />
    </QuestionLayout>
  );
}
