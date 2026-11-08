import { ChoiceCards, ListRow, PageHeader, QuestionLayout, Toggle } from '@sweetwo/ui';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { LoadingFrame, MainFrame } from '../../frame';
import { savingPaths, useSavingItems } from '../../salary';
import { copy } from '../copy';
import { useWidgetSettings } from '../widget-settings';

// S-22 위젯(25 S-22): 트레이 아이콘(기본 켜짐, 끄면 트레이 위젯 창도 없음), 위젯에 금액 보이기(기본 꺼짐, 기기마다),
// 위젯에 보일 저금 항목(목표 금액이 있는 것, 기본 = 홈 H-02 순서 첫 항목, 없으면 “저금 항목 없음” → W-11a, ADR 0007). 데스크톱만.
export function S22Widget() {
  const { step } = useParams();
  const nav = useNavigate();
  const w = useWidgetSettings();
  const items = useSavingItems();
  if (!w.desktop) return <Navigate to="/settings" replace />;
  if (!w.settings || !items.ready) return <LoadingFrame sub="settings" current={null} />;
  const s = w.settings;
  // 휴지통·그만 모은 항목은 고를 수 없음 → 첫 항목
  const open = items.withTarget.map((i) => i.goal);
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
          onClick={() => nav(cur ? '/settings/widget/goal' : `${savingPaths.add}/a`)}
        />
      </div>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
