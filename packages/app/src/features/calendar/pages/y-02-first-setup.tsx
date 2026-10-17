import { insertCareDays, insertFamily, insertGoal, propose, qk } from '@sweetwo/api';
import {
  familyCostMonthly,
  monthsUntil,
  nextAnniversary,
  proposalApplyOn,
  quickChips,
  readWon,
  spaceBaseDay,
} from '@sweetwo/core';
import { AmountInput, Chip, Field, QuestionLayout, Tabs } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-02 처음 등록(docs/spec/24-calendar.md 화면별 정의): a 양가 부모님 4분(체크) → b 체크한 분마다 생신(월·일, 양력/음력)
// → c 명절 양가 합계 → d 생신 한 분 단가 → e “1년에 {금액}이에요. 매달 {월 적립}씩 모아두면 돼요” + ‘이대로 하기’.
// 저장: 가족, 생신·설·추석·어버이날(0원)·결혼기념일(0원) 챙길 날, 신혼이면 ‘양가 비용’ 매년 목표(연결된 부부는 제안).
// 예비부부는 예산만(목표 없음). ‘고치기’(Y-06)는 다음 단계.

type Side = 'groom' | 'bride';
interface Parent {
  key: string;
  side: Side;
  title: string;
  checked: boolean;
  month: number | null;
  day: number | null;
  lunar: boolean;
  leap: boolean;
}
interface Draft {
  parents: Parent[];
  holiday: number | null;
  birthday: number | null;
}
const start = (): Draft => ({
  parents: (['groom', 'bride'] as const).flatMap((side) =>
    [copy.father, copy.mother].map((title, i) => ({
      key: `${side}-${i}`,
      side,
      title,
      checked: true,
      month: null,
      day: null,
      lunar: false,
      leap: false,
    })),
  ),
  holiday: null,
  birthday: null,
});
const useDraft = create<{ d: Draft; set: (p: Partial<Draft>) => void; reset: () => void }>(
  (set, get) => ({
    d: start(),
    set: (p) => set({ d: { ...get().d, ...p } }),
    reset: () => set({ d: start() }),
  }),
);

