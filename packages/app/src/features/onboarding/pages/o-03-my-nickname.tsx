import { fetchSocialName } from '@sweetwo/api';
import { QuestionLayout, ShortText } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

// O-03 내 호칭(Q5). 최대 10자, 앱 전체의 {나}. 소셜 로그인 이름을 미리 채움. 뒤로 → O-10.
export function O03MyNickname() {
  const s = useStep('o-03');
  const [v, setV] = useState<string | null>(null);
  const social = useQuery({
    queryKey: ['social-name'],
    queryFn: fetchSocialName,
    staleTime: Infinity,
  });
  const value = v ?? (s.state.me?.nickname || social.data || '');
  const trimmed = value.trim();
  if (!s.ready) return null;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.myNickname}
      help={copy.myNicknameHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !trimmed, loading: s.saving }}
      onSubmit={() => void s.done(() => saveMe({ nickname: trimmed }))}
    >
      <ShortText
        label={copy.myNickname}
        value={value}
        onChange={setV}
        max={10}
        placeholder={copy.nicknamePlaceholder}
        error={value !== '' && !trimmed ? copy.nameRequired : undefined}
      />
    </QuestionLayout>
  );
}
