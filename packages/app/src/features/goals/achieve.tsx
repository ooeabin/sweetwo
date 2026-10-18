import { achieveGoal, qk } from '@sweetwo/api';
import { Icon, Illustration } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoalsData } from './data';
import type { GoalLine } from './view';

export const achievedPath = (id: string) => `/goals/${id}/achieved`;
export const sendPath = (id: string) => `/goals/${id}/achieved/send`;
export const goalUsePath = (id: string) => `/goals/${id}/use`;

/** 달성 축하가 필요한 목표(한 번 모으는 목표, 결혼 비용 제외). 결혼 비용 달성은 결혼일 전환(H-T2) */
export const canAchieve = (g: Pick<GoalLine, 'kind' | 'template'>) =>
  g.kind === 'once' && g.template !== 'wedding';

// 달성 지켜보기(22 G-05 축하): 보유액 ≥ 목표 금액이 된 목표를 서버에 달성으로 표시하고, 이 사람이 처음이면 축하 화면으로.
// 이번 달, 목표 목록·상세에 붙음. 배우자는 다음에 앱을 열 때 한 번.
export function AchieveWatch() {
  const d = useGoalsData();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tried = useRef(new Set<string>());
  const me = d.me;
  const lines = d.view?.lines;
  useEffect(() => {
    if (!me || !lines) return;
    const next = lines.find((l) => {
      const row = d.goals.find((g) => g.id === l.id);
      if (!row || !canAchieve(l) || l.status !== 'achieved' || tried.current.has(l.id))
        return false;
      return (
        row.status === 'active' ||
        row.status === 'delayed' ||
        (row.status === 'achieved' && !(row.achieved_seen ?? []).includes(me.id))
      );
    });
    if (!next) return;
    tried.current.add(next.id);
    void achieveGoal(next.id)
      .then(async (show) => {
        await qc.invalidateQueries({ queryKey: qk.goals });
        if (show) nav(achievedPath(next.id));
      })
      .catch(() => undefined);
  }, [me, lines, d.goals, nav, qc]);
  return null;
}

/** 축하 그림: 템플릿 그림, 직접 만든 목표는 회색 기본 그림 */
export function AchieveArt({ g }: { g: Pick<GoalLine, 'illustration' | 'custom'> }) {
  return g.illustration && !g.custom ? (
    <Illustration name={g.illustration} />
  ) : (
    <span
      className="hg-art hg-art--custom"
      style={{ width: 'calc(var(--space-16) * 3)', height: 'calc(var(--space-16) * 3)' }}
    >
      <Icon name="flag-pennant" />
    </span>
  );
}
