import { fetchAssets, qk } from '@sweetwo/api';
import { daysBetween, formatManWon, todayKst, type UnlinkItem } from '@sweetwo/core';
import { AmountInput, ListRow } from '@sweetwo/ui';
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

export type ShareRow = {
  id: string;
  name: string;
  side: 'asset' | 'debt';
  amount: number;
  /** 고치기 전 내 몫 */
  base: number;
};

/** 항목마다 지금 내 몫(초안 반영). null = 빈 칸 */
export function sharesOf(rows: ShareRow[], draft: Record<string, number | null>) {
  return rows.map((r) => ({ ...r, mine: r.id in draft ? (draft[r.id] ?? null) : r.base }));
}

/** 하나라도 비었거나 금액보다 크면 보낼 수 없음 */
export const sharesBad = (rows: ReturnType<typeof sharesOf>) =>
  rows.some((i) => i.mine === null || i.mine > i.amount);

/** S-12b·S-12e 몫 편집: 항목마다 내 몫 금액 칸(0 ~ 금액), 상대 몫 자동, 합계(자산, 부채 따로) 바로 갱신 */
export function ShareEditor({
  rows,
  names,
  onChange,
}: {
  rows: ReturnType<typeof sharesOf>;
  names: [string, string];
  onChange: (id: string, v: number | null) => void;
}) {
  const sum = (side: 'asset' | 'debt'): [number, number] => {
    const xs = rows.filter((i) => i.side === side);
    const mine = xs.reduce((t, i) => t + Math.min(i.mine ?? 0, i.amount), 0);
    return [mine, xs.reduce((t, i) => t + i.amount, 0) - mine];
  };
  const hasDebt = rows.some((i) => i.side === 'debt');
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      {rows.map((i) => (
        <div key={i.id} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <p>
            <strong>{i.name}</strong>{' '}
            <span className="hg-q__help">
              {i.side === 'debt' ? copy.debtAmount(formatManWon(i.amount)) : formatManWon(i.amount)}
            </span>
          </p>
          <AmountInput
            label={copy.myShare(i.name)}
            value={i.mine}
            onChange={(v) => onChange(i.id, v)}
            allowZero
            embedded
          />
          {i.mine !== null && i.mine > i.amount ? (
            <p className="hg-help is-error" role="alert">
              {copy.shareOver}
            </p>
          ) : (
            <p className="hg-q__help">
              {copy.theirShare(names[1], formatManWon(i.amount - (i.mine ?? 0)))}
            </p>
          )}
        </div>
      ))}
      <UnlinkTotals
        title={hasDebt ? copy.assetsTotal : undefined}
        names={names}
        totals={sum('asset')}
      />
      {hasDebt && <UnlinkTotals title={copy.debtsTotal} names={names} totals={sum('debt')} />}
    </div>
  );
}

/** 요청부터 오늘까지 날 수(분석 days_pending). 값이 깨졌으면 0 */
export function daysPending(requestedAt: string): number {
  const t = Date.parse(requestedAt);
  return Number.isNaN(t) ? 0 : Math.max(0, daysBetween(todayKst(new Date(t)), todayKst()));
}
