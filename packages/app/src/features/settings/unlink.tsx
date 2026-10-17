import { fetchAssets, qk } from '@sweetwo/api';
import { formatManWon, type UnlinkItem } from '@sweetwo/core';
import { ListRow } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { copy } from './copy';

// 연결 해제 요청(S-12a~c) 공통: 공동 명의 자산 목록, 고친 몫(초안), 합계 줄.
// 서버 request_unlink와 같은 대상: 공동 명의, 자산, 보유 중, 금액 0보다 큼.

/** S-12b에서 고친 내 몫(자산 id → 원). 없는 항목은 기본 몫 */
export const useUnlinkDraft = create<{
  shares: Record<string, number | null>;
  set: (id: string, v: number | null) => void;
  reset: () => void;
}>((set) => ({
  shares: {},
  set: (id, v) => set((s) => ({ shares: { ...s.shares, [id]: v } })),
  reset: () => set({ shares: {} }),
}));

export function useJointAssets() {
  const q = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const rows = (q.data ?? [])
    .filter((a) => a.owner === 'joint' && a.amount > 0)
    // 서버와 같은 순서: 자산 먼저, 부채 다음, 만든 순
    .sort(
      (a, b) =>
        a.side.localeCompare(b.side) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  return { loading: q.isLoading, rows };
}

/** 합계: 이름표는 작고 흐리게, 금액은 진하게, 두 묶음은 간격으로(S-12b 4번) */
export function UnlinkTotals({
  title,
  names,
  totals,
}: {
  title?: string;
  names: [string, string];
  totals: [number, number];
}) {
  return (
    <div className="hg-row" style={{ gap: 'var(--space-8)' }} aria-live="polite">
      {title && <span className="hg-q__help">{title}</span>}
      {names.map((n, i) => (
        <div key={n + i} className="hg-stack" style={{ gap: 'var(--space-1)' }}>
          <span className="hg-q__help">{n}</span>
          <strong>{formatManWon(totals[i] ?? 0)}</strong>
        </div>
      ))}
    </div>
  );
}

/** 보기만 하는 자산 정리 안(S-12d): 항목마다 두 사람 몫 */
export function UnlinkPlanList({ items, names }: { items: UnlinkItem[]; names: [string, string] }) {
  return (
    <div className="hg-list">
      {items.map((i) => (
        <ListRow
          key={i.assetId}
          label={i.name}
          sub={i.side === 'debt' ? copy.debtAmount(formatManWon(i.amount)) : formatManWon(i.amount)}
          value={`${names[0]} ${formatManWon(i.mine)}, ${names[1]} ${formatManWon(i.amount - i.mine)}`}
        />
      ))}
    </div>
  );
}
