import { insertCareDays, qk, updateCareDay, type CareDay } from '@sweetwo/api';
import { lunarToSolar, nextCareDate, quickChips } from '@sweetwo/core';
import { AmountInput, Chip, DateInput, QuestionLayout, ShortText, Tabs, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-07 챙길 날 추가(24 Y-07, 화면별 정의, 재기획): 모든 챙길 날을 같은 3화면으로.
// a “어떤 날이에요?” 이름(최대 20자) + 이름 칩(이름·날짜·반복 기본값만 채움, 종류를 나누지 않음)
// → c “언제예요?” 날짜 + 양력/음력 + “매년 돌아와요”(설날·추석·어버이날은 날짜를 채우고 건너뜀)
// → d “쓸 돈을 메모해 둘까요?” 금액 메모(0원·빈 값, 건너뛰기) → ‘추가하기’ 바로 저장(미리 알림 D-30 + D-7) → Y-01.
// 한 번인 지난 날짜는 “이미 지난 날이에요. 기록으로 남길까요?” → Y-08. 같은 이름·같은 날짜가 있으면 한 번 확인.
// 수정(Y-05 ‘수정’)은 같은 a → c 화면에서 이름·날짜만 고치고 ‘저장’.

type ChipKey = keyof typeof copy.chips;
const CHIPS = Object.keys(copy.chips) as ChipKey[];
/** 칩 기본값(24 ‘이름 칩 기본값’): 날짜를 정하는 칩은 c를 건너뜀 */
const FIXED: Partial<Record<ChipKey, { lunar: boolean; month: number; day: number }>> = {
  seollal: { lunar: true, month: 1, day: 1 },
  chuseok: { lunar: true, month: 8, day: 15 },
  parents_day: { lunar: false, month: 5, day: 8 },
};
interface Draft {
  /** 고친다면 그 챙길 날 id */
  editId: string | null;
  chip: ChipKey | null;
  name: string;
  date: string | null;
  lunar: boolean;
  leap: boolean;
  yearly: boolean;
  amount: number | null;
}
const start = (date: string | null = null): Draft => ({
  editId: null,
  chip: null,
  name: '',
  date,
  lunar: false,
  leap: false,
  yearly: true,
  amount: null,
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void }>((set, get) => ({
  d: start(),
  set: (p) => set({ d: { ...get().d, ...p } }),
}));
/** 챙길 날 추가 시작(‘+ 추가’, 달력 고른 날) */
export const startCareAdd = (date: string | null = null) => useDraft.getState().set(start(date));
/** 챙길 날 수정 시작(Y-05 ‘수정’): 이름과 날짜(다음 회차 날짜, 음력이면 음력 원본) */
export const startCareEdit = (c: CareDay, today: string) => {
  const y = today.slice(0, 4);
  const pad = (n: number | null) => String(n ?? 1).padStart(2, '0');
  const date =
    c.date_rule === 'once'
      ? c.once_on
      : c.month
        ? c.date_rule === 'lunar_yearly'
          ? `${y}-${pad(c.month)}-${pad(c.day)}`
          : (nextCareDate(c, today) ?? `${y}-${pad(c.month)}-${pad(c.day)}`)
        : null;
  useDraft.getState().set({
    ...start(date),
    editId: c.id,
    name: c.name,
    lunar: c.date_rule === 'lunar_yearly',
    leap: c.leap,
    yearly: c.date_rule !== 'once',
  });
};

const KIND: Record<ChipKey, string> = {
  birthday: 'birthday',
  anniversary: 'anniversary',
  seollal: 'seollal',
  chuseok: 'chuseok',
  parents_day: 'parents_day',
  event: 'event',
  custom: 'custom',
};

export function Y07CareAdd() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const step = useParams().step ?? 'a';
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  /** 같은 날 확인을 한 번 보여 줬음(다시 누르면 그대로 진행) */
  const [asked, setAsked] = useState(false);
  if (c.loading) return null;
  const editing = d.editId ? c.cares.find((x) => x.id === d.editId) : null;
  const fixed = d.chip ? FIXED[d.chip] : undefined;
  const steps = editing ? ['a', 'c'] : ['a', ...(fixed ? [] : ['c']), 'd'];
  const i = Math.max(steps.indexOf(step), 0);
  const progress = { total: steps.length, now: i };
  const go = (n: number) => nav(`/calendar/add/${steps[n] ?? 'a'}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  if (step !== 'a' && !d.name.trim()) return <Navigate to="/calendar/add/a" replace />;

  // 날짜 규칙과 월·일(매년이면 연도는 처음 날짜로만 씀)
  const rule = (() => {
    if (fixed)
      return {
        date_rule: fixed.lunar ? ('lunar_yearly' as const) : ('solar_yearly' as const),
        month: fixed.month,
        day: fixed.day,
        leap: false,
        once_on: null,
      };
    if (!d.date) return null;
    const [, mm = 1, dd = 1] = d.date.split('-').map(Number);
    if (!d.yearly)
      return { date_rule: 'once' as const, month: null, day: null, leap: false, once_on: d.date };
    return {
      date_rule: d.lunar ? ('lunar_yearly' as const) : ('solar_yearly' as const),
      month: mm,
      day: dd,
      leap: d.lunar && d.leap,
      once_on: null,
    };
  })();
  // 고른 날짜의 양력(음력이면 그 해 음력 날짜의 양력, 없는 날짜면 null)
  const solar =
    d.date && d.lunar
      ? lunarToSolar(
          Number(d.date.slice(0, 4)),
          Number(d.date.slice(5, 7)),
          Number(d.date.slice(8, 10)),
          d.leap,
        )
      : d.date;
  const past = !d.yearly && !!solar && solar < c.today;
  const name = d.name.trim();
  const dup =
    !!rule &&
    c.cares.some(
      (x) =>
        x.id !== d.editId &&
        x.name.trim() === name &&
        x.date_rule === rule.date_rule &&
        x.month === rule.month &&
        x.day === rule.day &&
        x.once_on === rule.once_on,
    );

  const save = async (amount: number, record = false) => {
    if (saving || !rule) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCareDay(editing.id, { name, ...rule });
        await qc.invalidateQueries({ queryKey: qk.careDays });
        toast(copy.edited);
        nav(`/calendar/day/${editing.id}`, { replace: true });
        return;
      }
      const [id] = await insertCareDays([
        { category: 'couple', kind: KIND[d.chip ?? 'custom'], name, budget: amount, ...rule },
      ]);
      await qc.invalidateQueries({ queryKey: qk.careDays });
      // 초안은 다음 시작(startCareAdd)에서 비움(여기서 비우면 a로 되돌아감)
      if (record && id && rule.once_on)
        nav(`/calendar/day/${id}/record/a?on=${rule.once_on}`, { replace: true });
      else {
        toast(copy.saved);
        nav('/calendar/list', { replace: true });
      }
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'a') {
    const ok = !!name;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.nameQ}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: !ok }}
        onSubmit={() => ok && go(1)}
      >
        <ShortText
          label={copy.nameQ}
          value={d.name}
          onChange={(v) => set({ name: v })}
          max={20}
          placeholder={copy.namePlaceholder}
        />
        {!editing && (
          <div
            className="hg-row"
            role="group"
            aria-label={copy.chipsLabel}
            style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            {CHIPS.map((k) => (
              <Chip
                key={k}
                small
                selected={d.chip === k}
                onClick={() =>
                  set({
                    chip: k,
                    name: k === 'custom' ? d.name : copy.chips[k],
                    yearly: k !== 'event',
                    lunar: FIXED[k]?.lunar ?? false,
                    leap: false,
                  })
                }
              >
                {copy.chips[k]}
              </Chip>
            ))}
          </div>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'c') {
    const ok = !!rule && !!solar && !past;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.dateQ}
        help={name}
        onBack={back}
        later={
          past && solar && !editing
            ? { label: copy.recordPast, onClick: () => void save(0, true) }
            : undefined
        }
        primary={{
          label: editing ? copy.save : copy.nextStep,
          disabled: !ok,
          loading: saving,
        }}
        onSubmit={() => {
          if (!ok) return;
          if (dup && !asked) return setAsked(true);
          if (editing) void save(0);
          else go(i + 1);
        }}
      >
        <Tabs<'solar' | 'lunar'>
          variant="seg"
          label={copy.dateQ}
          value={d.lunar ? 'lunar' : 'solar'}
          onChange={(v) => set({ lunar: v === 'lunar', leap: false })}
          items={[
            { value: 'solar', label: copy.solar },
            { value: 'lunar', label: copy.lunar },
          ]}
        />
        <DateInput
          label={copy.dateQ}
          value={d.date}
          onChange={(date) => {
            setAsked(false);
            set({ date });
          }}
          error={past ? copy.pastDate : d.date && !solar ? copy.dateError : undefined}
        />
        {d.lunar && (
          <Chip small selected={d.leap} onClick={() => set({ leap: !d.leap })}>
            {copy.leapMonth}
          </Chip>
        )}
        <Toggle label={copy.yearly} checked={d.yearly} onChange={(yearly) => set({ yearly })} />
        {dup && asked && (
          <p className="hg-help" role="status">
            {copy.sameDay}
          </p>
        )}
      </QuestionLayout>
    );
  }

  // d: 금액 메모 + 추가하기
  return (
    <QuestionLayout
      steps={progress}
      title={copy.amountQ}
      help={name}
      onBack={back}
      later={{ label: copy.skip, onClick: () => void save(0) }}
      primary={{ label: copy.addOk, loading: saving }}
      onSubmit={() => {
        if (dup && !asked) return setAsked(true);
        void save(d.amount ?? 0);
      }}
    >
      <AmountInput
        label={copy.amountQ}
        value={d.amount}
        onChange={(amount) => set({ amount })}
        quick={quickChips.small}
        allowZero
      />
      {dup && asked && (
        <p className="hg-help" role="status">
          {copy.sameDay}
        </p>
      )}
    </QuestionLayout>
  );
}
