import { Icon, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { copy } from '../copy';
import { useStep } from '../step';

// O-10 온보딩 첫 화면(Q7). 진행 표시·뒤로 없음 → O-03. 제목 아래 3단계 안내
export function O10Overview() {
  const s = useStep('o-10');
  if (!s.ready) return <QuestionSkeleton title={copy.overviewTitle} onBack={null} fields={0} />;
  return (
    <QuestionLayout
      title={copy.overviewTitle}
      help={copy.overviewEditable}
      primary={{ label: copy.chapterStart, loading: s.saving }}
      onSubmit={() => void s.done()}
      center
    >
      <ol className="hg-intro-steps">
        {copy.overviewSteps.map((x) => (
          <li key={x.text}>
            <span className="hg-intro-steps__icon" aria-hidden="true">
              <Icon name={x.icon} />
            </span>
            <span>{x.text}</span>
          </li>
        ))}
      </ol>
    </QuestionLayout>
  );
}
