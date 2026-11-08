import { addSavingItem, qk, SavingItemBlocked } from '@sweetwo/api';
import {
  amountBand,
  leftover,
  readWon,
  savingItemInput,
  savingNeed,
  thisMonth,
  ymToDate,
  type YearMonth,
} from '@sweetwo/core';
import {
  AmountInput,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
  YearMonthInput,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useMe, usePartner, useSpace, useSplits } from '../data';
import { salaryPaths, savingPaths } from '../paths';

// W-11a~d 저금 항목 추가(20, ADR 0007). 한 화면 한 질문: 이름 → 매달 금액 → 목표 금액(건너뛰면 저장) → 기한(건너뛰어도 저장).
// 저장 = add_saving_item(내 월급 계획, 합쳐서면 공동 저금 묶음 맨 아래 + 이번 사이클 체크리스트) → W-10.
// 입력값은 기기에 두고 다시 열면 이어서(20 W-11). 월급 계획이 없거나 해제 대기 중이면 추가할 수 없음.
const STEPS = ['a', 'b', 'c', 'd'] as const;
type Step = (typeof STEPS)[number];
const KEY = 'sweetwo.savingDraft';
type Draft = {
  name: string;
  monthly: number | null;
  target: number | null;
  deadline: string | null;
};
const EMPTY: Draft = { name: '', monthly: null, target: null, deadline: null };
const readDraft = (): Draft => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Draft> | null;
    return { ...EMPTY, ...(v ?? {}) };
  } catch {
    return EMPTY;
  }
};
const writeDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch {
    /* 기억 못 해도 이번 화면은 그대로 */
  }
};
const ENTRIES = ['home', 'salary', 'split', 'palette'] as const;
type Entry = (typeof ENTRIES)[number];

