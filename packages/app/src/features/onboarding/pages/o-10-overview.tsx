import { QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { useStep } from '../step';

// O-10 온보딩 첫 화면(Q7). 진행 표시·뒤로 없음 → O-03
export function O10Overview() {
  const s = useStep('o-10');
  if (!s.ready) return null;
  return (
    <QuestionLayout
      title={copy.overviewTitle}
      help={copy.overviewHelp}
      primary={{ label: copy.chapterStart, loading: s.saving }}
      onSubmit={() => void s.done()}
    >
      <p className="hg-help">{copy.overviewEditable}</p>
    </QuestionLayout>
  );
}
