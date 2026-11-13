import {
  distributeMoneyIn,
  fetchMoneyIns,
  logMoneyIn,
  MoneyInBlocked,
  qk,
  type MoneyInKind,
} from '@sweetwo/api';
import { amountBand, todayKst } from '@sweetwo/core';
import { AmountInput, Chip, DateInput, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, toast } from '../../../shared/toast';
import { MoneyField } from '../bundle-parts';
import { copy } from '../copy';
import { useMe } from '../data';
import { salaryPaths, togetherPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { refreshMoneyIn } from '../together';

const KINDS: MoneyInKind[] = ['salary', 'bonus', 'family', 'work', 'refund', 'etc'];

/** 끝나고 돌아갈 곳(`?back=`, 앱 안 주소만). 없으면 월급 탭 */
const backOf = (p: URLSearchParams) => {
  const b = p.get('back');
  return b && b.startsWith('/') && !b.startsWith('//') ? b : salaryPaths.checklist;
};

/**
 * W-20 돈 들어왔어요(20 v2.2, 모든 사람, N8·F1): “얼마 들어왔어요?” 금액 + 받은 날(오늘, 미래 불가) + 칩(미리 고른 값 없음,
 * 날짜 없는 사람은 ‘일한 돈’ 맨 앞). ‘다음’ = log_money_in → W-20a. H-10, H-11/H-13, W-10, W-13 “+ 돈 들어왔어요”에서 열림
 */
export function W20MoneyIn() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(todayKst());
  const [kind, setKind] = useState<MoneyInKind | null>(null);
  const [busy, setBusy] = useState(false);
  // 받은 날은 처음엔 “오늘” 한 줄, ‘바꾸기’를 누르면 날짜 칸(날짜 칸이 처음부터 있으면 금액 칸 포커스를 가져감)
  const [pickDate, setPickDate] = useState(false);
  const close = () => (window.history.length > 1 ? nav(-1) : nav(backOf(params)));
  if (me.isLoading) return <QuestionSkeleton title={copy.moneyInQ} />;
  const none = !!me.data?.payday_none;
  const kinds = none ? (['work', ...KINDS.filter((k) => k !== 'work')] as MoneyInKind[]) : KINDS;
  const future = date !== null && date > todayKst();
  const save = async () => {
    if (busy || !amount || !kind || !date || future) return;
    setBusy(true);
    try {
      const id = await logMoneyIn({ amount, receivedOn: date, kind });
      track('money_in_logged', {
        kind,
        amount_band: amountBand(amount),
        saving_count: 0,
        payday_none: none,
      });
      await refreshMoneyIn(qc);
      // back이 없으면(홈 H-10·H-13, W-02 기간 줄) W-20a 다음 들어온 화면으로(W-20 자리를 W-20a가 바꿔 씀)
      const b = params.get('back');
      nav(
        `${togetherPaths.distribute(id)}${b ? `?back=${encodeURIComponent(backOf(params))}` : ''}`,
        {
          replace: true,
        },
      );
    } catch (e) {
      toast(
        e instanceof MoneyInBlocked && e.reason === 'future_date'
          ? copy.moneyInFuture
          : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.moneyInQ}
      onBack={close}
      primary={{
        label: copy.next,
        disabled: !amount || !kind || !date || future,
        loading: busy,
      }}
      onSubmit={() => void save()}
    >
      <AmountInput label={copy.moneyInQ} value={amount} onChange={setAmount} embedded autoFocus />
      <div
        className="hg-row"
        role="group"
        aria-label={copy.moneyInKindLabel}
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        {kinds.map((k) => (
          <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
            {copy.moneyInKinds[k]}
          </Chip>
        ))}
      </div>
      {pickDate ? (
        <DateInput
          label={copy.moneyInDate}
          value={date}
          onChange={(v) => setDate(v)}
          error={future ? copy.moneyInFuture : undefined}
        />
      ) : (
        <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
          <span className="hg-help">{copy.moneyInDateToday}</span>
          <button type="button" className="hg-btn hg-btn--link" onClick={() => setPickDate(true)}>
            {copy.change}
          </button>
        </div>
      )}
    </QuestionLayout>
  );
}

/**
 * W-20a 저금에 나눠 넣기(20 v2.2): 내가 넣을 수 있는 저금(내 저금, 묶음의 내 줄, 같이 계열은 공동 저금) + 금액 칸(빈 칸),
 * 맨 위 “들어온 돈 300만 원 중 남은 100만 원”. ‘넣기’ = distribute_money_in, 합이 들어온 돈보다 크면 막음. 0원이면 기록만
 */
export function W20aDistribute() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const me = useMe();
  const { masked } = useMask();
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const [put, setPut] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState(false);
  const back = backOf(params);
  const hasBack = !!params.get('back');
  /** 끝나면 돌아갈 곳: back이 있으면 그곳, 없으면 들어온 화면(뒤로) */
  const leave = () =>
    hasBack || window.history.length <= 1 ? nav(back, { replace: true }) : nav(-1);
  if (!d.ready && d.failed)
    return <SavingQuestionError onBack={() => nav(back)} onRetry={d.retry} />;
  if (!d.ready || ins.isLoading) return <QuestionSkeleton title={copy.moneyInDistributeQ} />;
  const rec = ins.data?.find((r) => r.id === id);
  if (!rec) return <Navigate to={back} replace />;
  const m = (v: number) => money(v, masked);
  const goals = d.live.filter((i) => i.canEdit);
  const total = Object.values(put).reduce<number>((t, v) => t + (v ?? 0), 0);
  const left = rec.amount - total;
  const over = left < 0;
  const finish = async () => {
    if (busy || over) return;
    setBusy(true);
    try {
      const items = goals
        .filter((i) => (put[i.goal.id] ?? 0) > 0)
        .map((i) => ({ goalId: i.goal.id, amount: put[i.goal.id] ?? 0 }));
      const n = items.length ? await distributeMoneyIn(id, items) : 0;
      track('money_in_distributed', {
        kind: rec.kind,
        amount_band: amountBand(rec.amount),
        saving_count: n,
        payday_none: !!me.data?.payday_none,
      });
      await refreshMoneyIn(qc);
      carryToast(n ? copy.moneyInPutDone(n, m(total)) : copy.moneyInLogged);
      leave();
    } catch (e) {
      toast(e instanceof MoneyInBlocked && e.reason === 'over' ? copy.moneyInOver : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.moneyInDistributeQ}
      help={
        goals.length ? copy.moneyInLeft(m(rec.amount), m(Math.max(left, 0))) : copy.moneyInNoSaving
      }
      onBack={leave}
      primary={{ label: copy.moneyInPut, disabled: over, loading: busy }}
      onSubmit={() => void finish()}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
        {goals.map((i) => (
          <MoneyField
            key={i.goal.id}
            label={i.goal.name}
            value={put[i.goal.id] ?? null}
            placeholder="0"
            onChange={(v) => setPut((p) => ({ ...p, [i.goal.id]: v }))}
          />
        ))}
        {over && (
          <p className="hg-help is-error" role="alert">
            {copy.moneyInOver}
          </p>
        )}
      </div>
    </QuestionLayout>
  );
}
