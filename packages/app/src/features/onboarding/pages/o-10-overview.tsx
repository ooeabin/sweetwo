import { ChapterList, QuestionLayout } from '@sweetwo/ui';
import { copy } from '../copy';
import { CHAPTERS } from '../flow';
import { useStep } from '../step';

// O-10 온보딩 첫 화면(Q7): 챕터 4개와 걸리는 시간. 챕터 1(우리 소개) 시작 안내를 겸함. 뒤로 없음 → O-03
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
      <ChapterList
        label={copy.overviewList}
        items={CHAPTERS.map((name, i) => ({ name, desc: copy.chapterDescs[i] ?? '' }))}
      />
    </QuestionLayout>
  );
}
