import { fetchGoalStory } from '@sweetwo/api';
import { celebrationStory } from '@sweetwo/core';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems } from '../saving';

// W-12 달성 축하(20): 축하 그림(DoneMark celebrate, 그림 파일이 생기기 전까지 빈 자리) → “다 모았어요” → 이름 → 모은 돈
// → 함께 모은 달 문장 → “다음”(→ W-12a). 사람마다 한 번(AchieveWatch가 엶)
export function W12SavingAchieved() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useSavingItems();
  const { masked } = useMask();
  const story = useQuery({ queryKey: ['goal_story', id], queryFn: () => fetchGoalStory(id) });
  const i = d.ready ? d.byId(id) : undefined;
  const months = story.data?.months ?? 0;
  useEffect(() => {
    if (i && story.isSuccess) track('saving_item_achieved', { months_taken: months });
  }, [i?.goal.id, story.isSuccess, months]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d.ready || story.isLoading) return <QuestionSkeleton />;
  if (!i) return <Navigate to={salaryPaths.checklist} replace />;
  // 합쳐서 모드에서 두 사람이 모두 체크한 달(서버 goal_story)이 없으면 늘 “n개월 만에 모았어요”
  const s = celebrationStory(months, story.data?.together ?? 0, !d.joined || i.owner !== 'ours');
  const line =
    s === null
      ? undefined
      : s.kind === 'all'
        ? copy.storyAll(s.months)
        : s.kind === 'some'
          ? copy.storySome(s.months, s.together)
          : copy.storySolo(s.months);
  return (
    <QuestionLayout
      center
      hero={<DoneMark art="celebrate" />}
      title={
        <>
          <span className="hg-celebrate__eyebrow">{copy.achievedEyebrow}</span>
          <span className="hg-celebrate__title">{i.goal.name}</span>
        </>
      }
      primary={{ label: copy.next }}
      onSubmit={() =>
        nav(i.canEdit ? savingPaths.after(id) : savingPaths.item(id), { replace: true })
      }
    >
      <div className="hg-celebrate__body hg-celebrate__body--plain">
        <p className="hg-celebrate__value">{money(i.saved, masked)}</p>
        {line && <p className="hg-celebrate__story">{line}</p>}
      </div>
    </QuestionLayout>
  );
}
