import { fetchCurrentPlan, fetchGoalStory, qk } from '@sweetwo/api';
import { celebrationStory, todayKst } from '@sweetwo/core';
import { Button, Celebration } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { AchieveArt, sendPath, goalUsePath } from '../achieve';
import { copy } from '../copy';
import { useGoalsData } from '../data';

// G-05 축하(22 G-05 축하): 큰 그림 → “목표 달성” → 목표 이름 → 모은 금액 → 함께 모은 달 문장 → “다음”.
// 다음: 이 목표에 매달 넣던 돈이 있으면 보낼 곳, 없으면 사용 기록. 사람마다 한 번(AchieveWatch가 엶).
export function G05Achieved() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useGoalsData();
  const { masked } = useMask();
  const story = useQuery({ queryKey: ['goal_story', id], queryFn: () => fetchGoalStory(id) });
  const today = todayKst();
  const plan = useQuery({
    queryKey: qk.currentPlan(today),
    queryFn: () => fetchCurrentPlan(today),
  });
  if (d.loading || story.isLoading || plan.isLoading) return null;
  const g = d.view?.lines.find((x) => x.id === id);
  if (!g) return <Navigate to="/goals" replace />;
  const monthly = (plan.data?.lines ?? [])
    .filter((l) => l.goal_id === id && l.target === 'goal')
    .reduce((t, l) => t + l.amount, 0);
  const s = celebrationStory(story.data?.months ?? 0, story.data?.together ?? 0, !d.couple?.joined);
  const line =
    s === null
      ? undefined
      : s.kind === 'all'
        ? copy.storyAll(s.months)
        : s.kind === 'some'
          ? copy.storySome(s.months, s.together)
          : copy.storySolo(s.months);
  return (
    <main style={{ padding: 'var(--space-10) var(--space-4)' }}>
      <Celebration
        art={<AchieveArt g={g} />}
        eyebrow={copy.achievedEyebrow}
        title={g.name}
        value={money(g.held, masked)}
        story={line}
      >
        <Button
          variant="primary"
          block
          onClick={() =>
            nav(monthly > 0 ? `${sendPath(id)}?m=${monthly}` : goalUsePath(id), { replace: true })
          }
        >
          {copy.next}
        </Button>
      </Celebration>
    </main>
  );
}
