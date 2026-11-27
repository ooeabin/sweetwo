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
  planInputCheck,
  quickChips,
  savingChipGroups,
  savingChips,
  savingItemInput,
  savingEta,
  savingLate,
  savingNeed,
  thisMonth,
  ymToDate,
  type SavingChip,
  type YearMonth,
} from '@sweetwo/core';
import {
  AmountInput,
  BottomSheet,
  Button,
  Chip,
  FormAmount,
  FormFold,
  FormFolds,
  FormHero,
  FormScreen,
  FormSection,
  QuestionSkeleton,
  ShortText,
  YearMonthField,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { money, useMask } from '../../../shared/mask';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace, useSplits } from '../data';
import { useEnsureSplit } from '../ensure-split';
import { salaryPaths, savingPaths } from '../paths';
import { readDraft, writeDraft, type SavingDraft } from '../saving-draft';
import { baseDayOf } from '../cycle';
import { formHero, savingFormReady } from '../form-logic';
import { NameChipGroups } from '../name-chips';
import { LineModeBody, PlanLeftHint } from '../receipt-parts';
import { trackSharedGoal, useSavingItems } from '../saving';
import { useHardwareBack } from '../../auth';
import {
  AFTER_FIRST_SAVING_PATH,
  clearFirstSaving,
  markFirstSaving,
  ONBOARDING_READY_PATH,
} from '../../onboarding';

// W-11 저금 항목 추가(20, ADR 0007, 2026-11-23 한 화면 입력 FormScreen). 예전 W-11a~e 단계(이름 → 매달 → 자동 → 목표 금액 → 기한)를 한 화면으로:
// 맨 위 요약 문장(고르는 대로 바뀜) + “무엇을 모아요?” 칩 + “매달 얼마씩?” + “어떻게 챙겨요?” 구간 + 접힌 선택 줄(목표 금액, 기한, 이미 모은 금액) + 아래 “추가하기”.
// 저장 = add_saving_item(내 월급 계획, 합쳐서면 공동 저금 묶음 맨 아래 + 이번 사이클 체크리스트) → W-01 저축·투자 묶음(새 줄 강조).
// 입력값은 기기에 두고 다시 열면 이어서(20 W-11). 월급 계획이 없거나 해제 대기 중이면 추가할 수 없음.
// 이미 모은 금액은 만들 때만 넣는 시작값. 목표 금액보다 적어야 함. 기한은 목표 금액이 있을 때만.
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
type Draft = SavingDraft;
type Fold = 'target' | 'deadline' | 'start';

