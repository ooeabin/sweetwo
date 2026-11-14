import {
  addSavingItem,
  configureSplitLines,
  fetchSplits,
  qk,
  SavingItemBlocked,
} from '@sweetwo/api';
import {
  amountBand,
  defaultDeadline,
  formatYm,
  leftover,
  quickChips,
  savingChips,
  savingItemInput,
  savingEta,
  savingLate,
  savingNeed,
  thisMonth,
  ymToDate,
  type YearMonth,
} from '@sweetwo/core';
import {
  AmountInput,
  Chip,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
  YearMonthInput,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { money, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { useMe, usePartner, useSpace, useSplits } from '../data';
import { salaryPaths, savingPaths } from '../paths';
import { trackSharedGoal } from '../saving';
import { readDraft, writeDraft, type SavingDraft } from '../saving-draft';
import { W11eAutoAsk } from './w-11e-auto-ask';
import { AFTER_FIRST_SAVING_PATH, clearFirstSaving, markFirstSaving } from '../../onboarding';

// W-11a~d 저금 항목 추가(20, ADR 0007). 한 화면 한 질문: 이름 → 매달 금액 → 목표 금액(건너뛰면 저장) → 기한(건너뛰어도 저장).
// 저장 = add_saving_item(내 월급 계획, 합쳐서면 공동 저금 묶음 맨 아래 + 이번 사이클 체크리스트) → W-10.
// 입력값은 기기에 두고 다시 열면 이어서(20 W-11). 월급 계획이 없거나 해제 대기 중이면 추가할 수 없음.
// W-11c 아래 선택 칸 ‘이미 모은 금액이 있어요’(2026-11-09): 만들 때만 넣는 시작값. 목표 금액보다 적어야 함.
// v2.2(2026-11-13): W-11b 다음, W-11c 앞에 W-11e “은행에서 자동으로 나가요?”(주소 /e)
const STEPS = ['a', 'b', 'e', 'c', 'd'] as const;
type Step = (typeof STEPS)[number];
type Draft = SavingDraft;
// 들어온 곳(32 saving_item_created entry, 2026-11-12 S7-16): home·salary = 첫 저금 빈 줄(홈·W-02), salary_row = W-02 저금 묶음
// ‘+ 저금 추가’ 줄, salary_wide = W-02 넓은 창 제목 줄 버튼, split = W-01, list = W-13, add_menu = 홈 ‘추가’ 메뉴,
// palette = 검색 ‘바로 하기’, shortcut = Ctrl(⌘)+N, onboarding = O-60 ‘첫 저금 만들기’(2026-11-13), 그 밖 direct
const ENTRIES = [
  'home',
  'salary',
  'salary_row',
  'salary_wide',
  'split',
  'palette',
  'list',
  'add_menu',
  'shortcut',
  'onboarding',
  'next',
] as const;
type Entry = (typeof ENTRIES)[number] | 'direct';

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
  const { masked } = useMask();
  const setDraft = (d: Draft) => {
    setDraftState(d);
    writeDraft(d);
  };
  const s = (STEPS as readonly string[]).includes(step) ? (step as Step) : 'a';
  const now = STEPS.indexOf(s);
  const entry: Entry = (ENTRIES as readonly string[]).includes(params.get('from') ?? '')
    ? (params.get('from') as Entry)
    : 'direct';
  const go = (to: Step) => nav(`${savingPaths.add}/${to}${params.size ? `?${params}` : ''}`);
  // 첫 저금 흐름(O-60 뒤)이면 지금 단계를 남겨 둠: 앱을 닫았다 열면 /onboarding/resume → 여기로(2026-11-13 실구동)
  useEffect(() => {
    if (entry === 'onboarding') markFirstSaving(`${savingPaths.add}/${s}?${params}`);
  }, [entry, s, params]);
  const back = () => {
    // 첫 저금 흐름의 첫 화면에서 뒤로 나가면 이어하기를 지움(그만둔 것)
    if (entry === 'onboarding' && s === 'a') clearFirstSaving();
    return window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist);
  };
  const title = {
    a: copy.addNameQ,
    b: copy.addMonthlyQ,
    e: copy.autoQ,
    c: copy.addTargetQ,
    d: copy.addDeadlineQ,
  }[s];
  if (!me.data || !space.data || !splits.data) return <QuestionSkeleton title={title} />;
  const joint = space.data.salary_mode === 'joint';
  const mine = splits.data.find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === me.data?.id,
  );
  // 월급 계획이 없거나(월급 없음) 해제 대기 중이면 추가할 수 없음(20 W-11 예외): W-02로 + Toast(2026-11-12 S7-15).
  // W-02가 그 상태 카드(‘월급 알려 주기’)·회색 한 줄을 보여 줌
  if (!mine || space.data.couple_state === 'unlink_pending')
    return <Blocked text={mine ? copy.addBlocked : copy.addNoSplit} />;
  // 지금 여유 자금(W-11b 보조, 0원 아래면 0원)
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
      start: d.hasStart ? (d.start ?? 0) : 0,
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
        start: v.start,
      });
      // W-11e ‘네, 자동이에요’: 새 저금 줄에 자동 줄 설정(나가는 날, null = 월급날)
      if (d.auto) {
        const line = (await fetchSplits())
          .flatMap((x) => x.split_line)
          .find((l) => l.kind === 'saving' && l.goal_id === id);
        if (line)
          await configureSplitLines([{ id: line.id, autoPay: true, autoDay: d.autoDay }]).catch(
            () => undefined,
          );
      }
      track('saving_item_created', {
        entry,
        monthly_band: amountBand(v.monthly),
        has_target: v.target !== null,
        has_deadline: v.deadline !== null,
        has_start: v.start > 0,
        ...(v.target !== null ? { target_band: amountBand(v.target) } : {}),
      });
      // 같이 쓰는 저금(합쳐서 + 연결, 32 4-6, 2026-11-12 S7-16)
      trackSharedGoal({
        joint,
        joined: space.data?.couple_state === 'connected',
      });
      writeDraft(null);
      if (entry === 'onboarding') clearFirstSaving();
      await Promise.all(
        [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      carryToast(left - v.monthly < 0 ? copy.addShort : copy.added);
      // O-60 ‘첫 저금 만들기’로 왔으면 끝에 미합류 초대 시트(O-07) → A-06 → 홈(16 v2.2, onboarding AFTER_FIRST_SAVING_PATH)
      // 그 밖(20 W-11 고친 점): 미합류면 초대, 각자 계열 연결이면 “{이름}님과 같이 모을까요?”(→ W-15). W-10이 시트로 물음
      const st = space.data?.couple_state;
      const ask = st === 'not_joined' ? 'invite' : !joint && st === 'connected' ? 'bundle' : null;
      nav(
        entry === 'onboarding'
          ? AFTER_FIRST_SAVING_PATH
          : `${savingPaths.item(id)}${ask ? `?ask=${ask}` : ''}`,
        { replace: true },
      );
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
        {/* 이름 칩(19 ‘이름 칩 표’, 2026-11-13): 두 사람 사이마다 3개, 결혼 준비 중이면 ‘결혼 비용’ 맨 앞. 누르면 이름을 채움 */}
        <div
          className="hg-row"
          role="group"
          aria-label={copy.addNameChips}
          style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
        >
          {savingChips(space.data.marriage_status).map((c) => (
            <Chip
              key={c}
              selected={draft.name === copy.chipNames[c]}
              onClick={() => setDraft({ ...draft, name: copy.chipNames[c] })}
            >
              {copy.chipNames[c]}
            </Chip>
          ))}
        </div>
      </QuestionLayout>
    );
  if (!draft.name.trim()) return <Navigate to={`${savingPaths.add}/a`} replace />;
  if (s === 'b') {
    // 처음 값은 빈 칸(필수, 2026-11-09). 여유 자금 전부를 채우지 않음. 빠른 칩은 그 금액으로 바꿈
    const v = draft.monthly;
    return (
      <QuestionLayout
        steps={steps}
        title={copy.addMonthlyQ}
        help={copy.addMonthlyHelp(money(Math.max(left, 0), masked))}
        onBack={back}
        primary={{ label: copy.next, disabled: v === null || v % 10_000 !== 0 }}
        onSubmit={() => go('e')}
      >
        <AmountInput
          label={copy.addMonthlyQ}
          value={v}
          onChange={(x) => setDraft({ ...draft, monthly: x })}
          quick={quickChips.monthly}
          quickSet
          monthly
          allowZero
        />
        {v !== null && v % 10_000 !== 0 && <p className="hg-help">{copy.tenThousandUnit}</p>}
        {/* 매달 금액이 여유 자금보다 크면 사실 한 줄(막지 않음, 2026-11-14) */}
        {v !== null && v > 0 && v > Math.max(left, 0) && (
          <p className="hg-help" role="status">
            {copy.monthlyOverLeft(money(Math.max(left, 0), masked))}
          </p>
        )}
      </QuestionLayout>
    );
  }
  if (draft.monthly === null) return <Navigate to={`${savingPaths.add}/b`} replace />;
  if (s === 'e')
    return (
      <W11eAutoAsk
        steps={steps}
        value={draft.auto}
        day={draft.autoDay}
        payday={me.data.payday}
        onBack={back}
        onChange={(auto, autoDay) => setDraft({ ...draft, auto, autoDay })}
        onNext={() => go('c')}
      />
    );
  // 시작할 때 모은 금액(켰을 때만). 목표 금액 이상이면 막음(서버 bad_start와 같음)
  const start = draft.hasStart ? (draft.start ?? 0) : 0;
  const startOver = draft.target !== null && start >= draft.target;
  if (s === 'c')
    return (
      <QuestionLayout
        steps={steps}
        title={copy.addTargetQ}
        help={copy.addTargetHelp}
        onBack={back}
        primary={{ label: copy.next, disabled: !draft.target || startOver }}
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
          extra={
            <button
              type="button"
              role="checkbox"
              aria-checked={draft.hasStart}
              className="hg-consent__check"
              onClick={() => setDraft({ ...draft, hasStart: !draft.hasStart })}
            >
              <span
                className={draft.hasStart ? 'hg-checkbox is-on' : 'hg-checkbox'}
                aria-hidden="true"
              />
              <span className="hg-consent__label">{copy.addHasStart}</span>
            </button>
          }
          // 이미 모은 금액 칸은 체크 칸 아래, 키패드는 하나로 화면 아래(2026-11-09 round 3, 칸 사이에 끼지 않게)
          second={
            draft.hasStart
              ? {
                  label: copy.addStart,
                  value: draft.start,
                  onChange: (x) => setDraft({ ...draft, start: x }),
                  allowZero: true,
                  error: startOver ? copy.addStartOver : undefined,
                }
              : undefined
          }
        />
      </QuestionLayout>
    );
  if (!draft.target) return <Navigate to={`${savingPaths.add}/c`} replace />;
  // 처음 값 = 1년 뒤(20 W-11d). 휠이 처음 값을 다시 올려도 같은 값
  const ym = (draft.deadline?.slice(0, 7) as YearMonth | undefined) ?? defaultDeadline();
  const err = ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
  const plan = { target: draft.target, saved: start, deadline: ym };
  const need = savingNeed(plan);
  // 월 필요액 > 매달 금액이면 사실 한 줄(2026-11-09, 06 5-4)
  const late = savingLate(plan, draft.monthly ?? 0);
  // v2.2(2026-11-13): 늦어지면 판정 대신 사실 “지금 속도면 …에 다 모아요”
  const eta = savingEta({ target: draft.target, saved: start }, draft.monthly ?? 0);
  return (
    <QuestionLayout
      steps={steps}
      title={copy.addDeadlineQ}
      help={
        need !== null ? (
          <>
            {/* 같이 계열(합쳐서 + 연결)은 둘이 같이 모으는 금액(2026-11-14) */}
            {joint && space.data.couple_state === 'connected'
              ? copy.needPerMonthTogether(money(need, masked))
              : copy.needPerMonth(money(need, masked))}
            {late !== null && eta && (
              <>
                <br />
                {copy.etaAt(formatYm(eta))}
              </>
            )}
          </>
        ) : undefined
      }
      onBack={back}
      primary={{ label: copy.addDone, disabled: !!err, loading: saving }}
      onSubmit={() => void save({ ...draft, deadline: ym })}
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

/** 추가할 수 없을 때 W-02로 옮기며 이유 Toast(다음 화면까지, S7-15) */
function Blocked({ text }: { text: string }) {
  const nav = useNavigate();
  useEffect(() => {
    carryToast(text);
    nav(salaryPaths.checklist, { replace: true });
  }, [text, nav]);
  return <QuestionSkeleton />;
}
