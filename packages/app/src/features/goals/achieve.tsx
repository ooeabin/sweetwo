import { achieveGoal, qk } from '@sweetwo/api';
import { Icon, Illustration } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoalsModel, type GoalItem } from './model';

export const achievedPath = (id: string) => `/goals/${id}/achieved`;
export const sendPath = (id: string) => `/goals/${id}/achieved/send`;
export const goalUsePath = (id: string) => `/goals/${id}/use`;

/** 달성 축하가 필요한 목표(한 번 모으는 목표, 결혼 비용 제외). 결혼 비용 달성은 결혼일 전환(H-T2) */
export const canAchieve = (g: { kind: string; template: string }) =>
  g.kind === 'once' && g.template !== 'wedding';

// 달성 지켜보기(22 G-05 축하): 모은 돈(서버 goal_saved_sums: 이미 모은 돈 + 체크한 저금 + 넣기 − 빼기 − 꺼내 쓰기) ≥ 목표 금액이 된
// 한 번 목표를 서버에 달성으로 표시하고, 이 사람이 처음이면 축하 화면으로. 홈·목표 목록·상세에 붙음. 배우자는 다음에 앱을 열 때 한 번.
export function AchieveWatch() {
  const d = useGoalsModel();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tried = useRef(new Set<string>());
  const meId = d.ready ? d.meId : null;
  const items = useRef<GoalItem[] | null>(null);
  items.current = d.ready ? [...d.groups.ours, ...d.groups.mine, ...d.folded] : null;
  // 목표 상태·모은 돈이 바뀔 때만 다시 봄
  const key = (items.current ?? [])
    .map((i) => `${i.goal.id}:${i.goal.status}:${i.saved}:${(i.goal.achieved_seen ?? []).length}`)
    .join('|');
  useEffect(() => {
    const list = items.current;
    if (!meId || !list) return;
    const next = list.find(({ goal: g, saved }) => {
      if (!canAchieve(g) || tried.current.has(g.id) || g.target_amount === null) return false;
      if (g.owner_user_id !== null && g.owner_user_id !== meId) return false;
      return (
        ((g.status === 'active' || g.status === 'delayed') && saved >= g.target_amount) ||
        (g.status === 'achieved' && !(g.achieved_seen ?? []).includes(meId))
      );
    });
    if (!next) return;
    tried.current.add(next.goal.id);
    void achieveGoal(next.goal.id)
      .then(async (show) => {
        await qc.invalidateQueries({ queryKey: qk.goals });
        if (show) nav(achievedPath(next.goal.id));
      })
      .catch(() => undefined);
  }, [meId, key, nav, qc]);
  return null;
}

/** 축하 그림: 템플릿 그림, 직접 만든 목표는 회색 기본 그림 */
export function AchieveArt({ g }: { g: { illustration: string | null; custom: boolean } }) {
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