export function W11SavingAdd() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const splits = useSplits();
  const goals = useGoals();
  const items = useSavingItems();
  // 월급 계획 템플릿이 아직 없으면(월급 0원 포함) 막지 않고 그 자리에서 만듦(2026-11-19 사용자 결정)
  const pendingLink = space.data?.couple_state === 'unlink_pending';
  useEnsureSplit({
    enabled:
      !!splits.data &&
      !pendingLink &&
      !splits.data.some((x) =>
        space.data?.salary_mode === 'joint'
          ? x.owner_user_id === null
          : x.owner_user_id === me.data?.id,
      ),
    me: me.data,
    partner: partner.data,
    goals: goals.data,
    salaryMode: space.data?.salary_mode,
    sharedLiving: space.data?.shared_living,
  });
  const [draft, setDraftState] = useState<Draft>(readDraft);
  const [saving, setSaving] = useState(false);
  const [fold, setFold] = useState<Fold | null>(null);
  const { masked } = useMask();
  const setDraft = (d: Draft) => {
    setDraftState(d);
    writeDraft(d);
  };
  const entry: Entry = (ENTRIES as readonly string[]).includes(params.get('from') ?? '')
    ? (params.get('from') as Entry)
    : 'direct';
  // 첫 저금 흐름(O-60 뒤)이면 이어하기 주소를 남김: 앱을 닫았다 열면 /onboarding/resume → 여기로(2026-11-13 실구동)
  useEffect(() => {
    if (entry === 'onboarding') markFirstSaving(`${savingPaths.add}?${params}`);
  }, [entry, params]);
  const back = () => {
    if (entry === 'onboarding') {
      // 첫 저금 흐름(2026-11-17): ‹ = O-60 ‘준비 끝’(이어하기는 지움)
      clearFirstSaving();
      return nav(ONBOARDING_READY_PATH, { replace: true, state: { backToReady: true } });
    }
    return window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist);
  };
  useHardwareBack(back, entry === 'onboarding'); // 안드로이드 뒤로도 ‹와 같게
  if (!me.data || !space.data || !splits.data) return <QuestionSkeleton title={copy.formTitle} />;
  const joint = space.data.salary_mode === 'joint';
  const mine = splits.data.find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === me.data?.id,
  );
  // 해제 대기 중이면 추가할 수 없음(20 W-11 예외): W-02로 + Toast(2026-11-12 S7-15). W-02가 회색 한 줄을 보여 줌.
  // 월급 0원·템플릿 없음은 막지 않음(2026-11-19): 템플릿을 만드는 동안 뼈대
  if (space.data.couple_state === 'unlink_pending') return <Blocked text={copy.addBlocked} />;
  if (!mine) return <QuestionSkeleton title={copy.formTitle} />;
  // 지금 미계획 금액(보조, 0원 아래면 0원)
  const income = joint
    ? (me.data.monthly_income ?? 0) + (partner.data?.monthly_income ?? 0)
    : (me.data.monthly_income ?? 0);
  // 보내기 줄(한 사람 관리형, kind send)은 공동 수입 안의 이동이라 셈하지 않음 = W-01·홈과 같은 core leftover(2026-11-25: kind를 빼고 넘겨
  // 합쳐서 엔진에서 W-01 585만 원이 이 머리에 315만 원으로 보이던 것)
  const left = leftover(
    income,
    mine.split_line.map((l) => ({ amount: l.amount, kind: l.kind })),
  );
  // 용돈은 이미 빠진 돈(2026-11-16 r6)
  const allowance = mine.split_line
    .filter((l) => l.kind === 'allowance')
    .reduce((t, l) => t + l.amount, 0);

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
      // ‘자동으로 나가요’: 새 저금 줄에 자동 줄 설정(나가는 날, null = 월급날)
      if (d.auto) {
        const line = (await fetchSplits())
          .flatMap((x) => x.split_line)
          .find((l) => l.kind === 'saving' && l.goal_id === id);
        if (line)
          await configureSplitLines([{ id: line.id, autoPay: true, autoDay: d.autoDay }]).catch(
            () => undefined,
          );
      }
      track('auto_pay_asked', { screen_id: 'W-11', answer: d.auto ? 'yes' : 'no' });
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
      // 저장했으면 첫 저금 흐름은 끝, 남은 건 초대 시트(O-07)라 거기부터 이어 가게(2026-11-16 r5)
      if (entry === 'onboarding') markFirstSaving(AFTER_FIRST_SAVING_PATH);
      await Promise.all(
        [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      );
      carryToast(copy.added);
      // O-60 ‘첫 저금 만들기’로 왔으면 끝에 미합류 초대 시트(O-07) → A-06 → 홈(16 v2.2, onboarding AFTER_FIRST_SAVING_PATH)
      // 그 밖(20 W-11 고친 점): 미합류면 초대, 각자 계열 연결이면 “{이름}님과 같이 모을까요?”(→ W-15). W-10이 시트로 물음
      const st = space.data?.couple_state;
      const ask = st === 'not_joined' ? 'invite' : !joint && st === 'connected' ? 'bundle' : null;
      // 2026-11-18: 만든 뒤 W-01 월급 계획 템플릿의 저축·투자 묶음으로(새 줄 잠깐 강조 + Toast), 물음은 거기서
      const to = new URLSearchParams({ new: id });
      if (ask) to.set('ask', ask);
      nav(entry === 'onboarding' ? AFTER_FIRST_SAVING_PATH : `${salaryPaths.plan}?${to}#saving`, {
        replace: true,
      });
    } catch (e) {
      toast(
        e instanceof SavingItemBlocked && e.reason === 'unlink_pending'
          ? copy.addBlocked
          : copy.failed,
      );
    } finally {
      setSaving(false);
    }
  };

  // 이름 칩(19 ‘이름 칩 표’, 2026-11-18): 두 사람 사이마다 6개 + ‘직접 정하기’. 이미 모으는 중인 이름은 뺌(2026-11-23, W-12b와 같음)
  const taken = new Set(
    items.ready
      ? items.live.filter((x) => x.state === 'saving').map((x) => x.goal.name.trim())
      : [],
  );
  const free = (c: SavingChip) => !taken.has(copy.chipNames[c]);
  const chips = savingChips(space.data.marriage_status).filter(free);
  // 2026-11-27: ‘추천’ 아래 주제 묶음(결혼 말 규칙, 추천에 있는 칩은 뺌)은 ‘더 보기’로
  const groups = savingChipGroups(space.data.marriage_status).map((g) => ({
    title: copy.chipGroupNames[g.group],
    chips: g.chips.filter(free).map((c) => ({ key: c, name: copy.chipNames[c] })),
  }));
  const name = draft.name;
  const allChips = [
    ...chips.map((c) => ({ key: c, name: copy.chipNames[c] })),
    ...groups.flatMap((g) => g.chips),
  ];
  const isChip = allChips.some((c) => c.name === name);
  const picked = draft.custom ? null : (allChips.find((c) => c.name === name)?.key ?? null);
  // 이름 칸은 ‘직접 정하기’를 눌렀거나 칩에 없는 이름(이어하기·다른 화면에서 채워 온 이름)일 때
  const customOpen = draft.custom || (name.trim() !== '' && !isChip);
  const baseDay = baseDayOf(me.data, space.data);
  const monthly = draft.monthly;
  const unit = monthly !== null && monthly % 10_000 !== 0;
  const start = draft.hasStart ? (draft.start ?? 0) : 0;
  const ym = (draft.deadline?.slice(0, 7) as YearMonth | undefined) ?? defaultDeadline();
  // 매달 금액이 월급을 넘으면 ‘추가하기’를 막음(06 3-3, 2026-11-26 사용자 결정, 새 줄이라 바꾸기 전 0원, 0원은 추가 가능)
  const over = planInputCheck({ left0: left, before: 0, after: monthly });
  const ready =
    savingFormReady(name, monthly) &&
    !over.blocked &&
    !(draft.target !== null && start >= draft.target);
  const shown = (v: number) => money(v, masked);
  const closeFold = () => setFold(null);

  return (
    <>
      <FormScreen
        title={copy.formTitle}
        backLabel={copy.back}
        onBack={back}
        hero={
          <FormHero
            lines={formHero({
              name,
              amount: monthly,
              verb: copy.formVerbSave,
              what: copy.formWhat,
              money: shown,
            })}
          />
        }
        primary={{ label: copy.addDone, disabled: !ready, loading: saving }}
        onSubmit={() => void save(draft)}
      >
        <FormSection title={copy.formNameQ}>
          <NameChipGroups
            label={copy.addNameChips}
            topTitle={copy.chipGroupNames.top}
            top={chips.map((c) => ({ key: c, name: copy.chipNames[c] }))}
            groups={groups}
            selected={picked}
            onPick={(c) => setDraft({ ...draft, custom: false, name: c.name })}
            tail={
              <Chip
                small
                selected={customOpen}
                onClick={() => setDraft({ ...draft, custom: true, name: isChip ? '' : draft.name })}
              >
                {copy.savingEmptyCustom}
              </Chip>
            }
          />
          {customOpen && (
            <ShortText
              label={copy.formNameLabel}
              value={name}
              onChange={(v) => setDraft({ ...draft, name: v })}
              max={20}
              placeholder={copy.addNamePlaceholder}
            />
          )}
        </FormSection>
        <FormSection
          title={copy.formMonthlyQ}
          aside={left > 0 ? `${copy.leftoverLabel} ${shown(left)}` : undefined}
        >
          <FormAmount
            label={copy.formMonthlyQ}
            sheetTitle={copy.formMonthlyKeypad}
            closeLabel={copy.close}
            confirmLabel={copy.ok}
            value={monthly}
            onChange={(x) => setDraft({ ...draft, monthly: x })}
            quick={quickChips.monthly}
            quickSet
            invalid={unit}
            below={
              <>
                {monthly !== null && over.left < 0 ? (
                  // 월급을 넘으면 “월급보다 300,000원 많아요”(금액만 빨강) + ‘월급 고치기’ → W-01 월급 금액 시트(입력값은 기기에 남아 이어서).
                  // 첫 저축·투자 흐름(O-60 뒤)은 흐름을 벗어나지 않게 문구만
                  <PlanLeftHint
                    left={over.left}
                    text={shown}
                    onFixIncome={
                      entry === 'onboarding' ? undefined : () => nav(`${salaryPaths.plan}?income=1`)
                    }
                  />
                ) : (
                  left <= 0 && (
                    <p className="hg-help">
                      {copy.addMonthlyHelp(
                        shown(Math.max(left, 0)),
                        allowance > 0 ? shown(allowance) : undefined,
                        false,
                      )}
                    </p>
                  )
                )}
                {unit && <p className="hg-help is-error">{copy.tenThousandUnit}</p>}
              </>
            }
          />
        </FormSection>
        <FormSection title={copy.formHowQ}>
          <LineModeBody
            value={{
              inChecklist: true,
              autoPay: !!draft.auto,
              autoDay: draft.autoDay,
            }}
            onChange={(v) => setDraft({ ...draft, auto: v.autoPay, autoDay: v.autoDay })}
            allowOff={false}
            payday={baseDay}
          />
        </FormSection>
        <FormFolds>
          <FormFold
            label={copy.foldTarget}
            value={draft.target !== null ? shown(draft.target) : undefined}
            placeholder={copy.foldPick}
            onClick={() => setFold('target')}
          />
          {draft.target !== null && (
            <FormFold
              label={copy.foldDeadline}
              value={draft.deadline ? formatYm(ym) : undefined}
              placeholder={copy.foldPick}
              onClick={() => setFold('deadline')}
            />
          )}
          <FormFold
            label={copy.foldStart}
            value={shown(start)}
            placeholder={copy.foldPick}
            onClick={() => setFold('start')}
          />
        </FormFolds>
      </FormScreen>
      {fold === 'target' && (
        <AmountSheet
          title={copy.foldTarget}
          value={draft.target}
          clearLabel={draft.target !== null ? copy.foldClear(copy.foldTarget) : undefined}
          error={(v) => (v !== null && start > 0 && start >= v ? copy.addStartOver : undefined)}
          onClose={closeFold}
          onDone={(v) =>
            setDraft({
              ...draft,
              target: v && v > 0 ? v : null,
              deadline: v && v > 0 ? draft.deadline : null,
            })
          }
        />
      )}
      {fold === 'start' && (
        <AmountSheet
          title={copy.foldStart}
          value={draft.hasStart ? (draft.start ?? 0) : 0}
          allowZero
          error={(v) =>
            v !== null && draft.target !== null && v >= draft.target ? copy.addStartOver : undefined
          }
          onClose={closeFold}
          onDone={(v) =>
            setDraft({ ...draft, hasStart: !!v && v > 0, start: v && v > 0 ? v : null })
          }
        />
      )}
      {fold === 'deadline' && draft.target !== null && (
        <DeadlineSheet
          initial={ym}
          has={draft.deadline !== null}
          target={draft.target}
          saved={start}
          monthly={monthly ?? 0}
          together={joint && space.data.couple_state === 'connected'}
          onClose={closeFold}
          onDone={(x) => setDraft({ ...draft, deadline: x })}
        />
      )}
    </>
  );
}

