import type { Asset } from '@sweetwo/api';
import { assetGroupsOf, daysBetween, formatDot, todayKst, type AssetSide } from '@sweetwo/core';
import { Badge, Button, ListRow, SectionHeader, Tabs } from '@sweetwo/ui';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { ownerOf, useAssetsData } from '../data';

const STALE_DAYS = 92; // 3개월 넘게 안 고친 줄 → “금액이 맞나요?”

// F-02 자산·부채 목록(23 F-02 7~11·13·14번): 자산·부채 전환(탭마다 합계), 묶음(F-03a 그룹) 안 금액 큰 순,
// 줄 = 이름(+ 공개 범위, 대신 입력) / 명의, 수정일 / 금액. 배우자 ‘합계만’은 묶음별 한 줄(누를 수 없음).
// 열 정렬, 투자 묶음 줄(투자 원칙), 통장 역할·목표 배지는 다음 단계.
export function F02Items() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const side: AssetSide = params.get('side') === 'debt' ? 'debt' : 'asset';
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const today = todayKst();

  const items = d.items.filter((a) => a.side === side);
  const sums = d.sums.filter((s) => s.side === side);
  const groups = assetGroupsOf(side)
    .map((g) => ({
      g,
      rows: items.filter((a) => a.grp === g.key).sort((a, b) => b.amount - a.amount),
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
      {groups.map(({ g, rows, partner }) => (
        <section key={g.key} className="hg-stack" aria-label={g.name}>
          <SectionHeader
            title={g.name}
            count={m(rows.reduce((t, a) => t + a.amount, 0) + (partner?.total ?? 0))}
          />
          <div className="hg-list">
            {rows.map(row)}
            {partner && (
              <ListRow
                label={
                  <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                    {copy.partnerSum(d.couple?.partnerName ?? '', sideName, partner.n)}
                    <Badge kind="temp">{copy.vis.sum}</Badge>
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
