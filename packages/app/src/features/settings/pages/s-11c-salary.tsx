import {
  cancelSalaryChange,
  salaryChangeKeys,
  SalaryChangeBlocked,
  scheduleSalaryChange,
  updateMe,
} from '@sweetwo/api';
import {
  isNonManager,
  quickChips,
  salaryChangeImmediate,
  salaryChangeInput,
  salaryChangeMonthsAhead,
  todayKst,
} from '@sweetwo/core';
import {
  AmountInput,
  Button,
  Chip,
  DayWheel,
  QuestionLayout,
  QuestionSkeleton,
  SectionHeader,
  Toggle,
  YearMonthInput,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeBand, track } from '../../../shared/analytics';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { PlanShareSheet, shareNoteOf } from '../share-sheet';

type Day = number | 'last';

/** 'YYYY-MM' 다음 달 */
const nextMonth = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const ymOf = (ym: string) => ({ y: Number(ym.slice(0, 4)), m: Number(ym.slice(5, 7)) });

// S-11c 내 월급(O-31과 같음, 25 ‘S-11c 날짜를 정한 월급 변경’ v2.2). 본인만.
// 1단계: 금액 + 매달 달라요 + 월급날, 공개 고지 한 줄 + ‘바꾸기’(→ S-13 ① 시트), 관리하지 않는 쪽이면 “보내기도 같이 다시 계산해요”.
// 금액이 바뀌면 2단계 “언제부터 이 금액이에요?”(연·월 휠, 처음 값 이번 달, 칩 ‘이번 달부터’ ‘다음 달부터’) + 선택 “언제까지예요?”
// → schedule_salary_change(이번 사이클이면 서버가 바로 적용, 미래면 예약. 예약은 S-11 월급 줄 아래 회색 + ‘취소’).
// 월급날·매달 달라요만 바뀌면 바로 저장. 저장 → Toast ‘되돌리기’(바로 적용 = 옛 금액으로 다시, 예약 = 예약 취소).
export function S11cSalary() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [day, setDay] = useState<Day | null | undefined>(undefined);
  const [step, setStep] = useState<'amount' | 'when'>('amount');
  const thisMonth = todayKst().slice(0, 7);
  const [from, setFrom] = useState(thisMonth);
  const [hasUntil, setHasUntil] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.me || !d.space) return <QuestionSkeleton />;
  const me = d.me;
  const sp = d.space;
  const value = amount === undefined ? (me.monthly_income ?? null) : amount;
  const isVariable = variable ?? me.income_variable ?? false;
  const savedDay: Day | null = me.payday_last ? 'last' : (me.payday ?? null);
  const payday = day === undefined ? savedDay : day;
  const valid = value !== null && value >= 0 && (value === 0 || payday !== null);
  const amountChanged = value !== null && value !== (me.monthly_income ?? 0);
  const joined = !!d.c?.joined;
  const joint = sp.salary_mode === 'joint';
  const nonManager = isNonManager(sp, me.id);
  const back = () => nav('/settings/me');
  const refresh = () =>
    Promise.all(salaryChangeKeys.map((k) => qc.invalidateQueries({ queryKey: k })));

  const checked = salaryChangeInput(thisMonth).safeParse({
    amount: value ?? 0,
    from,
    until: hasUntil ? until : null,
  });
  const fromErr = checked.success
    ? undefined
    : checked.error.issues.some((i) => i.path[0] === 'from')
      ? copy.fromPast
      : undefined;
  const untilErr =
    !checked.success && checked.error.issues.some((i) => i.path[0] === 'until')
      ? copy.untilBefore
      : undefined;

  /** 월급날·매달 달라요(금액 말고) 저장. 바뀐 게 없으면 아무것도 안 함 */
  const saveFacts = async (income: number, dd: Day | null) => {
    const patch = {
      income_variable: income > 0 && isVariable,
      payday: income > 0 && typeof dd === 'number' ? dd : income > 0 ? null : me.payday,
      payday_last: income > 0 ? dd === 'last' : me.payday_last,
    };
    if (
      patch.income_variable === !!me.income_variable &&
      patch.payday === me.payday &&
      patch.payday_last === !!me.payday_last
    )
      return null;
    const before = {
      income_variable: me.income_variable,
      payday: me.payday,
      payday_last: me.payday_last,
    };
    await updateMe(patch);
    const dayNum = (n: number | null, last: boolean) => (last ? 31 : (n ?? 0));
    const fromDay = dayNum(me.payday, !!me.payday_last);
    const toDay = dayNum(patch.payday, patch.payday_last);
    if (fromDay !== toDay)
      track('fact_value_changed', {
        field: 'payday',
        change_band: changeBand(fromDay, toDay),
        source_screen: 'S-11c',
      });
    return before;
  };

  const save = async () => {
    if (saving || !valid || value === null) return;
    if (amountChanged && step === 'amount') return setStep('when');
    if (amountChanged && !checked.success) return;
    setSaving(true);
    try {
      const before = await saveFacts(value, payday);
      if (!amountChanged) {
        await refresh();
        if (before)
          carryToast(copy.salarySaved, {
            label: copy.undo,
            onClick: () => quietly(updateMe(before).then(refresh)),
          });
        return nav('/settings/me', { replace: true });
      }
      const old = me.monthly_income ?? 0;
      const untilM = hasUntil ? until : null;
      const id = await scheduleSalaryChange({ amount: value, from, until: untilM });
      track('salary_change_scheduled', {
        months_ahead: salaryChangeMonthsAhead(thisMonth, from),
        has_until: !!untilM,
      });
      await refresh();
      const now = salaryChangeImmediate(
        { effective_from: `${from}-01` },
        payday === null ? null : payday,
        todayKst(),
      );
      if (now) {
        // 32 4-5 fact_value_changed(2026-11-12 S11-06)
        track('fact_value_changed', {
          field: 'income',
          change_band: changeBand(old, value),
          source_screen: 'S-11c',
        });
        carryToast(copy.salarySaved, {
          label: copy.undo,
          onClick: () =>
            quietly(
              scheduleSalaryChange({ amount: old, from: thisMonth, until: null }).then(refresh),
            ),
        });
      } else {
        const { y, m } = ymOf(from);
        carryToast(copy.salaryScheduledToast(y, m), {
          label: copy.undo,
          onClick: () => quietly(cancelSalaryChange(id).then(refresh)),
        });
      }
      nav('/settings/me', { replace: true });
    } catch (e) {
      toast(
        e instanceof SalaryChangeBlocked && e.reason === 'bad_month' ? copy.fromPast : copy.failed,
      );
    } finally {
      setSaving(false);
    }
  };

  if (step === 'when')
    return (
      <QuestionLayout
        title={copy.fromQ}
        onBack={() => setStep('amount')}
        primary={{ label: copy.save, disabled: !checked.success, loading: saving }}
        onSubmit={() => void save()}
        note={nonManager ? copy.sendRecalc : undefined}
      >
        <div className="hg-quick" role="group" aria-label={copy.fromLabel}>
          <Chip small selected={from === thisMonth} onClick={() => setFrom(thisMonth)}>
            {copy.fromThis}
          </Chip>
          <Chip
            small
            selected={from === nextMonth(thisMonth)}
            onClick={() => setFrom(nextMonth(thisMonth))}
          >
            {copy.fromNext}
          </Chip>
        </div>
        <YearMonthInput
          key={from}
          label={copy.fromLabel}
          value={from}
          onChange={(v) => v && setFrom(v)}
          minYear={Number(thisMonth.slice(0, 4))}
          maxYear={Number(thisMonth.slice(0, 4)) + 5}
          error={fromErr}
        />
        <Toggle
          label={copy.untilQ}
          checked={hasUntil}
          onChange={(on) => {
            setHasUntil(on);
            if (on && !until) setUntil(from);
          }}
        />
        {hasUntil && (
          <YearMonthInput
            label={copy.untilLabel}
            value={until ?? from}
            onChange={setUntil}
            minYear={Number(thisMonth.slice(0, 4))}
            maxYear={Number(thisMonth.slice(0, 4)) + 5}
            error={untilErr}
          />
        )}
      </QuestionLayout>
    );

  return (
    <>
      <QuestionLayout
        title={copy.salaryQ}
        help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
        onBack={back}
        primary={{
          label: amountChanged ? copy.next : copy.save,
          disabled: !valid,
          loading: saving,
        }}
        onSubmit={() => void save()}
        note={nonManager ? copy.sendRecalc : undefined}
      >
        <AmountInput
          label={copy.salaryQ}
          value={value}
          onChange={setAmount}
          quick={quickChips.small.slice(1)}
          monthly
          embedded
          zeroLink={{ label: copy.noSalary, onClick: () => setAmount(0) }}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={isVariable}
          className="hg-consent__check"
          onClick={() => setVariable(!isVariable)}
        >
          <span className={isVariable ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
          <span className="hg-consent__label">{copy.variable}</span>
        </button>
        <SectionHeader title={copy.payday} />
        <DayWheel
          label={copy.payday}
          value={payday}
          onChange={setDay}
          lastLabel={copy.lastDay}
          hint={copy.paydayLastHint}
        />
        {/* 1번 공개 고지(O-31과 같음). 합류 전이면 볼 사람이 없어 숨김 */}
        {joined && (
          <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <p className="hg-help" style={{ margin: 0, flex: 1 }}>
              {shareNoteOf(joint, me.plan_share)}
            </p>
            {!joint && (
              <Button
                variant="ghost"
                size="sm"
                className="hg-btn--link"
                onClick={() => setSheet(true)}
              >
                {copy.change}
              </Button>
            )}
          </div>
        )}
      </QuestionLayout>
      {sheet && <PlanShareSheet me={me} screenId="S-11c" onClose={() => setSheet(false)} />}
    </>
  );
}
