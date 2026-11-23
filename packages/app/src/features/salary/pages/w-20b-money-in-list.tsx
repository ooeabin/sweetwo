import {
  deleteMoneyIn,
  fetchMoneyInPuts,
  fetchMoneyIns,
  qk,
  restoreMoneyIn,
  setPaydayIncome,
} from '@sweetwo/api';
import { amountBand, formatDateFull, formatDot2, todayKst } from '@sweetwo/core';
import {
  Button,
  EmptyState,
  Icon,
  ListRow,
  Menu,
  PageHeader,
  PlanAdd,
  SkelRows,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { money, useMask } from '../../../shared/mask';
import { speakMasked } from '../../../shared/masked-text';
import { quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { refreshChecks, useChecklists, useMe, usePartner, useSpace } from '../data';
import { defaultIncomeLines, PaydayIncomeSheet } from '../money-in-rows';
import { savingPaths, togetherPaths } from '../paths';
import { refreshMoneyIn } from '../together';

/**
 * W-20b 수입 기록(20 v2.2 ‘고침 A’, 2026-11-14 M6): 내가 적은 수입 적기 기록(최근 받은 날부터).
 * 줄 = 금액 + “11월 14일, 상여, 저금 2개에 넣었어요”. 줄 ⋯ = ‘고치기’(W-20 같은 화면, 금액·종류·받은 날) / ‘지우기’
 * (묻지 않고 지움 + Toast ‘되돌리기’ = money_in_restore). 지우면 그 기록으로 저금에 넣은 금액도 빠짐(money_in_delete).
 * 입구: W-13 ⋯ ‘수입 기록’, W-20 아래 글자 버튼
 */
export function W20bMoneyInList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const lists = useChecklists();
  const { masked } = useMask();
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const puts = useQuery({ queryKey: qk.moneyInPuts, queryFn: fetchMoneyInPuts });
  const back = () => (window.history.length > 1 ? nav(-1) : nav(savingPaths.list));
  if (!me.data) return <LoadingFrame current="salary" sub="detail" />;
  const m = (v: number) => money(v, masked);
  const meId = me.data.id;
  const mine = (ins.data ?? []).filter((r) => r.owner_user_id === meId);
  // 이번 사이클 수입 요약(2026-11-23 바탕 기준: W-02 수입 카드를 여기로 옮김). 합쳐서면 두 사람 기록 합
  const joint = space.data?.salary_mode === 'joint';
  const list = (lists.data ?? []).find((c) =>
    joint ? c.owner_user_id === null : c.owner_user_id === meId,
  );
  const today = todayKst();
  const from = list?.cycle_start ?? `${today.slice(0, 8)}01`;
  const to = list?.cycle_end ?? today;
  const owners = [meId, ...(joint && partner.data ? [partner.data.id] : [])];
  const inCycle = (ins.data ?? []).filter(
    (r) => owners.includes(r.owner_user_id) && r.received_on >= from && r.received_on <= to,
  );
  const sum = inCycle.reduce((t, r) => t + r.amount, 0);
  // 기록 0건 + 자동 기록 전이면 프로필 월급을 큰 금액으로(연필로 고침, 지금 확인하면 이 월급이 자동 기록됨, 2026-11-20)
  const meIncome = me.data.monthly_income ?? 0;
  const base =
    !ins.isLoading && ins.data && inCycle.length === 0 && (!list || !list.auto_income_at)
      ? {
          amount: meIncome,
          lines: defaultIncomeLines(
            me.data,
            partner.data,
            joint,
            list && list.cycle_start < today ? list.cycle_start : today,
          ),
          editable: !!list && list.cycle_end >= today,
        }
      : undefined;
  const saveIncome = async (checklist: string, amount: number) => {
    if (saving) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return toast(sharedCopy.needOnline);
    setSaving(true);
    try {
      await setPaydayIncome(checklist, amount);
      track('payday_income_set', { amount_band: amountBand(amount), zero: amount === 0 });
      await refreshChecks(qc);
      setSheet(false);
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    const put = puts.data?.[id] ?? 0;
    try {
      await deleteMoneyIn(id);
      track('money_in_deleted', { distributed: put > 0 });
      await refreshMoneyIn(qc);
      toast(put > 0 ? copy.moneyInDeletedPut : copy.moneyInDeleted, {
        label: copy.undo,
        onClick: () => quietly(restoreMoneyIn(id).then(() => refreshMoneyIn(qc))),
      });
    } catch {
      toast(copy.failed);
    }
  };
  const summaryAmount = base ? base.amount : sum;
  const summary = (
    <section className="hg-fdhero" aria-label={copy.incomeCardLabel}>
      <p className="hg-fdhero__label">{copy.incomeCardLabel}</p>
      <p className="hg-fdhero__amt">
        {base?.editable ? (
          <button
            type="button"
            className="hg-fdhero__edit"
            aria-label={`${copy.incomeEditLabel}, ${m(base.amount)}`}
            onClick={() => setSheet(true)}
          >
            <span>{speakMasked(m(base.amount))}</span>
            <Icon name="pencil" size={20} />
          </button>
        ) : (
          speakMasked(m(summaryAmount))
        )}
      </p>
      <PlanAdd onClick={() => nav(togetherPaths.moneyIn)}>{copy.moneyInGo}</PlanAdd>
    </section>
  );
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.moneyInList}
        backLabel={copy.back}
        backTo={copy.listTitle}
        onBack={back}
      />
      <div className="hg-fd">
        {summary}
        {ins.isLoading ? (
          <SkelRows
            rows={[
              [120, 72],
              [96, 72],
            ]}
          />
        ) : ins.isError && !ins.data ? (
          <section className="hg-card hg-card--fill hg-stack" role="status">
            <p className="hg-card__meta">{copy.loadFailed}</p>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => void ins.refetch()}
            >
              {copy.retry}
            </button>
          </section>
        ) : mine.length || base?.lines.length ? (
          <div className="hg-list hg-list--plain">
            {/* 기록 0건 기본값 줄(저장 전): 누를 수 없음 */}
            {mine.length === 0 &&
              base?.lines.map((l) => (
                <ListRow
                  key={l.key}
                  label={l.name}
                  sub={`${formatDot2(l.date)}, ${copy.incomeAuto}`}
                  value={`+${m(l.amount)}`}
                />
              ))}
            {mine.map((r) => {
              const put = puts.data?.[r.id] ?? 0;
              const sub = [formatDateFull(r.received_on)];
              if (r.source === 'payday_auto') sub.push(copy.incomeAuto);
              if (put > 0) sub.push(copy.moneyInPutOf(m(put)));
              return (
                <div key={r.id} className="hg-row hg-fd__menurow">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ListRow
                      label={copy.moneyInKinds[r.kind]}
                      sub={sub.join(', ')}
                      value={`+${m(r.amount)}`}
                    />
                  </div>
                  <Menu
                    label={copy.moneyInRowMenu(m(r.amount))}
                    actions={[
                      {
                        label: copy.moneyInEdit,
                        onSelect: () => nav(togetherPaths.moneyInEdit(r.id)),
                      },
                      {
                        label: copy.moneyInDelete,
                        danger: true,
                        onSelect: () => void remove(r.id),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            list
            page
            title={copy.moneyInListEmpty}
            action={
              <Button variant="secondary" onClick={() => nav(togetherPaths.moneyIn)}>
                {copy.moneyInGo}
              </Button>
            }
          />
        )}
      </div>
      {sheet && base?.editable && list && (
        <PaydayIncomeSheet
          initial={meIncome}
          busy={saving}
          onSave={(v) => void saveIncome(list.id, v)}
          onClose={() => setSheet(false)}
        />
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
