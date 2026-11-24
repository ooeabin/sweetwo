import { insertCareDays, qk, updateCareDay, type CareDay } from '@sweetwo/api';
import { lunarToSolar, nextCareDate, quickChips, todayKst } from '@sweetwo/core';
import {
  Chip,
  DateField,
  FormAmount,
  FormScreen,
  FormSection,
  ShortText,
  Toggle,
  QuestionSkeleton,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { careUndo, trackCareShared, useCalendarData } from '../data';
import { onSessionReset } from '../../../shared/session-reset';

// Y-07 경조사 추가(24 Y-07, 화면별 정의, 재기획): 2026-11-24 한 화면 입력(FormScreen). 아래 a·c·d는 한 화면 안 세 질문 섹션(이름, 날짜, 금액 메모)이 됨.
// a “어떤 날이에요?” 이름(최대 20자) + 이름 칩(이름·날짜·반복 기본값만 채움, 종류를 나누지 않음)
// → c “언제예요?” 날짜 + 양력/음력 + “매년 돌아와요”(설날·추석·어버이날은 날짜를 채우고 건너뜀)
// → d “쓸 금액을 메모해 둘까요?” 금액 메모(0원·빈 값, 건너뛰기) → ‘추가하기’ 바로 저장(미리 알림 D-30 + D-7) → Y-04.
// 한 번인 지난 날짜는 회색 안내 “이미 지난 날이에요” + 아래 주 버튼이 “기록하기”로 바뀌어 → Y-08(2026-11-24 구역 4). 같은 이름·같은 날짜가 있으면 한 번 확인.
// 수정(Y-05 ‘수정’)은 같은 a → c 화면에서 이름·날짜만 고치고 ‘저장’.

type ChipKey = keyof typeof copy.chips;
/**
 * 이름 칩(24 ‘이름 칩 기본값’, 2026-11-24 구역 4): ‘결혼기념일’은 두 사람 사이가 결혼했어요·결혼 준비 중일 때만,
 * 그 밖(연애 중이에요·같이 살아요·아직 안 정함)은 맨 앞에 ‘사귄 날’(kind `dating_anniversary`, 매년)
 */
const chipsFor = (marriage: string | null | undefined): ChipKey[] => {
  const wed = marriage === 'married' || marriage === 'engaged';
  return [
    ...(wed ? [] : (['dating_anniversary'] as const)),
    'birthday',
    ...(wed ? (['anniversary'] as const) : []),
    'seollal',
    'chuseok',
    'parents_day',
    'event',
    'custom',
  ];
};
/** 칩 기본값(24 ‘이름 칩 기본값’): 날짜를 정하는 칩은 c를 건너뜀 */
const FIXED: Partial<Record<ChipKey, { lunar: boolean; month: number; day: number }>> = {
  seollal: { lunar: true, month: 1, day: 1 },
  chuseok: { lunar: true, month: 8, day: 15 },
  parents_day: { lunar: false, month: 5, day: 8 },
};
interface Draft {
  /** 고친다면 그 경조사 id */
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
// 로그아웃하면 입력 중이던 경조사 이름·날짜를 비움(2026-11-12 QA 11구간 S11-08)
onSessionReset(() => useDraft.setState({ d: start() }));
/** 경조사 추가 시작(‘+ 추가’, 달력 고른 날) */
export const startCareAdd = (date: string | null = null) => useDraft.getState().set(start(date));
/** 경조사 수정 시작(Y-05 ‘수정’): 이름과 날짜(다음 회차 날짜, 음력이면 음력 원본) */
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
  dating_anniversary: 'dating_anniversary',
  seollal: 'seollal',
  chuseok: 'chuseok',
  parents_day: 'parents_day',
  event: 'event',
  custom: 'custom',
};

export function Y07CareAdd() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const c = useCalendarData();
  const { d, set } = useDraft();
  const [saving, setSaving] = useState(false);
  /** 같은 날 확인을 한 번 보여 줬음(다시 누르면 그대로 진행) */
  const [asked, setAsked] = useState(false);
  // 처음 값은 오늘(예전 휠이 처음 위치를 바로 답으로 알리던 것과 같음, 날짜를 정하는 칩이 아닐 때)
  useEffect(() => {
    if (!d.date && !d.editId && !(d.chip && FIXED[d.chip])) set({ date: todayKst() });
  }, [d.date, d.editId, d.chip, set]);
  if (c.loading) return <QuestionSkeleton />;
  const editing = d.editId ? c.cares.find((x) => x.id === d.editId) : null;
  const fixed = d.chip ? FIXED[d.chip] : undefined;
  if (editing === undefined && d.editId) return <Navigate to="/calendar" replace />;

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
        // 2026-11-12 S9-04 Toast ‘되돌리기’: 고치기 전 이름·날짜로
        const prev = {
          name: editing.name,
          date_rule: editing.date_rule,
          month: editing.month,
          day: editing.day,
          leap: editing.leap,
          once_on: editing.once_on,
        };
        await updateCareDay(editing.id, { name, ...rule });
        await qc.invalidateQueries({ queryKey: qk.careDays });
        carryToast(copy.edited, careUndo(qc, editing.id, prev));
        nav(`/calendar/day/${editing.id}`, { replace: true });
        return;
      }
      const [id] = await insertCareDays([
        { category: 'couple', kind: KIND[d.chip ?? 'custom'], name, budget: amount, ...rule },
      ]);
      await qc.invalidateQueries({ queryKey: qk.careDays });
      trackCareShared(!!c.couple?.joined); // 상대 알림이 감(32 4-6, S9-05)
      // 초안은 다음 시작(startCareAdd)에서 비움(여기서 비우면 a로 되돌아감)
      if (record && id && rule.once_on)
        nav(`/calendar/day/${id}/record/a?on=${rule.once_on}`, { replace: true });
      else {
        carryToast(copy.saved);
        nav('/calendar', { replace: true });
      }
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  // 지난 날짜(한 번)면 저장 대신 ‘기록하기’(경조사를 넣고 Y-08로). 고치는 중에는 지난 날로 못 바꿈
  const recordMode = past && !editing;
  const ok = !!name && (fixed ? true : !!rule && !!solar && (!past || recordMode));
  const submit = () => {
    if (!ok) return;
    if (recordMode) return void save(0, true);
    if (dup && !asked) return setAsked(true);
    void save(editing ? 0 : (d.amount ?? 0));
  };

  return (
    <FormScreen
      title={editing ? copy.formTitleEdit : copy.formTitle}
      onBack={() => nav(-1)}
      primary={{
        label: recordMode ? copy.recordNow : editing ? copy.save : copy.addOk,
        disabled: !ok,
        loading: saving,
      }}
      onSubmit={submit}
    >
      <FormSection title={copy.nameQ}>
        <ShortText
          label={copy.nameQ}
          value={d.name}
          onChange={(v) => set({ name: v })}
          max={20}
          placeholder={copy.namePlaceholder}
          autoFocus={false}
        />
        {!editing && (
          <div className="hg-form__chips" role="group" aria-label={copy.chipsLabel}>
            {chipsFor(c.space?.marriage_status).map((k) => (
              <Chip
                key={k}
                small
                selected={d.chip === k}
                onClick={() => {
                  setAsked(false);
                  set({
                    chip: k,
                    name: k === 'custom' ? d.name : copy.chips[k],
                    yearly: k !== 'event',
                    lunar: FIXED[k]?.lunar ?? false,
                    leap: false,
                  });
                }}
              >
                {copy.chips[k]}
              </Chip>
            ))}
          </div>
        )}
      </FormSection>
      {!fixed && (
        <FormSection title={copy.dateQ}>
          {/* 2026-11-24 날짜는 한 줄 + 달력 시트(DateField, 양력/음력은 시트 맨 위). 처음 값은 달력에서 고른 날 또는 오늘 */}
          <DateField
            label={copy.dateQ}
            value={d.date}
            today={todayKst()}
            minYear={1940}
            maxYear={Number(todayKst().slice(0, 4)) + 10}
            calendar={{ lunar: d.lunar, leap: d.leap }}
            sub={d.lunar ? (d.leap ? `${copy.lunar} ${copy.leapMonth}` : copy.lunar) : copy.solar}
            invalid={!!d.date && !solar}
            onChange={(v, cal) => {
              setAsked(false);
              set({ date: v, lunar: cal?.lunar ?? d.lunar, leap: cal?.leap ?? false });
            }}
            below={
              d.date && !solar ? (
                <p className="hg-help is-error" role="alert">
                  {copy.dateError}
                </p>
              ) : past ? (
                <p className="hg-help" role="status">
                  {copy.pastDate}
                </p>
              ) : undefined
            }
          />
          <Toggle label={copy.yearly} checked={d.yearly} onChange={(yearly) => set({ yearly })} />
        </FormSection>
      )}
      {!editing && (
        <FormSection title={copy.amountQ}>
          <FormAmount
            label={copy.amountQ}
            sheetTitle={copy.amountQ}
            value={d.amount}
            onChange={(amount) => set({ amount })}
            quick={quickChips.small}
            monthly={false}
          />
        </FormSection>
      )}
      {dup && asked && (
        <p className="hg-help" role="status">
          {copy.sameDay}
        </p>
      )}
    </FormScreen>
  );
}
