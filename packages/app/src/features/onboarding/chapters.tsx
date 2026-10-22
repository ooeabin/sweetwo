import { ChapterList } from '@sweetwo/ui';
import { copy } from './copy';
import { CHAPTERS } from './flow';

/** 챕터 4개 목록. O-10은 now 없이, 챕터 시작 안내(O-20·O-30·O-50)는 지금 챕터 순서(0부터) */
export function OnboardingChapters({ now }: { now?: number }) {
  return (
    <ChapterList
      label={copy.overviewList}
      now={now}
      items={CHAPTERS.map((name, i) => ({ name, desc: copy.chapterDescs[i] ?? '' }))}
    />
  );
}
