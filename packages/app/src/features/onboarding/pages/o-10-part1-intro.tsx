import { QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useStep } from '../step';

// O-10 파트 1 시작 안내(Q7). 뒤로 → O-06 또는 O-07
export function O10Part1Intro() {
  const s = useStep('o-10');
  if (!s.ready) return null;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.part1Title}
      help={copy.part1Help}
      onBack={s.onBack}
      primary={{ label: copy.part1Cta }}
      onSubmit={() => void s.done()}
    />
  );
}
