import type { Asset } from '@sweetwo/api';
import {
  assetGroupsOf,
  daysBetween,
  formatDot,
  investSummary,
  todayKst,
  type AssetSide,
} from '@sweetwo/core';
import { Badge, Button, Chip, Icon, ListRow, SectionHeader, Tabs } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { ownerOf, useAssetsData } from '../data';

const STALE_DAYS = 92; // 3개월 넘게 안 고친 줄 → “금액이 맞나요?”

type SortKey = 'name' | 'owner' | 'amount' | 'updated';
interface Sort {
  key: SortKey;
  asc: boolean;
}
const SORTS: SortKey[] = ['name', 'owner', 'amount', 'updated'];
// 처음 누르면: 글자는 가나다순, 금액·수정일은 큰·최근 순
const FIRST_ASC: Record<SortKey, boolean> = {
  name: true,
  owner: true,
  amount: false,
  updated: false,
};
const SORT_KEY = 'sweetwo.asset-sort';
const DEFAULT_SORT: Sort = { key: 'amount', asc: false };
const readSort = (): Sort => {
  try {
    const [key, dir] = (localStorage.getItem(SORT_KEY) ?? '').split(':');
    const k = SORTS.find((x) => x === key);
    return k ? { key: k, asc: dir === 'asc' } : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
};
const saveSort = (s: Sort) => {
  try {
    localStorage.setItem(SORT_KEY, `${s.key}:${s.asc ? 'asc' : 'desc'}`);
  } catch {
    /* 이번 화면에만 */
  }
};

// F-02 자산·부채 목록(23 F-02 7~11·13·14번): 자산·부채 전환(탭마다 합계), 묶음(F-03a 그룹) 안 금액 큰 순,
// 줄 = 이름(+ 공개 범위, 대신 입력) / 명의, 수정일 / 금액. 배우자 ‘합계만’은 묶음별 한 줄(누를 수 없음).
// 배지: 공개 범위(내 항목), 대신 입력. 통장 역할·목표 연결은 재기획으로 없앰. 정렬 칩(이름, 명의, 금액, 수정일)은 묶음 안에서, 기기에 기억.
// 투자 묶음 줄 = 투자 비중(총자산 대비) / 허용 비중(투자 원칙 O-53, 답이 있을 때) + 손익(원금 있는 항목).
export function F02Items() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const side: AssetSide = params.get('side') === 'debt' ? 'debt' : 'asset';
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const today = todayKst();
  const [sort, setSort] = useState<Sort>(readSort);
  const pickSort = (key: SortKey) => {
    const next = { key, asc: sort.key === key ? !sort.asc : FIRST_ASC[key] };
    setSort(next);
    saveSort(next);
  };
  const ko = new Intl.Collator('ko');
  const cmp = (a: Asset, b: Asset) => {
    const v =
      sort.key === 'name'
        ? ko.compare(a.name, b.name)
        : sort.key === 'owner'
          ? ko.compare(ownerOf(a, d).name, ownerOf(b, d).name)
          : sort.key === 'amount'
            ? a.amount - b.amount
            : a.updated_at.localeCompare(b.updated_at);
    return (sort.asc ? v : -v) || b.amount - a.amount;
  };
  const inv = investSummary(d.items, d.sums);

  const items = d.items.filter((a) => a.side === side);
  const sums = d.sums.filter((s) => s.side === side);
  const groups = assetGroupsOf(side)
    .map((g) => ({
      g,
      rows: items.filter((a) => a.grp === g.key).sort(cmp),
      partner: sums.find((s) => s.grp === g.key),
    }))
    .filter((x) => x.rows.length || x.partner);
  const total = (s: AssetSide) => (s === 'asset' ? d.nw.assets : d.nw.debts);
  const sideName = side === 'asset' ? copy.assetsLabel : copy.debtsLabel;

  const row = (a: Asset) => {
    const o = ownerOf(a, d);
    const mine = a.owner_user_id === d.me?.id;
    const updated = todayKst(new Date(a.updated_at)); // KST 날짜
    const stale = daysBetween(updated, today) > STALE_DAYS;
    return (
      <ListRow
        key={a.id}
        label={
          <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
            {a.name}
            {mine && a.visibility !== 'all' && <Badge kind="temp">{copy.vis[a.visibility]}</Badge>}
            {o.proxy && <Badge kind="temp">{copy.proxy}</Badge>}
          </span>
        }
        sub={stale ? copy.checkAmount : `${o.name}, ${copy.updated(formatDot(updated))}`}
        value={m(a.amount)}
        onClick={() => nav(`/assets/${a.id}`)}
      />
    );
  };

  return (
    <AssetsFrame tab="items" addSide={side}>
      <Tabs<AssetSide>
        variant="seg"
        label={copy.sideLabel}
        value={side}
        onChange={(s) => setParams({ side: s }, { replace: true })}
        items={[
          { value: 'asset', label: copy.assets(m(total('asset'))) },
          { value: 'debt', label: copy.debts(m(total('debt'))) },
        ]}
      />
      {!d.loading && !groups.length && (
        <div className="hg-card hg-stack">
          <p className="hg-card__meta">{side === 'debt' ? copy.noDebt : copy.empty}</p>
          <Button
            variant="secondary"
            onClick={() => nav(`/assets/new?side=${side}`)}
            style={{ alignSelf: 'flex-start' }}
          >
            {side === 'debt' ? copy.addDebt : copy.add}
          </Button>
        </div>
      )}
      {groups.length > 0 && (
        <div
          className="hg-row"
          role="group"
          aria-label={copy.sortLabel}
          style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}
        >
          {SORTS.map((k) => {
            const on = sort.key === k;
            return (
              <Chip
                key={k}
                small
                selected={on}
                aria-label={on ? copy.sortDir(copy.sorts[k], sort.asc) : copy.sorts[k]}
                onClick={() => pickSort(k)}
              >
                {copy.sorts[k]}
                {on && <Icon name={sort.asc ? 'chevron-up' : 'chevron-down'} size={16} />}
              </Chip>
            );
          })}
        </div>
      )}
      {groups.map(({ g, rows, partner }) => (
        <section key={g.key} className="hg-stack" aria-label={g.name}>
          <SectionHeader
            title={g.name}
            count={m(rows.reduce((t, a) => t + a.amount, 0) + (partner?.total ?? 0))}
          />
          <div className="hg-list">
            {g.key === 'invest' && inv.sharePct !== null && (
              // 12번 투자 묶음 줄(누를 수 없음)
              <ListRow
                label={copy.investShare(inv.sharePct, d.invest.limit)}
                value={
                  inv.gain !== null && inv.gain !== 0
                    ? copy.investGain(
                        `${inv.gain > 0 ? '+' : '−'}${m(Math.abs(inv.gain))}`,
                        inv.gainPct,
                      )
                    : undefined
                }
              />
            )}
            {rows.map(row)}
            {partner && (
              <ListRow
                label={
                  <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                    {copy.partnerSum(d.couple?.partnerName ?? '', sideName, partner.n)}
                    <Badge kind="temp">{copy.partnerPill}</Badge>
                  </span>
                }
                value={m(partner.total)}
              />
            )}
          </div>
        </section>
      ))}
    </AssetsFrame>
  );
}
