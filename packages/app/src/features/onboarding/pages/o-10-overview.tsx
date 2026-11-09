import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
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
            {/* 2D 안내 그림(Illustrations ‘나중 과제’ 5번)이 들어올 때까지 40px 회색 빈 원(hg-artslot, 2026-11-09 다시 붙임) */}
            <span className="hg-intro-steps__icon hg-artslot" aria-hidden="true" />
            <span>{x.text}</span>
          </li>
        ))}
      </ol>
    </QuestionLayout>
  );
}
