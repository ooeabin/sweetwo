import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

type Mode = keyof typeof copy.salaryModes;

// O-30 월급 관리 방식(Q1, 17 온보딩 ②). 기본 각자, ‘다음’으로 넘어감(고정 예외: Q1인데 다음 버튼).
// 각자 = 분배표와 체크리스트가 사람마다, 합쳐서 = 둘의 월급을 한 분배표로. 설정 S-11f에서 바꿈.
export function O30SalaryMode() {
  const s = useStep('o-30');
  const [v, setV] = useState<Mode | null>(null);
  if (!s.ready) return null;
  const value: Mode = v ?? s.state.space?.salary_mode ?? 'separate';
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salaryMode}
      help={copy.salaryModeHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, loading: s.saving }}
      onSubmit={() => void s.done(() => saveSpace({ salary_mode: value }))}
    >
      <ChoiceCards<Mode>
        label={copy.salaryMode}
        value={value}
        onChange={setV}
        autoAdvance={false}
        options={(['separate', 'joint'] as const).map((k) => ({
          value: k,
          label: copy.salaryModes[k].label,
          sub: copy.salaryModes[k].sub,
        }))}
      />
    </QuestionLayout>
  );
}
