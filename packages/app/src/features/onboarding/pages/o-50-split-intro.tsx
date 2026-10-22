import { QuestionLayout } from '@sweetwo/ui';
import { OnboardingChapters } from '../chapters';
import { copy } from '../copy';
import { isSeparate } from '../flow';
import { useStep } from '../step';

// O-50 챕터 4(나누기와 플랜) 시작 안내(Q7). 뒤로 → 수입과 지출 챕터 마지막 화면
export function O50SplitIntro() {
  const s = useStep('o-50');
  if (!s.ready) return null;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={isSeparate(s.state) ? copy.part4TitleSeparate : copy.part4Title}
      help={copy.part4Help}
      onBack={s.onBack}
      primary={{ label: copy.chapterStart, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <OnboardingChapters now={3} />
    </QuestionLayout>
  );
}
