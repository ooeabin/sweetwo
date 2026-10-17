import { insertCareDays, qk } from '@sweetwo/api';
import { lunarToSolar, quickChips } from '@sweetwo/core';
import {
  AmountInput,
  Chip,
  ChoiceCards,
  DateInput,
  QuestionLayout,
  ShortText,
  Tabs,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-07 챙길 날 추가(docs/spec/24-calendar.md Y-07, 화면별 정의): a 어떤 날 → b 누구의 날(가족 목록 / 직접 입력)
// → c 날짜(년·월·일 + 양력/음력, 달력에서 열면 채워짐) → d 얼마쯤(종류별 양가 예산 단가 채움, 0원 허용) → ‘추가하기’ 바로 저장 → Y-01.
// 고르는 날은 모두 행사라 반복 ‘한 번’, 미리 알림 D-30 + D-7, 챙길 사람 ‘같이’(Y-05에서 바꿈).
// 지난 날짜는 “이미 지난 날이에요. 기록으로 남길까요?” + ‘기록으로 남기기’(쓸 돈 0원으로 만들고 → Y-08).
// ‘결혼 준비 결제’(예비부부, G-07a)와 배우자 생일 서프라이즈는 다음 단계.

type Kind = keyof typeof copy.kinds;
const KINDS = Object.keys(copy.kinds) as Kind[];
const DIRECT = 'direct';
interface Draft {
  kind: Kind | null;
  who: string | null; // 가족 id 또는 DIRECT
  name: string;
  date: string | null;
  lunar: boolean;
  leap: boolean;
  budget: number | null;
}
const start = (date: string | null = null): Draft => ({
  kind: null,
  who: null,
  name: '',
  date,
  lunar: false,
  leap: false,
  budget: null,
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void }>((set, get) => ({
  d: start(),
  set: (p) => set({ d: { ...get().d, ...p } }),
}));
/** 챙길 날 추가 시작(‘+ 추가’, 달력 고른 날) */
export const startCareAdd = (date: string | null = null) => useDraft.getState().set(start(date));

const STEPS = ['a', 'b', 'c', 'd'];

export function Y07CareAdd() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const step = useParams().step ?? 'a';
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  if (c.loading) return null;
  const i = Math.max(STEPS.indexOf(step), 0);
  const progress = { total: STEPS.length, now: i };
  const go = (n: number) => nav(`/calendar/add/${STEPS[n] ?? 'a'}`);
  const back = () => (i > 0 ? go(i - 1) : nav(-1));
  const member = c.family.find((m) => m.id === d.who);
  const sideName = (s: 'groom' | 'bride') =>
    copy.side(s === 'groom' ? c.names.groom : c.names.bride);
  // 음력이면 그 해 음력 날짜의 양력
  const solar =
    d.date && d.lunar
      ? lunarToSolar(
          Number(d.date.slice(0, 4)),
          Number(d.date.slice(5, 7)),
          Number(d.date.slice(8, 10)),
          d.leap,
        )
      : d.date;

  if (step !== 'a' && !d.kind) return <Navigate to="/calendar/add/a" replace />;

  const kind = d.kind ?? 'other';
  const budget = d.budget ?? c.unitOf(kind);
  const who = member?.title ?? d.name.trim();
  /** 저장. 지난 날이면 바로 기록(Y-08)으로 */
  const save = async (on: string, amount: number, record = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const [id] = await insertCareDays([
        {
          category: member ? 'family' : 'couple',
          kind,
          name: kind === 'other' && who ? who : copy.names.of(who, copy.kinds[kind]),
          member_id: member?.id ?? null,
          side: member?.side ?? null,
          date_rule: 'once',
          once_on: on,
          budget: amount,
        },
      ]);
      await qc.invalidateQueries({ queryKey: qk.careDays });
      // 초안은 다음 시작(startCareAdd)에서 비움(여기서 비우면 a로 되돌아감)
      if (record && id) nav(`/calendar/day/${id}/record/a?on=${on}`, { replace: true });
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

  if (step === 'a')
    return (
      <QuestionLayout steps={progress} title={copy.addKindQ} onBack={back}>
        <ChoiceCards<Kind>
          label={copy.addKindQ}
          value={d.kind}
          onChange={(kind) => set({ kind, budget: null })}
          onPick={() => go(1)}
          options={KINDS.map((k) => ({ value: k, label: copy.kinds[k] }))}
        />
      </QuestionLayout>
    );

  if (step === 'b') {
    const ok = d.who !== null && (d.who !== DIRECT || !!d.name.trim());
    return (
      <QuestionLayout
        steps={progress}
        title={copy.addWhoQ}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: !ok }}
        onSubmit={() => ok && go(2)}
      >
        <ChoiceCards<string>
          label={copy.addWhoQ}
          value={d.who}
          onChange={(who) => set({ who })}
          onPick={(who) => who !== DIRECT && go(2)}
          options={[
            ...c.family.map((m) => ({ value: m.id, label: m.title, sub: sideName(m.side) })),
            { value: DIRECT, label: copy.direct },
          ]}
        />
        {d.who === DIRECT && (
          <ShortText
            label={copy.direct}
            value={d.name}
            onChange={(name) => set({ name })}
            max={15}
          />
        )}
      </QuestionLayout>
    );
  }

  if (step === 'c') {
    const past = !!solar && solar < c.today;
    const ok = !!solar && !past;
    return (
      <QuestionLayout
        steps={progress}
        title={copy.addDateQ}
        onBack={back}
        later={
          past && solar
            ? { label: copy.recordPast, onClick: () => void save(solar, 0, true) }
            : undefined
        }
        primary={{ label: copy.nextStep, disabled: !ok }}
        onSubmit={() => ok && go(3)}
      >
        <Tabs<'solar' | 'lunar'>
          variant="seg"
          label={copy.addDateQ}
          value={d.lunar ? 'lunar' : 'solar'}
          onChange={(v) => set({ lunar: v === 'lunar', leap: false })}
          items={[
            { value: 'solar', label: copy.solar },
            { value: 'lunar', label: copy.lunar },
          ]}
        />
        <DateInput
          label={copy.addDateQ}
          value={d.date}
          onChange={(date) => set({ date })}
          error={past ? copy.pastDate : d.date && !solar ? copy.dateError : undefined}
        />
        {d.lunar && (
          <Chip small selected={d.leap} onClick={() => set({ leap: !d.leap })}>
            {copy.leapMonth}
          </Chip>
        )}
      </QuestionLayout>
    );
  }

  // d: 얼마쯤 + 추가하기
  return (
    <QuestionLayout
      steps={progress}
      title={copy.budgetQ}
      onBack={back}
      primary={{ label: copy.addOk, loading: saving }}
      onSubmit={() => solar && void save(solar, budget)}
    >
      <AmountInput
        label={copy.budgetQ}
        value={budget}
        onChange={(v) => set({ budget: v })}
        quick={quickChips.small}
        allowZero
      />
    </QuestionLayout>
  );
}
