import { achieveGoal, qk } from '@sweetwo/api';
import { reachedTarget } from '@sweetwo/core';
import { Badge, Lead, ListRow } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../shared/mask';
import { hideToast } from '../../shared/toast';
import { copy } from './copy';
import { savingPaths } from './paths';
import { useFirstSaving, useSavingItems, type SavingItem } from './saving';

/**
 * 저금 항목 줄(GoalRow, 홈 H-02와 저금 목록 W-13): 저금통 + 이름(파트너 항목은 이름 칩) + 오른쪽 %(달성이면 ‘달성’ 배지)
 * + “2,700만 / 1억 5,000만 원” + 얇은 막대. 목표 금액이 없으면(W-13만) % 자리 비우고 “모은 돈 300만 원”, 막대 없음.
 */
export function SavingGoalRow({
  item: i,
  masked,
  onClick,
}: {
  item: SavingItem;
  masked: boolean;
  onClick: () => void;
}) {
  const m = (v: number) => money(v, masked);
  return (
    <button type="button" className="hg-goalrow" onClick={onClick}>
      <Lead icon="piggy-bank" />
      <span className="hg-goalrow__name">
        {i.goal.name}
        {i.owner === 'partner' && i.ownerName && <Badge kind="temp">{i.ownerName}</Badge>}
      </span>
      <span className="hg-goalrow__pct">
        {i.target === null ? null : i.state === 'achieved' ? (
          <Badge kind="achieved">{copy.achieved}</Badge>
        ) : (
          <>
            {i.pct ?? 0}
            <small>%</small>
          </>
        )}
      </span>
      <span className="hg-goalrow__sub">
        {i.target === null
          ? copy.listSaved(m(i.saved))
          : copy.itemProgress(m(i.saved), m(i.target))}
      </span>
      {i.target !== null && i.state !== 'achieved' && (
        <span className="hg-goalrow__bar" aria-hidden="true">
          <i style={{ width: `${i.bar}%` }} />
        </span>
      )}
    </button>
  );
}

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
 * 첫 저금 빈 줄(2026-11-09, 20 ‘첫 저금’): 내 저금이 없을 때 체크리스트 저금 묶음 자리에 “+ 저금 추가 (남는 돈 {n})” → W-11a.
 * 파트너가 저금이 있으면(각자) 제목 “{파트너}님처럼 나도 모을 곳을 만들어 볼까요?” + 보조 “남는 돈 {n}”.
 * 홈 H-03과 W-02에서 씀(H-02 회색 제안 문장 대신). 보여 줄 때가 아니면 null
 */
export function FirstSavingRow({
  from,
  go,
}: {
  from: 'home' | 'salary';
  go: (to: string) => void;
}) {
  const f = useFirstSaving();
  const { masked } = useMask();
  if (!f.show) return null;
  const left = money(f.left, masked);
  return (
    <div className="hg-list">
      <ListRow
        icon="plus"
        label={f.partnerName ? copy.firstSavingLike(f.partnerName) : copy.firstSaving(left)}
        sub={f.partnerName ? copy.firstSavingLeft(left) : undefined}
        chevron={false}
        onClick={() => go(`${savingPaths.add}/a?from=${from}`)}
      />
    </div>
  );
}

/**
 * 달성 지켜보기(20 W-12): 고칠 수 있는 저금 항목의 모은 돈(서버 goal_saved_sums) ≥ 목표 금액이 되면 서버에 달성 표시(achieve_goal)하고,
 * 이 사람이 처음이면 축하 화면으로. 합쳐서 모드 다른 사람은 다음에 앱을 열 때 한 번. 파트너 저금 항목(각자)은 알림만.
 * 홈과 월급 탭 화면에 붙음. 축하로 넘어갈 때 떠 있는 토스트(체크 ‘되돌리기’)를 닫음. 그 전에 되돌리거나
 * 다른 곳에서 체크를 풀어 모은 돈이 목표 금액 아래로 내려가면 서버(check_pay_line)가 달성을 되돌림.
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
    // 체크를 풀어 목표 금액 아래로 내려가면 서버가 ‘모으는 중’으로 되돌림(2026-11-09). 다시 닿으면 또 축하
    for (const i of list)
      if (i.state === 'saving' && !reachedTarget(i.goal, i.saved)) tried.current.delete(i.goal.id);
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
        if (!show) return;
        // 축하 화면 위에 체크 ‘되돌리기’ 토스트가 남지 않게 닫고 넘어감(2026-11-09)
        hideToast(1500);
        nav(savingPaths.achieved(next.goal.id));
      })
      .catch(() => undefined);
  }, [meId, key, nav, qc]);
  return null;
}