/** 금액 시트(목표 금액, 이미 모은 금액): 기존 키패드 + ‘확인’ + 값이 있으면 ‘… 지우기’ */
function AmountSheet({
  title,
  value,
  allowZero,
  clearLabel,
  error,
  onClose,
  onDone,
}: {
  title: string;
  value: number | null;
  allowZero?: boolean;
  clearLabel?: string;
  error: (v: number | null) => string | undefined;
  onClose: () => void;
  onDone: (v: number | null) => void;
}) {
  const [v, setV] = useState<number | null>(value);
  const err = error(v);
  return (
    <BottomSheet
      title={title}
      closeLabel={copy.close}
      onClose={onClose}
      actions={
        <>
          <Button
            variant="primary"
            block
            disabled={!!err || v === null}
            onClick={() => {
              onDone(v);
              onClose();
            }}
          >
            {copy.ok}
          </Button>
          {clearLabel && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'center' }}
              onClick={() => {
                onDone(null);
                onClose();
              }}
            >
              {clearLabel}
            </button>
          )}
        </>
      }
    >
      <AmountInput label={title} value={v} onChange={setV} allowZero={allowZero} />
      {err && (
        <p className="hg-help is-error" role="alert">
          {err}
        </p>
      )}
    </BottomSheet>
  );
}

