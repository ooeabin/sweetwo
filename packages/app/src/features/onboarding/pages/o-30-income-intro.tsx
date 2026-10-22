import { QuestionLayout } from '@sweetwo/ui';
import { OnboardingChapters } from '../chapters';
import { copy } from '../copy';
import { isSeparate } from '../flow';
import { useStep } from '../step';

// O-30 챕터 3(수입과 지출) 시작 안내(Q7). 뒤로 → 목표 챕터 마지막 화면
export function O30IncomeIntro() {
  const s = useStep('o-30');
  if (!s.ready) return null;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.part3Title}
      help={isSeparate(s.state) ? copy.part3HelpSeparate : copy.part3Help}
      onBack={s.onBack}
      primary={{ label: copy.chapterStart, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <OnboardingChapters now={2} />
    </QuestionLayout>
  );
}
