import { qk, recordCare } from '@sweetwo/api';
import { formatMonthDay, giftRepeated, quickChips } from '@sweetwo/core';
import { AmountInput, Button, Chip, ChoiceCards, QuestionLayout, ShortText } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-08 다녀온 뒤 기록(24 Y-08, 재기획): a 쓴 돈(금액 메모 채움, 건너뛰기) + 목표 돈을 썼다면 ‘목표 고르기’
// → b 무엇을 드렸어요(현금 / 선물 / 식사, 같은 챙길 날에 2년 안 같은 선물이면 “작년에도 드렸어요”) → c 기억(메모) → 저장.
// 기록만, 목표·분배표·자산 변화 없음. 낸 곳은 묻지 않음. 목표를 골랐으면 저장 뒤 그 목표 G-02b(금액 채움)로. 사진(Y-08c)은 다음 단계.

type Gift = 'cash' | 'gift' | 'meal';
interface Draft {
  key: string; // 챙길 날 + 회차
  amount: number | null;
  goalId: string | null;
  gifts: Gift[];
  giftName: string;
  memo: string;
}
const blank = (key: string, amount: number | null): Draft => ({
  key,
  amount,
  goalId: null,
  gifts: [],
  giftName: '',
  memo: '',
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void }>((set, get) => ({
  d: blank('', null),
  set: (p) => set({ d: { ...get().d, ...p } }),
}));
const STEPS = ['a', 'b', 'c'];

export function Y08Record() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '', step = 'a' } = useParams();
  const [params] = useSearchParams();
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const care = c.cares.find((x) => x.id === id);
  const on = params.get('on') ?? (care ? c.recordOn(care) : null);
  const key = `${id}:${on ?? ''}`;
  // 다른 날을 열면 새로(금액 메모 채움)
  useEffect(() => {
    if (care && d.key !== key) set(blank(key, care.budget || null));
  }, [care, d.key, key, set]);

  if (c.loading) return null;
  if (!care || !on) return <Navigate to="/calendar/list" replace />;
  if (d.key !== key) return null;

  const i = Math.max(STEPS.indexOf(step), 0);
  const progress = { total: STEPS.length, now: i };
  const base = `/calendar/day/${care.id}/record`;
  const q = params.get('on') ? `?on=${on}` : '';
  const go = (n: number) => nav(`${base}/${STEPS[n] ?? 'a'}${q}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  const help = `${care.name}, ${formatMonthDay(on)}`;
  const goal = c.goals.find((g) => g.id === d.goalId);

  const save = async (o: Partial<Draft> = {}) => {
    const x = { ...useDraft.getState().d, ...o };
    if (saving) return;
    setSaving(true);
    try {
      await recordCare({
        careId: care.id,
        on,
        amount: x.amount ?? 0,
        paidFrom: 'personal',
        gifts: x.gifts,
        giftName: x.gifts.includes('gift') ? x.giftName.trim() || null : null,
        memo: x.memo.trim() || null,
        move: 0,
      });
      await Promise.all(
        [qk.careDays, qk.careRecords].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      set(blank('', null));
      toast(copy.recorded);
      if (x.goalId && x.amount)
        nav(`/goals/${x.goalId}/spend?amount=${x.amount}`, { replace: true });
      else nav(`/calendar/day/${care.id}`, { replace: true });
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
        later={{
          label: copy.skip,
          onClick: () => {
            set({ amount: null, goalId: null });
            go(1);
          },
        }}
        primary={{ label: copy.nextStep, disabled: d.amount === null }}
        onSubmit={() => d.amount !== null && go(1)}
      >
        <AmountInput
          label={copy.spentQ}
          value={d.amount}
          onChange={(amount) => set({ amount })}
          quick={quickChips.small}
          allowZero
        />
        {c.goals.length > 0 && (
          <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <p className="hg-help" style={{ margin: 0 }}>
              {copy.goalHelp}
            </p>
            {picking ? (
              <ChoiceCards<string>
                label={copy.pickGoalQ}
                value={d.goalId}
                onChange={(goalId) => set({ goalId })}
                onPick={() => setPicking(false)}
                options={c.goals.map((g) => ({ value: g.id, label: g.name }))}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setPicking(true)}
              >
                {goal ? goal.name : copy.pickGoal}
              </Button>
            )}
          </div>
        )}
      </QuestionLayout>
    );

  if (step === 'b') {
    const name = d.giftName.trim();
    // 같은 챙길 날에 2년 안 같은 선물
    const again = giftRepeated(c.records, {
      care_day_id: care.id,
      gift_name: name,
      occurs_on: on,
    });
    const toggle = (g: Gift) =>
      set({ gifts: d.gifts.includes(g) ? d.gifts.filter((x) => x !== g) : [...d.gifts, g] });
    return (
      <QuestionLayout
        steps={progress}
        title={copy.giftQ}
        help={help}
        onBack={back}
        later={{
          label: copy.skip,
          onClick: () => {
            set({ gifts: [], giftName: '' });
            go(2);
          },
        }}
        primary={{ label: copy.nextStep }}
        onSubmit={() => go(2)}
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