/** 기한 시트: 연·월 휠(처음 값 1년 뒤) + 미리보기 “기한까지 매달 …이면 돼요”(늦으면 “지금 속도면 …에 다 모아요”) */
function DeadlineSheet({
  initial,
  has,
  target,
  saved,
  monthly,
  together,
  onClose,
  onDone,
}: {
  initial: YearMonth;
  has: boolean;
  target: number;
  saved: number;
  monthly: number;
  together: boolean;
  onClose: () => void;
  onDone: (v: string | null) => void;
}) {
  const [ym, setYm] = useState<YearMonth>(initial);
  const { masked } = useMask();
  const err = ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
  const need = savingNeed({ target, saved, deadline: ym });
  const late = savingLate({ target, saved, deadline: ym }, monthly);
  const eta = savingEta({ target, saved }, monthly);
  const mm = (v: number) => money(v, masked);
  return (
    <BottomSheet
      title={copy.foldDeadline}
      closeLabel={copy.close}
      onClose={onClose}
      actions={
        <>
          <Button
            variant="primary"
            block
            disabled={!!err}
            onClick={() => {
              onDone(ym);
              onClose();
            }}
          >
            {copy.ok}
          </Button>
          {has && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'center' }}
              onClick={() => {
                onDone(null);
                onClose();
              }}
            >
              {copy.foldClear(copy.foldDeadline)}
            </button>
          )}
        </>
      }
    >
      <YearMonthField
        label={copy.foldDeadline}
        value={ym}
        onChange={(x) => x && setYm(x as YearMonth)}
        error={err}
      />
      {need !== null && (
        <p className="hg-help">
          {/* 같이 계열(합쳐서 + 연결)은 둘이 같이 모으는 금액(2026-11-14) */}
          {together
            ? copy.needPerMonthTogether(mm(need), monthly ? mm(monthly) : undefined)
            : copy.needPerMonth(mm(need), monthly ? mm(monthly) : undefined)}
          {late !== null && eta && (
            <>
              <br />
              {copy.etaAt(formatYm(eta))}
            </>
          )}
        </p>
      )}
    </BottomSheet>
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
