import { fetchSocialName } from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton, ShortText } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { saveMe } from '../data';
import { useStep } from '../step';

// O-03 내 이름(Q5). 온보딩 첫 화면(2026-11-10 O-10을 뺌): 뒤로 없음. 보이는 글자 10자(서버는 코드 포인트 40), 앱 전체의 {나}.
// 소셜 로그인 이름을 미리 채움
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
  if (!s.ready)
    return (
      <QuestionSkeleton title={copy.myNickname} chapter={s.chapter} onBack={s.onBack ?? null} />
    );
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
        codeMax={40}
        placeholder={copy.nicknamePlaceholder}
        error={value !== '' && !trimmed ? copy.nameRequired : undefined}
      />
    </QuestionLayout>
  );
}
