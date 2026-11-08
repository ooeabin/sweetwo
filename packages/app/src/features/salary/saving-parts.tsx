import { achieveGoal, qk } from '@sweetwo/api';
import { reachedTarget } from '@sweetwo/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { money } from '../../shared/mask';
import { copy } from './copy';
import { savingPaths } from './paths';
import { useSavingItems, type SavingItem } from './saving';

/** 저금 줄 아래 진행(20 W-02 4번): “2,700만 / 1억 5,000만 원” + 얇은 막대. 목표 금액이 없으면 없음 */
export function SavingMeta({ item, masked }: { item: SavingItem | undefined; masked: boolean }) {
  if (!item || item.target === null) return null;
  return (
    <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
      <span>{copy.itemProgress(money(item.saved, masked), money(item.target, masked))}</span>
      <span className="hg-goalbox__bar" style={{ display: 'block', height: 'var(--space-1)' }}>
        <i style={{ width: `${item.bar}%` }} />
      </span>
    </span>
  );
}

/**
 * 달성 지켜보기(20 W-12): 고칠 수 있는 저금 항목의 모은 돈(서버 goal_saved_sums) ≥ 목표 금액이 되면 서버에 달성 표시(achieve_goal)하고,
 * 이 사람이 처음이면 축하 화면으로. 합쳐서 모드 다른 사람은 다음에 앱을 열 때 한 번. 파트너 저금 항목(각자)은 알림만.
 * 홈과 월급 탭 화면에 붙음.
 */
export function AchieveWatch() {
  const d = useSavingItems();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tried = useRef(new Set<string>());
  const meId = d.ready ? d.meId : null;
  const items = useRef<SavingItem[] | null>(null);
  items.current = d.ready ? d.live : null;
  // 상태·모은 돈이 바뀔 때만 다시 봄
  const key = (items.current ?? [])
    .map((i) => `${i.goal.id}:${i.goal.status}:${i.saved}:${(i.goal.achieved_seen ?? []).length}`)
    .join('|');
  useEffect(() => {
    const list = items.current;
    if (!meId || !list) return;
    const next = list.find(
      (i) =>
        i.canEdit &&
        !tried.current.has(i.goal.id) &&
        (reachedTarget(i.goal, i.saved) ||
          (i.state === 'achieved' && !(i.goal.achieved_seen ?? []).includes(meId))),
    );
    if (!next) return;
    tried.current.add(next.goal.id);
    void achieveGoal(next.goal.id)
      .then(async (show) => {
        await qc.invalidateQueries({ queryKey: qk.goals });
        if (show) nav(savingPaths.achieved(next.goal.id));
      })
      .catch(() => undefined);
  }, [meId, key, nav, qc]);
  return null;
}
