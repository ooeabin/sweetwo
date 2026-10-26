import {
  fetchAssetHistory,
  qk,
  restoreAsset,
  trashAsset,
  updateAsset,
  updateIfUnchanged,
  type Asset,
} from '@sweetwo/api';
import {
  assetGroup,
  conflictDecision,
  formatDateFull,
  formatDot,
  formatYm,
  hasPrincipal,
  todayKst,
} from '@sweetwo/core';
import {
  AmountInput,
  Field,
  Badge,
  Button,
  ChoiceCards,
  ConflictChoice,
  LineChart,
  ListRow,
  PageHeader,
  SectionHeader,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { enqueue, isOfflineError } from '../../../shared/outbox';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { lastAssetsTab } from '../assets-frame';
import { copy } from '../copy';
import { canEdit, ownerOf, useAssetsData, useRefreshAssets } from '../data';

type Vis = 'all' | 'sum' | 'private';

// F-04 항목 상세·수정(23 F-04 1·2·3·5·6·7번): 금액(누르면 그 자리에서 수정, Esc 취소), 공개 범위(내 명의만),
// 안 판 수익(원금 있는 투자·부동산), 월별 기록(월말 정리 / 직접 수정), 삭제(휴지통 + 되돌리기).
// 유형별 값(만기일, 납입 회차, 금리, 월 납입·상환액)도 누르면 그 자리에서 입력칸 + ‘저장’(3번, Esc 취소).
// 배우자 명의는 볼 수만. 금액 그래프(등록 이후 월별), 투자·부동산은 ‘팔았어요’(F-04b~d)·‘시세 바꾸기’.
// 고친 기록은 직접 고친 것만, 날짜와 고친 사람.
type ValueField = 'maturity_date' | 'paid_count' | 'interest_rate' | 'monthly_payment';
const RATE = /^\d{1,2}(\.\d{1,2})?$/;

export function F04Item() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const qc = useQueryClient();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const history = useQuery({ queryKey: qk.assetHistory(id), queryFn: () => fetchAssetHistory(id) });
  const [editAmount, setEditAmountRaw] = useState<number | null | undefined>(undefined);
  // 금액 고치기를 열 때의 값(30 동기화 2장 충돌 판정 기준)과 충돌(배우자가 1분 안에 바꿈)
  const [openedAmount, setOpenedAmount] = useState<number | null>(null);
  const [conflict, setConflict] = useState<{ mine: number; theirs: number } | null>(null);
  const setEditAmount = (v: number | null | undefined) => {
    if (v === undefined) setConflict(null);
    setEditAmountRaw(v);
  };
  const startEdit = (v: number) => {
    setOpenedAmount(v);
    setConflict(null);
    setEditAmountRaw(v);
  };
  const [editVis, setEditVis] = useState(false);
  // 3번 값 수정: 고르고 있는 값과 입력 중인 글자(월 납입·상환액은 금액 칸)
  const [field, setField] = useState<ValueField | null>(null);
  const [draft, setDraft] = useState('');
  const [draftAmount, setDraftAmount] = useState<number | null>(null);
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
  // 금액 저장: 열 때 값이 서버에 그대로일 때만. 배우자가 1분 안에 바꿨으면 충돌 선택, 그 밖은 마지막 저장 우선
  const saveAmount = (force = false) => {
    if (editAmount === undefined || editAmount === null) return;
    const patch = { amount: editAmount, estimated: false };
    // 오프라인: 대기열 + 화면 값 바로 바꿈(30 동기화 4장). 보낼 때 같은 규칙으로 다시 판정
    const queue = () => {
      enqueue({
        kind: 'asset',
        rowId: a.id,
        patch,
        base: { amount: openedAmount ?? a.amount },
        label: copy.queuedAmount(a.name),
      });
      qc.setQueryData<Asset[]>(qk.assets, (old) =>
        old?.map((x) => (x.id === a.id ? { ...x, ...patch } : x)),
      );
      toast(copy.savedOffline);
      setEditAmount(undefined);
    };
    if (!force && !navigator.onLine) return queue();
    let saved = false;
    let queued = false;
    const act = async () => {
      if (!force) {
        const r = await updateIfUnchanged('asset', a.id, patch, {
          amount: openedAmount ?? a.amount,
        });
        const dec = r.ok
          ? 'same'
          : conflictDecision(r.current, { amount: editAmount }, d.me?.id ?? '');
        if (!r.ok && dec === 'choose') {
          setConflict({ mine: editAmount ?? 0, theirs: r.current.amount });
          return;
        }
        if (dec === 'same') return void (saved = true);
      }
      await updateAsset(a.id, patch);
      saved = true;
    };
    void run(async () => {
      try {
        await act();
      } catch (e) {
        if (!isOfflineError(e)) throw e;
        queued = true;
      }
    }).then(() => {
      if (queued) return queue();
      if (!saved) return;
      toast(copy.saved);
      setEditAmount(undefined);
    });
  };
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
  const open = (f: ValueField, v: string) => {
    setField(f);
    setDraft(v);
  };
  const valueError =
    field === 'interest_rate' && draft !== '' && !(RATE.test(draft) && Number(draft) <= 30)
      ? copy.rateInvalid
      : field === 'paid_count' && draft !== '' && !/^\d{1,3}$/.test(draft)
        ? copy.countInvalid
        : undefined;
  const valueOk = field === 'monthly_payment' ? draftAmount !== null : draft !== '' && !valueError;
  const saveValue = () => {
    if (!field || !valueOk || busy) return;
    const patch =
      field === 'maturity_date'
        ? { maturity_date: draft }
        : field === 'paid_count'
          ? { paid_count: Number(draft) }
          : field === 'interest_rate'
            ? { interest_rate: Number(draft), rate_estimated: false }
            : { monthly_payment: draftAmount };
    void run(() => updateAsset(a.id, patch), copy.saved).then(() => setField(null));
  };
  const fieldLabel =
    field === 'maturity_date'
      ? copy.maturityLabel
      : field === 'paid_count'
        ? copy.countLabel
        : field === 'interest_rate'
          ? copy.rateLabel
          : a.side === 'debt'
            ? copy.repaymentLabel
            : copy.paymentLabel;
  const editor = (
    <div
      className="hg-stack"
      style={{ padding: 'var(--space-3) var(--space-4)' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setField(null);
        if (e.key === 'Enter') saveValue();
      }}
    >
      {field === 'monthly_payment' ? (
        <AmountInput
          label={fieldLabel}
          value={draftAmount}
          onChange={setDraftAmount}
          allowZero
          embedded
        />
      ) : (
        <Field
          label={fieldLabel}
          type={field === 'maturity_date' ? 'date' : 'text'}
          inputMode={
            field === 'interest_rate' ? 'decimal' : field === 'paid_count' ? 'numeric' : undefined
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value.trim())}
          error={valueError}
          autoFocus
        />
      )}
      <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
        <Button variant="primary" size="sm" disabled={busy || !valueOk} onClick={saveValue}>
          {copy.saveEdit}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setField(null)}>
          {copy.cancel}
        </Button>
      </span>
    </div>
  );
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
                onClick={() => saveAmount()}
              >
                {copy.saveEdit}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditAmount(undefined)}>
                {copy.cancel}
              </Button>
            </span>
            {conflict && (
              <ConflictChoice
                title={copy.conflictQ}
                body={copy.conflictBody(nameOf(a.updated_by))}
                mine={{ label: copy.conflictMine, value: m(conflict.mine) }}
                theirs={{
                  label: copy.conflictTheirs(nameOf(a.updated_by)),
                  value: m(conflict.theirs),
                }}
                busy={busy}
                onMine={() => saveAmount(true)}
                onTheirs={() => setEditAmount(undefined)}
              />
            )}
          </div>
        ) : (
          <span className="hg-row" style={{ gap: 'var(--space-3)', alignItems: 'baseline' }}>
            <span className="hg-card__value">{m(a.amount)}</span>
            {editable && (
              <button
                type="button"
                className="hg-btn hg-btn--link"
                onClick={() => startEdit(a.amount)}
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
            <Button variant="secondary" size="sm" onClick={() => startEdit(a.amount)}>
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
        {a.maturity_date !== null && (
          <ListRow
            label={copy.maturityLabel}
            value={formatDateFull(a.maturity_date)}
            onClick={editable ? () => open('maturity_date', a.maturity_date ?? '') : undefined}
          />
        )}
        {field === 'maturity_date' && editor}
        {a.paid_count !== null && (
          <ListRow
            label={copy.countLabel}
            value={`${a.paid_count}${copy.paidCountUnit}`}
            onClick={editable ? () => open('paid_count', String(a.paid_count)) : undefined}
          />
        )}
        {field === 'paid_count' && editor}
        {/* 매달 나가는 돈이 금리보다 먼저(23 F-03g) */}
        {a.monthly_payment !== null && (
          <ListRow
            label={a.side === 'debt' ? copy.repaymentLabel : copy.paymentLabel}
            value={m(a.monthly_payment)}
            onClick={
              editable
                ? () => {
                    setDraftAmount(a.monthly_payment);
                    open('monthly_payment', '');
                  }
                : undefined
            }
          />
        )}
        {field === 'monthly_payment' && editor}
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
            onClick={editable ? () => open('interest_rate', String(a.interest_rate)) : undefined}
          />
        )}
        {field === 'interest_rate' && editor}
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
