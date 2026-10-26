import { setJoinSalaryMode } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

type Mode = 'separate' | 'joint';

// P-04 관리 방식 확인(Q1, O-30 틀): 시작한 사람 답이 선택된 채 열림. 바꾸면 바로 둘 다에게 적용 + 시작한 사람 알림(서버).
export function P04SalaryMode() {
  const s = useJoinStep('p-04');
  const d = s.d;
  const [v, setV] = useState<Mode | null>(null);
  if (!d.ready || !d.space) return null;
  const saved: Mode = d.space.salary_mode;
  const value = v ?? saved;
  const starter = d.couple?.partnerName ?? '';
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.modeTitle(starter)}
      help={copy.modeHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, loading: s.saving }}
      onSubmit={() =>
        void s.done(() => (value === saved ? Promise.resolve() : setJoinSalaryMode(value)))
      }
    >
      <ChoiceCards<Mode>
        label={copy.modeTitle(starter)}
        value={value}
        onChange={setV}
        autoAdvance={false}
        options={(['separate', 'joint'] as const).map((k) => ({
          value: k,
          label: copy.modes[k].label,
          sub: copy.modes[k].sub,
        }))}
      />
    </QuestionLayout>
  );
}