export function W11SavingAdd() {
  const { step = 'a' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const splits = useSplits();
  const [draft, setDraftState] = useState<Draft>(readDraft);
  const [saving, setSaving] = useState(false);
  const setDraft = (d: Draft) => {
    setDraftState(d);
    writeDraft(d);
  };
  const s = (STEPS as readonly string[]).includes(step) ? (step as Step) : 'a';
  const now = STEPS.indexOf(s);
  const entry: Entry = (ENTRIES as readonly string[]).includes(params.get('from') ?? '')
    ? (params.get('from') as Entry)
    : 'salary';
  const go = (to: Step) => nav(`${savingPaths.add}/${to}${params.size ? `?${params}` : ''}`);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  const title = { a: copy.addNameQ, b: copy.addMonthlyQ, c: copy.addTargetQ, d: copy.addDeadlineQ }[
    s
  ];
  if (!me.data || !space.data || !splits.data) return <QuestionSkeleton title={title} />;
  const joint = space.data.salary_mode === 'joint';
  const mine = splits.data.find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === me.data?.id,
  );
  // 월급 계획이 없거나(월급 없음) 해제 대기 중이면 추가할 수 없음(20 W-11, 예외)
  if (!mine || space.data.couple_state === 'unlink_pending')
    return (
      <QuestionLayout
        title={mine ? copy.addBlocked : copy.addNoSplit}
        onBack={() => nav(salaryPaths.checklist)}
      />
    );
  // 지금 남는 돈(W-11b 보조, 0원 아래면 0원)
  const income = joint
    ? (me.data.monthly_income ?? 0) + (partner.data?.monthly_income ?? 0)
    : (me.data.monthly_income ?? 0);
  const left = leftover(
    income,
    mine.split_line.map((l) => ({ amount: l.amount })),
  );

  const save = async (d: Draft) => {
    if (saving) return;
    const input = savingItemInput().safeParse({
      name: d.name,
      monthly: d.monthly ?? 0,
      target: d.target,
      deadline: d.target !== null ? (d.deadline?.slice(0, 7) ?? null) : null,
    });
    if (!input.success) return;
    setSaving(true);
    try {
      const v = input.data;
      const id = await addSavingItem({
        name: v.name,
        monthly: v.monthly,
        target: v.target,
        deadline: v.deadline ? ymToDate(v.deadline) : null,
      });
      track('saving_item_created', {
        entry,
        monthly_band: amountBand(v.monthly),
        has_target: v.target !== null,
        has_deadline: v.deadline !== null,
        ...(v.target !== null ? { target_band: amountBand(v.target) } : {}),
      });
      writeDraft(null);
      await Promise.all(
        [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      toast(left - v.monthly < 0 ? copy.addShort : copy.added);
      nav(savingPaths.item(id), { replace: true });
    } catch (e) {
      toast(
        e instanceof SavingItemBlocked
          ? e.reason === 'unlink_pending'
            ? copy.addBlocked
            : copy.addNoSplit
          : copy.failed,
      );
    } finally {
      setSaving(false);
    }
  };
  const steps = { total: STEPS.length, now };

  if (s === 'a')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.addNameQ}
        help={copy.addNameHelp}
        onBack={back}
        primary={{ label: copy.next, disabled: !draft.name.trim() }}
        onSubmit={() => go('b')}
      >
        <ShortText
          label={copy.addNameQ}
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v })}
          max={20}
          placeholder={copy.addNamePlaceholder}
        />
      </QuestionLayout>
    );
  if (!draft.name.trim()) return <Navigate to={`${savingPaths.add}/a`} replace />;
  if (s === 'b') {
    const v = draft.monthly ?? Math.max(Math.floor(left / 10_000) * 10_000, 0);
    return (
      <QuestionLayout
        steps={steps}
        title={copy.addMonthlyQ}
        help={copy.addMonthlyHelp(readWon(Math.max(left, 0)))}
        onBack={back}
        primary={{ label: copy.next, disabled: v % 10_000 !== 0 }}
        onSubmit={() => {
          setDraft({ ...draft, monthly: v });
          go('c');
        }}
      >
        <AmountInput
          label={copy.addMonthlyQ}
          value={v}
          onChange={(x) => setDraft({ ...draft, monthly: x ?? 0 })}
          monthly
          allowZero
        />
        {v % 10_000 !== 0 && <p className="hg-help">{copy.tenThousandUnit}</p>}
      </QuestionLayout>
    );
  }
  if (s === 'c')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.addTargetQ}
        help={copy.addTargetHelp}
        onBack={back}
        primary={{ label: copy.next, disabled: !draft.target }}
        onSubmit={() => go('d')}
        later={{
          label: copy.addNoTarget,
          loading: saving,
          onClick: () => void save({ ...draft, target: null, deadline: null }),
        }}
      >
        <AmountInput
          label={copy.addTargetQ}
          value={draft.target}
          onChange={(x) => setDraft({ ...draft, target: x && x > 0 ? x : null })}
        />
      </QuestionLayout>
    );
  if (!draft.target) return <Navigate to={`${savingPaths.add}/c`} replace />;
  const ym = (draft.deadline?.slice(0, 7) as YearMonth | undefined) ?? null;
  const err = ym && ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
  const need = ym ? savingNeed({ target: draft.target, saved: 0, deadline: ym }) : null;
  return (
    <QuestionLayout
      steps={steps}
      title={copy.addDeadlineQ}
      help={need !== null ? copy.needPerMonth(readWon(need)) : undefined}
      onBack={back}
      primary={{ label: copy.addDone, disabled: !ym || !!err, loading: saving }}
      onSubmit={() => void save(draft)}
      later={{
        label: copy.addNoDeadline,
        loading: saving,
        onClick: () => void save({ ...draft, deadline: null }),
      }}
    >
      <YearMonthInput
        label={copy.addDeadlineQ}
        value={ym}
        onChange={(x) => setDraft({ ...draft, deadline: x })}
        error={err}
      />
    </QuestionLayout>
  );
}
