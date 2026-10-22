import { fetchGoals, qk } from '@sweetwo/api';
import { ChoiceCards, ListRow, PageHeader, QuestionLayout, Toggle } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useWidgetSettings } from '../widget-settings';

// S-22 위젯(25 S-22): 트레이 아이콘(기본 켜짐, 끄면 트레이 위젯 창도 없음), 위젯에 금액 보이기(기본 꺼짐, 기기마다),
// 목표 위젯에 보일 목표(기본 = 우선순위 첫 목표, 목표가 없으면 “목표 없음” → G-03). 데스크톱만.
export function S22Widget() {
  const { step } = useParams();
  const nav = useNavigate();
  const w = useWidgetSettings();
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  if (!w.desktop) return <Navigate to="/settings" replace />;
  if (!w.settings || goals.isLoading) return <MainFrame current={null} columns={[null]} />;
  const s = w.settings;
  // 휴지통·보류·사용 완료 목표는 고를 수 없음 → 우선순위 첫 목표
  const open = (goals.data ?? [])
    .filter((g) => g.status !== 'paused' && g.status !== 'used')
    .sort((a, b) => a.priority - b.priority);
  const cur = open.find((g) => g.id === s.goalId) ?? open[0] ?? null;

  if (step === 'goal')
    return (
      <QuestionLayout title={copy.widgetGoal} onBack={() => nav('/settings/widget')}>
        <ChoiceCards<string>
          label={copy.widgetGoal}
          value={cur?.id ?? null}
          onChange={() => undefined}
          onPick={(id) =>
            void w.save({ goalId: id }).then(() => nav('/settings/widget', { replace: true }))
          }
          options={open.map((g) => ({ value: g.id, label: g.name }))}
        />
      </QuestionLayout>
    );

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.widgetTitle}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
        <Toggle
          label={copy.widgetTray}
          help={copy.widgetTrayHelp}
          checked={s.tray}
          onChange={(on) => void w.save({ tray: on })}
        />
        <Toggle
          label={copy.widgetAmounts}
          checked={s.showAmounts}
          onChange={(on) => void w.save({ showAmounts: on })}
        />
      </div>
      <div className="hg-list">
        <ListRow
          label={copy.widgetGoal}
          value={cur?.name ?? copy.widgetNoGoal}
          onClick={() => nav(cur ? '/settings/widget/goal' : '/goals/new')}
        />
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.widgetTitle }} columns={[body]} />;
}
