import { fetchAssetHistory, qk, restoreAsset, trashAsset, updateAsset } from '@sweetwo/api';
import {
  assetGroup,
  formatDateFull,
  formatDot,
  formatYm,
  hasPrincipal,
  todayKst,
} from '@sweetwo/core';
import {
  AmountInput,
  Badge,
  Button,
  ChoiceCards,
  LineChart,
  ListRow,
  PageHeader,
  SectionHeader,
} from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { lastAssetsTab } from '../assets-frame';
import { copy } from '../copy';
import { canEdit, ownerOf, useAssetsData, useRefreshAssets } from '../data';

type Vis = 'all' | 'sum' | 'private';

// F-04 항목 상세·수정(23 F-04 1·2·3·5·6·7번): 금액(누르면 그 자리에서 수정, Esc 취소), 공개 범위(내 명의만),
// 안 판 수익(원금 있는 투자·부동산), 월별 기록(월말 정리 / 직접 수정), 삭제(휴지통 + 되돌리기).
// 유형별 값(만기일, 납입 회차, 금리, 월 납입·상환액)은 보기만, 목표 연결은 고칠 수 있음(F-03i).
// 배우자 명의는 볼 수만. 금액 그래프(등록 이후 월별), 투자·부동산은 ‘팔았어요’(F-04b~d)·‘시세 바꾸기’.
// 고친 기록은 직접 고친 것만, 날짜와 고친 사람. 유형별 값(만기일 등) 수정은 다음 단계.
export function F04Item() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const history = useQuery({ queryKey: qk.assetHistory(id), queryFn: () => fetchAssetHistory(id) });
  const [editAmount, setEditAmount] = useState<number | null | undefined>(undefined);
  const [editVis, setEditVis] = useState(false);
  const [busy, setBusy] = useState(false);

  if (d.loading) return null;
  const a = d.items.find((x) => x.id === id);
  if (!a) return <Navigate to={lastAssetsTab()} replace />;
  const o = ownerOf(a, d);
  const editable = canEdit(a, d.me?.id);
  const mine = a.owner_user_id === d.me?.id;
  const back = () => nav(`/assets/items?side=${a.side}`);

  const run = async (act: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await act();
      await refresh();
      await history.refetch();
      if (done) toast(done);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setBusy(false);
    }
  };
  const saveAmount = () =>
    editAmount !== undefined &&
    editAmount !== null &&
    void run(() => updateAsset(a.id, { amount: editAmount, estimated: false }), copy.saved).then(
      () => setEditAmount(undefined),
    );
  const remove = () =>
    void run(async () => {
      await trashAsset(a.id);
      toast(copy.removed, {
        label: copy.undo,
        onClick: () => void restoreAsset(a.id).then(refresh),
      });
      back();
    });

  const gain = hasPrincipal(a.grp) && a.principal !== null ? a.amount - a.principal : null;
  const market = editable && a.side === 'asset' && hasPrincipal(a.grp);
  const nameOf = (uid: string | null) =>
    uid === d.me?.id ? (d.me?.nickname ?? '') : (d.partnerProfile?.nickname ?? '');
  // 금액 그래프: 달마다 마지막 기록(등록 이후)
  const byMonth = new Map<string, number>();
  for (const h of [...(history.data ?? [])].sort((x, y) =>
    x.recorded_at < y.recorded_at ? -1 : 1,
  ))
    byMonth.set(todayKst(new Date(h.recorded_at)).slice(0, 7), h.amount);
  const points = [...byMonth].map(([ym, v]) => ({ label: formatYm(`${ym}-01`), value: v }));
  const manual = (history.data ?? []).filter((h) => h.source === 'manual');
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={a.name}
        sub={assetGroup(a.grp)?.name}
        backLabel={copy.back}
        onBack={back}
      />
      {!editable && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{copy.readOnly(o.name)}</span>
        </p>
      )}
      <section className="hg-card hg-stack" aria-label={copy.amountLabel}>
        <span className="hg-card__label">
          {copy.amountLabel} {a.estimated && <Badge kind="temp">{copy.estimatedTag}</Badge>}
        </span>
        {editAmount !== undefined ? (
          <div
            className="hg-stack"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditAmount(undefined);
              if (e.key === 'Enter') saveAmount();
            }}
          >
            <AmountInput
              label={copy.amountLabel}
              value={editAmount}
              onChange={setEditAmount}
              allowZero
              embedded
            />
            <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                disabled={busy || editAmount === null}
                onClick={saveAmount}
              >
                {copy.saveEdit}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditAmount(undefined)}>
                {copy.cancel}
              </Button>
            </span>
          </div>
        ) : (
          <span className="hg-row" style={{ gap: 'var(--space-3)', alignItems: 'baseline' }}>
            <span className="hg-card__value">{m(a.amount)}</span>
            {editable && (
              <button
                type="button"
                className="hg-btn hg-btn--link"
                onClick={() => setEditAmount(a.amount)}
              >
                {copy.edit}
              </button>
            )}
          </span>
        )}
        {gain !== null && a.principal !== null && (
          <span className="hg-card__meta">
            {`${gain >= 0 ? '+' : '−'}${m(Math.abs(gain))}`}, {copy.principal(m(a.principal))}
          </span>
        )}
        {market && editAmount === undefined && (
          <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" onClick={() => setEditAmount(a.amount)}>
              {copy.marketEdit}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => nav(`/assets/${a.id}/sold`)}>
              {copy.sold}
            </Button>
          </span>
        )}
      </section>
      {points.length >= 2 && (
        <LineChart
          label={copy.graph}
          value={m(a.amount)}
          points={points}
          format={m}
          name={a.name}
          plotLabel={copy.graph}
        />
      )}
      <div className="hg-list">
        <ListRow
          label={copy.owner}
          value={
            <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
              {o.name}
              {o.proxy && <Badge kind="temp">{copy.proxy}</Badge>}
            </span>
          }
        />
        {a.maturity_date && (
          <ListRow label={copy.maturityLabel} value={formatDateFull(a.maturity_date)} />
        )}
        {a.paid_count !== null && (
          <ListRow label={copy.countLabel} value={`${a.paid_count}${copy.paidCountUnit}`} />
        )}
        {a.interest_rate !== null && (
          <ListRow
            label={
              a.rate_estimated ? (
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  {copy.rateLabel}
                  <Badge kind="temp">{copy.estimatedTag}</Badge>
                </span>
              ) : (
                copy.rateLabel
              )
            }
            value={`${a.interest_rate}%`}
          />
        )}
        {a.monthly_payment !== null && (
          <ListRow
            label={a.side === 'debt' ? copy.repaymentLabel : copy.paymentLabel}
            value={m(a.monthly_payment)}
          />
        )}
        {mine && (
          <ListRow
            label={copy.visLabel}
            value={copy.vis[a.visibility]}
            onClick={() => setEditVis((x) => !x)}
          />
        )}
      </div>
      {mine && editVis && (
        <ChoiceCards<Vis>
          label={copy.visTitle}
          value={a.visibility}
          onChange={(v) => {
            setEditVis(false);
            void run(() => updateAsset(a.id, { visibility: v }), copy.saved);
          }}
          autoAdvance={false}
          options={[
            { value: 'all', label: copy.visOptions.all },
            { value: 'sum', label: copy.visOptions.sum },
            { value: 'private', label: copy.visOptions.private },
          ]}
        />
      )}
      <section className="hg-stack" aria-label={copy.history}>
        <SectionHeader title={copy.history} />
        <div className="hg-list">
          {manual.map((h) => (
            <ListRow
              key={h.id}
              label={
                <span className="hg-help">
                  {copy.editedBy(
                    formatDot(todayKst(new Date(h.recorded_at))),
                    h.recorded_by ? nameOf(h.recorded_by) : '',
                  )}
                </span>
              }
              value={<b>{m(h.amount)}</b>}
            />
          ))}
        </div>
        <span className="hg-help">{formatDateFull(todayKst(new Date(a.created_at)))}</span>
      </section>
      {editable && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={remove}
          style={{ alignSelf: 'flex-start' }}
        >
          {copy.remove}
        </Button>
      )}
    </div>
  );
  return <MainFrame current="assets" columns={[body]} />;
}
