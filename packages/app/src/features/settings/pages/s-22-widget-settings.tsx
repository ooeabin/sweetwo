import { qk, updateMe } from '@sweetwo/api';
import { formatWon } from '@sweetwo/core';
import { PageHeader, SegChoice, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { useWidgetSettings, widgetSettingsAvailable } from '../../../shared/widget-settings';
import { LoadingFrame, MainFrame } from '../../frame';
import { useSavingItems } from '../../salary';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-22 위젯 설정(25 S-22, 26 위젯 v2.2): ‘위젯에 금액 보이기’(기기마다, 기본 끔, 브리지 window.sweetwo.widget.settings가 이 기기에 저장)
// + ‘위젯에 보일 저축·투자’(계정마다 app_user.widget_goal_id, 기본 = 대표 저금). 목표 금액이 있는 저금 항목만 고름
// (묶음에 든 항목·상대 ‘했어요만’ 저금은 목록에 없음). 모바일 앱(위젯 브리지)에서만 열림.
export function S22WidgetSettings() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const saving = useSavingItems();
  const widget = useWidgetSettings();
  if (!widgetSettingsAvailable()) return <Navigate to="/settings" replace />;
  if (d.loading || !d.me || !saving.ready || widget.value === null)
    return <LoadingFrame sub="settings" current={null} />;
  const me = d.me;
  const choices = saving.live.filter(
    (i) => !i.private && !i.goal.bundle_id && i.target !== null && i.target > 0,
  );
  // 고른 항목이 목록에 없으면(휴지통·그만 모음·목표 금액 지움) 기본으로 보임
  const picked = choices.find((i) => i.goal.id === me.widget_goal_id)?.goal.id ?? '';
  const pick = async (v: string) => {
    if (v === picked) return;
    try {
      await updateMe({ widget_goal_id: v === '' ? null : v });
      await qc.invalidateQueries({ queryKey: qk.me });
      track('widget_setting_changed', { setting: 'goal', choice: v === '' ? 'default' : 'picked' });
      toast(copy.widgetGoalSaved);
    } catch {
      toast(copy.failed);
    }
  };
  const body = (
    <div className="hg-stack">
      <PageHeader
        title={copy.widgetsTitle}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <Toggle
          label={copy.widgetAmounts}
          help={copy.widgetAmountsHelp}
          checked={widget.value.showAmounts}
          onChange={(on) =>
            widget
              .save({ showAmounts: on })
              .then(() => track('widget_setting_changed', { setting: 'amounts', on }))
              .catch(() => toast(copy.failed))
          }
        />
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.widgetGoal} />
        {choices.length === 0 ? (
          <p className="hg-help">{copy.widgetGoalNone}</p>
        ) : (
          <SegChoice<string>
            label={copy.widgetGoal}
            value={picked}
            onChange={(v) => void pick(v)}
            variant="rows"
            items={[
              { value: '', label: copy.widgetGoalDefault, sub: copy.widgetGoalDefaultSub },
              ...choices.map((i) => ({
                value: i.goal.id,
                label: i.goal.name,
                sub: copy.widgetGoalTarget(formatWon(i.target ?? 0)),
              })),
            ]}
          />
        )}
      </section>
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
