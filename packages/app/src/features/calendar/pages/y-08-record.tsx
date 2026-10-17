import { qk, recordCare, type PaidFrom } from '@sweetwo/api';
import { addDays, formatMonthDay, quickChips } from '@sweetwo/core';
import { AmountInput, Button, Chip, ChoiceCards, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { money } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-08 다녀온 뒤 기록(docs/spec/24-calendar.md Y-08, 06 6장): a 쓴 돈(쓸 돈 채움) → a2 낸 곳(한 번만 물음)
// → b 무엇을 드렸어요(현금 / 선물 / 식사, 같은 분께 2년 안 같은 선물이면 “작년에도 드렸어요”) → c 기억(메모) → 저장.
// 낸 곳: 목표자금 통장 = ‘양가 비용’ 보유액에서만 / 생활비 통장·카드 = 목표 사용 + ‘목표자금 → 공동 생활비’ 줄(보유액만큼)
// / 각자 돈 = 기록만. 예비부부는 결혼 준비 통장 / 각자 돈·양가 지원. 양가가 아닌 날(우리 둘)은 낸 곳 없이 각자 돈.
// 줄이 생기면 끝에 안내 + ‘보기’(W-02). 사진(Y-08c)은 다음 단계.

type Gift = 'cash' | 'gift' | 'meal';
interface Draft {
  key: string; // 챙길 날 + 회차
  amount: number | null;
  paidFrom: PaidFrom | null;
  gifts: Gift[];
  giftName: string;
  memo: string;
}
const blank = (key: string, amount: number | null): Draft => ({
  key,
  amount,
  paidFrom: null,
  gifts: [],
  giftName: '',
  memo: '',
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void }>((set, get) => ({
  d: blank('', null),
  set: (p) => set({ d: { ...get().d, ...p } }),
}));

export function Y08Record() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '', step = 'a' } = useParams();
  const [params] = useSearchParams();
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  const care = c.cares.find((x) => x.id === id);
  const on = params.get('on') ?? (care ? c.recordOn(care) : null);
  const key = `${id}:${on ?? ''}`;
  // 다른 날을 열면 새로(쓸 돈 채움)
  useEffect(() => {
    if (care && d.key !== key) set(blank(key, care.budget));
  }, [care, d.key, key, set]);

  if (c.loading) return null;
  if (!care || !on) return <Navigate to="/calendar/list" replace />;
  if (d.key !== key) return null;

  const engaged = c.space?.marriage_status === 'engaged';
  // 낸 곳: 양가 날만(우리 둘은 각자 돈)
  const asksPaid = engaged || care.category === 'family';
  const steps = ['a', ...(asksPaid ? ['a2'] : []), 'b', 'c'];
  const i = Math.max(steps.indexOf(step), 0);
  const progress = { total: steps.length, now: i };
  const base = `/calendar/day/${care.id}/record`;
  const q = params.get('on') ? `?on=${on}` : '';
  const go = (n: number) => nav(`${base}/${steps[n] ?? 'a'}${q}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  const help = `${care.name}, ${formatMonthDay(on)}`;

  if (step === 'done') {
    const line = Number(params.get('line') ?? 0);
    return (
      <MainFrame
        current="calendar"
        columns={[
          <section key="d" className="hg-card hg-stack" aria-label={copy.recorded}>
            <b>{copy.lineAdded(money(line, false))}</b>
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button variant="primary" onClick={() => nav('/plan/split', { replace: true })}>
                {copy.see}
              </Button>
              <Button
                variant="secondary"
                onClick={() => nav(`/calendar/day/${care.id}`, { replace: true })}
              >
                {copy.close}
              </Button>
            </div>
          </section>,
        ]}
      />
    );
  }

  const save = async (o: Partial<Draft> = {}) => {
    const x = { ...useDraft.getState().d, ...o };
    if (saving || x.amount === null) return;
    setSaving(true);
    try {
      const paidFrom: PaidFrom = asksPaid ? (x.paidFrom ?? 'personal') : 'personal';
      // 생활비로 냈으면 줄은 ‘양가 비용’ 보유액만큼만(06 6장)
      const held = c.familyGoal ? c.heldOf(c.familyGoal.id) : 0;
      const line = await recordCare({
        careId: care.id,
        on,
        amount: x.amount,
        paidFrom,
        gifts: x.gifts,
        giftName: x.gifts.includes('gift') ? x.giftName.trim() || null : null,
        memo: x.memo.trim() || null,
        move: paidFrom === 'living' ? Math.min(x.amount, held) : 0,
      });
      await Promise.all(
        [qk.careDays, qk.careRecords, qk.goalRecords, ['monthly_plan']].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      set(blank('', null));
      if (line > 0) nav(`${base}/done?on=${on}&line=${line}`, { replace: true });
      else {
        toast(copy.recorded);
        nav(`/calendar/day/${care.id}`, { replace: true });
      }
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'a')
    return (
      <QuestionLayout
        steps={progress}
        title={copy.spentQ}
        help={help}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: d.amount === null }}
        onSubmit={() => d.amount !== null && go(i + 1)}
      >
        <AmountInput
          label={copy.spentQ}
          value={d.amount}
          onChange={(amount) => set({ amount })}
          quick={quickChips.small}
          allowZero
        />
      </QuestionLayout>
    );

  if (step === 'a2') {
    const options: PaidFrom[] = engaged
      ? ['wedding_account', 'personal_support']
      : ['goal_fund', 'living', 'personal'];
    return (
      <QuestionLayout steps={progress} title={copy.paidQ} help={help} onBack={back}>
        <ChoiceCards<PaidFrom>
          label={copy.paidQ}
          value={d.paidFrom}
          onChange={(paidFrom) => set({ paidFrom })}
          onPick={() => go(i + 1)}
          options={options.map((p) => ({ value: p, label: copy.paid[p], sub: copy.paidSub[p] }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'b') {
    const name = d.giftName.trim();
    // 같은 분께 2년 안 같은 선물
    const again =
      !!name &&
      !!care.member_id &&
      c.records.some(
        (r) =>
          r.member_id === care.member_id &&
          r.gift_name === name &&
          r.occurs_on >= addDays(on, -730) &&
          !(r.care_day_id === care.id && r.occurs_on === on),
      );
    const toggle = (g: Gift) =>
      set({ gifts: d.gifts.includes(g) ? d.gifts.filter((x) => x !== g) : [...d.gifts, g] });
    return (
      <QuestionLayout
        steps={progress}
        title={copy.giftQ}
        help={help}
        onBack={back}
        primary={{ label: copy.nextStep }}
        onSubmit={() => go(i + 1)}
      >
        <div
          className="hg-row"
          role="group"
          aria-label={copy.giftQ}
          style={{ gap: 'var(--space-2)' }}
        >
          {(['cash', 'gift', 'meal'] as const).map((g) => (
            <Chip key={g} selected={d.gifts.includes(g)} onClick={() => toggle(g)}>
              {copy.gifts[g]}
            </Chip>
          ))}
        </div>
        {d.gifts.includes('gift') && (
          <ShortText
            label={copy.giftName}
            value={d.giftName}
            onChange={(giftName) => set({ giftName })}
            max={30}
          />
        )}
        {again && (
          <p className="hg-help" role="status">
            {copy.giftAgain}
          </p>
        )}
      </QuestionLayout>
    );
  }

  return (
    <QuestionLayout
      steps={progress}
      title={copy.rememberQ}
      help={help}
      onBack={back}
      later={{ label: copy.skip, onClick: () => void save({ memo: '' }) }}
      primary={{ label: copy.save, loading: saving }}
      onSubmit={() => void save()}
    >
      <ShortText label={copy.memo} value={d.memo} onChange={(memo) => set({ memo })} max={200} />
    </QuestionLayout>
  );
}
