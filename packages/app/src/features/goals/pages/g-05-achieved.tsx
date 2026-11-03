import { fetchGoalStory } from '@sweetwo/api';
import { celebrationStory } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { useSplits } from '../../salary';
import { AchieveArt, goalUsePath, sendPath } from '../achieve';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { useGoalsModel } from '../model';
import { freedAmount, mySplit } from '../freed';

// G-05 축하(22 G-05 축하): 큰 그림 → “목표 달성” → 목표 이름 → 모은 금액 → 함께 모은 달 문장 → “다음”.
// 다음: 달성으로 내 월급 계획에서 빠진 저금 줄이 있으면 “매달 넣던 25만 원은 어디로 보낼까요?”, 없으면 사용 기록.
// 사람마다 한 번(AchieveWatch가 엶). 합쳐서·혼자 쓰기·내 목표는 늘 “n개월 만에 모았어요”
export function G05Achieved() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useGoalsData();
  const model = useGoalsModel();
  const splits = useSplits();
  const { masked } = useMask();
  const story = useQuery({ queryKey: ['goal_story', id], queryFn: () => fetchGoalStory(id) });
  if (d.loading || model.loading || story.isLoading || splits.isLoading) return null;
  const item = model.ready ? model.byId(id) : undefined;
  const row = d.goals.find((x) => x.id === id);
  if (!item || !row) return <Navigate to="/goals" replace />;
  const g = {
    name: row.name,
    held: item.saved,
    illustration: item.illustration,
    custom: item.custom,
  };
  const joint = d.space?.salary_mode === 'joint';
  const freed = freedAmount(row.freed_lines, mySplit(splits.data, d.me?.id, joint));
  const solo = !d.couple?.joined || joint || row.owner_user_id !== null;
  const s = celebrationStory(story.data?.months ?? 0, story.data?.together ?? 0, solo);
  const line =
    s === null
      ? undefined
      : s.kind === 'all'
        ? copy.storyAll(s.months)
        : s.kind === 'some'
          ? copy.storySome(s.months, s.together)
          : copy.storySolo(s.months);
  // 2026-11-03: 카드 틀을 없애고 다른 질문 화면과 같은 QuestionLayout(가운데 배치, 주 버튼 “다음”은 아래 고정)
  const next = () =>
    nav(freed > 0 ? `${sendPath(id)}?m=${freed}` : goalUsePath(id), { replace: true });
  return (
    <QuestionLayout
      center
      hero={
        <div className="hg-celebrate__hero hg-celebrate__hero--plain" aria-hidden="true">
          <AchieveArt g={g} />
        </div>
      }
      title={
        <>
          <span className="hg-celebrate__eyebrow">{copy.achievedEyebrow}</span>
          <span className="hg-celebrate__title">{g.name}</span>
        </>
      }
      primary={{ label: copy.next }}
      onSubmit={next}
    >
      <div className="hg-celebrate__body hg-celebrate__body--plain">
        <p className="hg-celebrate__value">{money(g.held, masked)}</p>
        {line && <p className="hg-celebrate__story">{line}</p>}
      </div>
    </QuestionLayout>
  );
}