export function Y02FirstSetup() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const step = useParams().step ?? 'a';
  const c = useCalendarData();
  const { d, set, reset } = useDraft();
  const [saving, setSaving] = useState(false);
  if (c.loading) return null;
  if (c.cares.length && step === 'a') return <Navigate to="/calendar/list" replace />;
  const checked = d.parents.filter((p) => p.checked);
  const steps = ['a', ...checked.map((p) => `b-${p.key}`), 'c', 'd', 'e'];
  const i = Math.max(steps.indexOf(step), 0);
  const progress = { total: steps.length, now: i };
  const go = (n: number) => nav(`/calendar/setup/${steps[n] ?? 'a'}`);
  const back = () => (i > 0 ? go(i - 1) : nav('/calendar/list'));
  const sideName = (s: Side) => copy.side(s === 'groom' ? c.names.groom : c.names.bride);
  const setParent = (key: string, p: Partial<Parent>) =>
    set({ parents: d.parents.map((x) => (x.key === key ? { ...x, ...p } : x)) });

  if (step === 'a')
    return (
      <QuestionLayout
        steps={progress}
        title={copy.setupParents}
        onBack={back}
        primary={{ label: copy.nextStep, disabled: !checked.length }}
        onSubmit={() => checked.length && go(1)}
      >
        {(['groom', 'bride'] as const).map((s) => (
          <div key={s} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <span className="hg-card__label">{sideName(s)}</span>
            <div
              className="hg-row"
              role="group"
              aria-label={sideName(s)}
              style={{ gap: 'var(--space-2)' }}
            >
              {d.parents
                .filter((p) => p.side === s)
                .map((p) => (
                  <Chip
                    key={p.key}
                    selected={p.checked}
                    onClick={() => setParent(p.key, { checked: !p.checked })}
                  >
                    {p.title}
                  </Chip>
                ))}
            </div>
          </div>
        ))}
      </QuestionLayout>
    );

  if (step.startsWith('b-')) {
    const p = d.parents.find((x) => `b-${x.key}` === step);
    if (!p) return <Navigate to="/calendar/setup/a" replace />;
    const bad =
      (p.month !== null && (p.month < 1 || p.month > 12)) ||
      (p.day !== null && (p.day < 1 || p.day > (p.lunar ? 30 : 31)));
    const num = (v: string) => {
      const n = v.replace(/\D/g, '').slice(0, 2);
      return n ? Number(n) : null;
    };
    return (
      <QuestionLayout
        steps={progress}
        title={copy.birthdayOf(p.title)}
        help={sideName(p.side)}
        onBack={back}
        later={{
          label: copy.later,
          onClick: () => {
            setParent(p.key, { month: null, day: null });
            go(i + 1);
          },
        }}
        primary={{ label: copy.nextStep, disabled: p.month === null || p.day === null || bad }}
        onSubmit={() => p.month !== null && p.day !== null && !bad && go(i + 1)}
      >
        <Tabs<'solar' | 'lunar'>
          variant="seg"
          label={copy.birthdayOf(p.title)}
          value={p.lunar ? 'lunar' : 'solar'}
          onChange={(v) => setParent(p.key, { lunar: v === 'lunar', leap: false })}
          items={[
            { value: 'solar', label: copy.solar },
            { value: 'lunar', label: copy.lunar },
          ]}
        />
        <div className="hg-fields">
          <Field
            label={copy.month}
            inputMode="numeric"
            value={p.month ?? ''}
            onChange={(e) => setParent(p.key, { month: num(e.target.value) })}
          />
          <Field
            label={copy.day}
            inputMode="numeric"
            value={p.day ?? ''}
            onChange={(e) => setParent(p.key, { day: num(e.target.value) })}
            error={bad ? copy.dateError : undefined}
          />
        </div>
        {p.lunar && (
          <Chip small selected={p.leap} onClick={() => setParent(p.key, { leap: !p.leap })}>
            {copy.leapMonth}
          </Chip>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'c' || step === 'd') {
    const k = step === 'c' ? 'holiday' : 'birthday';
    const title = step === 'c' ? copy.holidayQ : copy.birthdayQ;
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        help={step === 'c' ? copy.holidayHelp : undefined}
        onBack={back}
        later={{
          label: copy.unsure,
          onClick: () => {
            set({ [k]: 0 });
            go(i + 1);
          },
        }}
        primary={{ label: copy.nextStep, disabled: d[k] === null }}
        onSubmit={() => d[k] !== null && go(i + 1)}
      >
        <AmountInput
          key={k}
          label={title}
          value={d[k]}
          onChange={(v) => set({ [k]: v })}
          quick={quickChips.small}
          allowZero
        />
      </QuestionLayout>
    );
  }

  // e: 요약 + 저장
  const sp = c.space;
  const engaged = sp?.marriage_status === 'engaged';
  const holiday = d.holiday ?? 0;
  const birthday = d.birthday ?? 0;
  const total = holiday * 2 + birthday * checked.length;
  const anniversary = nextAnniversary(engaged ? null : (sp?.wedding_date ?? null), c.today);
  const monthly = familyCostMonthly({
    total,
    monthsLeft: anniversary ? monthsUntil(c.today, anniversary) : 12,
  });
  const connected = sp?.couple_state === 'connected';

  const save = async () => {
    if (saving || !sp) return;
    setSaving(true);
    try {
      const ids = await insertFamily(
        checked.map((p, n) => ({
          side: p.side,
          relation: 'parent' as const,
          title: p.title,
          birth_month: p.month,
          birth_day: p.day,
          birth_lunar: p.lunar,
          birth_leap: p.leap,
          sort: n,
        })),
      );
      await insertCareDays([
        ...checked.map((p, n) => ({
          category: 'family' as const,
          kind: 'birthday',
          name: copy.names.birthday(p.title),
          member_id: ids[n] ?? null,
          side: p.side,
          date_rule: p.lunar ? ('lunar_yearly' as const) : ('solar_yearly' as const),
          month: p.month,
          day: p.day,
          leap: p.leap,
          budget: birthday,
          carer: p.side,
        })),
        ...[
          { kind: 'seollal', name: copy.names.seollal, month: 1, day: 1 },
          { kind: 'chuseok', name: copy.names.chuseok, month: 8, day: 15 },
        ].map((h) => ({
          category: 'family' as const,
          kind: h.kind,
          name: h.name,
          date_rule: 'lunar_yearly' as const,
          month: h.month,
          day: h.day,
          budget: holiday,
        })),
        {
          category: 'family' as const,
          kind: 'parents_day',
          name: copy.names.parentsDay,
          date_rule: 'solar_yearly' as const,
          month: 5,
          day: 8,
        },
        ...(sp.wedding_date && !engaged
          ? [
              {
                category: 'couple' as const,
                kind: 'anniversary',
                name: copy.names.anniversary,
                date_rule: 'solar_yearly' as const,
                month: Number(sp.wedding_date.slice(5, 7)),
                day: Number(sp.wedding_date.slice(8, 10)),
              },
            ]
          : []),
      ]);
      // 신혼: ‘양가 비용’ 매년 목표(연결된 부부는 제안). 예비부부는 예산만
      if (!engaged && total > 0) {
        const goal = {
          template: 'family_cost',
          name: copy.familyCost,
          kind: 'yearly' as const,
          owner: 'together' as const,
          target_amount: total,
          deadline: anniversary,
        };
        const base = c.couple ? spaceBaseDay(sp, c.couple) : null;
        if (connected && base !== null) {
          await propose('goal_add', goal, proposalApplyOn(base));
          toast(copy.proposedFamily(c.couple?.partnerName ?? ''));
        } else {
          const priority = Math.max(0, ...c.goals.map((g) => g.priority)) + 1;
          await insertGoal({ ...goal, priority });
        }
      }
      await Promise.all(
        [qk.family, qk.careDays, qk.goals, qk.proposals].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      reset();
      toast(copy.saved);
      nav('/calendar/list', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={progress}
      title={
        engaged
          ? copy.summaryEngaged(readWon(total))
          : copy.summary(readWon(total), readWon(monthly))
      }
      help={copy.summaryHelp}
      onBack={back}
      primary={{ label: copy.ok, loading: saving }}
      onSubmit={() => void save()}
    />
  );
}
