import {
  addSplitLine,
  configureSplitLines,
  deleteSplitLine,
  dismissHomeTask,
  fetchSharedAccounts,
  qk,
  reopenSavingItem,
  reorderSplit,
  salaryChangeKeys,
  saveSplit,
  scheduleSalaryChange,
  setSplitLine,
  SplitBlocked,
  type SplitLine,
  updateMe,
} from '@sweetwo/api';
import { isOnline } from '@sweetwo/api';
import {
  amountBand,
  coupleOf,
  leftover,
  planChangeTouchesMonth,
  planRatio,
  joinLineNote,
  planSummary,
  savingLineNote,
  salaryChangedTaskOpen,
  savingStartChips,
  todayKst,
} from '@sweetwo/core';
import {
  BottomSheet,
  Chip,
  Icon,
  ListRow,
  Menu,
  type MenuAction,
  Modal,
  PlanAdd,
  PlanCard,
  PlanStage,
  PlanSummary,
  ReceiptRows,
  SectionHeader,
  Tabs,
  type ReceiptLine,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { changeBand, track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { money, useMask } from '../../../shared/mask';
import { speakMasked, spoken } from '../../../shared/masked-text';
import { PersonDot } from '../../../shared/person';
import { quietly, toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { goalLineName } from '../check-line';
import { copy } from '../copy';
import {
  useAccountNames,
  useChecklists,
  useGoalSaved,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  useSplits,
  useSplitWrite,
} from '../data';
import { baseDayOf, nextDayOf as nextDay, receiptAutoNote, salaryChangedDay } from '../cycle';
import { useQuery } from '@tanstack/react-query';
import { fetchPartnerPlanView, fetchSalaryChanges } from '@sweetwo/api';
import { BundleRow } from '../bundle-parts';
import { savingPaths, togetherPaths } from '../paths';
import { EMPTY_DRAFT, writeDraft } from '../saving-draft';
import { sharePlan, type PlanImageModel } from '../receipt-image';
import { IncomeSheet, PlanSheet, type LineSettings } from '../receipt-parts';
import { W01eSpendAdd } from './w-01e-spend-add';
import { useEnsureSplit } from '../ensure-split';
import { SalaryLoadError, SalaryLoading } from '../salary-tab';
import { SavingAskSheet, SavingGoalRow } from '../saving-parts';
import { useSavingItems } from '../saving';
import { useBundles } from '../together';
import { BundleAchieveWatch } from './w-12-bundle-achieved';
import { keepOrder, recommendedDraft } from '../split-draft';
import { toDraft } from '../split-editor';

// from: W-10 ‘매달 금액 바꾸기’(?line=)로 연 시트(분석 entry saving_detail, 주소의 line은 열자마자 지움)
type Sheet = { line: SplitLine; from?: 'saving_detail' } | { income: true } | null;
type Kind = SplitLine['kind'];
const DEFAULT_KINDS: Kind[] = ['fixed', 'living', 'allowance'];
const MAX_CUSTOM = 10;

// W-01 월급 계획 영수증(20 W-01, 2026-11-09). 별도 화면(/salary/plan, 2026-11-18 구간 탭 없앰).
// 고칠 때마다 바로 저장(줄 RPC) + Toast ‘되돌리기’. 편집 모드: 손잡이·위아래로 순서(‘완료’에서 한 번에), 지우기.
// 각자 + 파트너 합류면 사람 탭(?who=), 파트너 탭은 보기만(자물쇠, 서버 not_owner). 해제 대기 중 보기만.
// ?line={저금 항목 id}: 그 저금 줄 금액 시트를 열고 시작(W-10 ‘매달 금액 바꾸기’). ?income=1: 월급 금액 시트(‘월급 고치기’).
export function W01Receipt() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const splits = useSplits();
  const accountNames = useAccountNames();
  const partner = usePartner();
  const saved = useGoalSaved();
  const lists = useChecklists();
  const write = useSplitWrite();
  const { masked } = useMask();
  const [edit, setEdit] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  // 지출 추가 한 화면(W-01e, 2026-11-23): 열려 있으면 W-01 대신 그리고, 닫으면 같은 자리로 돌아옴
  const [spendForm, setSpendForm] = useState<{
    name: string;
    chip: string | null;
    first: boolean;
    custom: boolean;
  } | null>(null);
  const scrollAt = useRef(0);
  useEffect(() => {
    if (!spendForm && scrollAt.current) {
      window.scrollTo(0, scrollAt.current);
      scrollAt.current = 0;
    }
  }, [spendForm]);
  const [pick, setPick] = useState(false); // ‘+ 지출 추가’ 선택 시트(지출 / 같이 쓰는 통장)
  const [stop, setStop] = useState<SplitLine | null>(null);
  const [refill, setRefill] = useState(false);
  const [fold, setFold] = useState(false);
  const [busy, setBusy] = useState(false);
  // 빈 지출 카드 칩: 처음 비었다고 본 뒤에는 줄을 넣어도(생활비 칩 등 이어서 넣게) 화면을 나갈 때까지 둠
  const [spendAsk, setSpendAsk] = useState(false);
  const [sharing, setSharing] = useState(false);
  const who = params.get('who');
  const lineParam = params.get('line');
  const loc = useLocation();
  const fromMonth = (loc.state as { from?: string } | null)?.from === 'month';
  // 저축·투자 묶음(2026-11-18 W-13을 합침): 줄마다 모은 금액·진행, 같이 모으기 묶음, 방금 만든 줄 강조
  const saving = useSavingItems();
  const bundles = useBundles();
  const [openBundle, setOpenBundle] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [askFor, setAskFor] = useState<{ ask: 'bundle' | 'invite'; id: string } | null>(null);
  const [askLater, setAskLater] = useState<{ ask: 'bundle' | 'invite'; id: string } | null>(null);
  const newParam = params.get('new');
  const askParam = params.get('ask');
  const scrolled = useRef(false);
  const qc = useQueryClient();
  const changes = useQuery({ queryKey: qk.salaryChanges, queryFn: fetchSalaryChanges });
  // 3b 파트너 탭(각자): 파트너 공개 단계대로 서버가 자른 값(partner_plan_view). ‘모두’가 아니면 영수증 대신 저금만 목록
  const partnerView = useQuery({
    queryKey: qk.partnerPlanView(null),
    queryFn: () => fetchPartnerPlanView(),
    enabled: space.data?.salary_mode === 'separate' && !!partner.data,
  });
  // W-01b 열린 분담 제안(내가 연 것)이 있으면 그 통장 줄 아래 회색 “{이름}님 답을 기다려요”(20 W-01b, 2026-11-13 PR 14)
  const accounts = useQuery({
    queryKey: qk.sharedAccounts,
    queryFn: fetchSharedAccounts,
    enabled: !!partner.data,
  });

  const m = me.data;
  const sp = space.data;
  const p = partner.data ?? null;
  const joint = sp?.salary_mode === 'joint';
  const connected = sp?.couple_state === 'connected' || sp?.couple_state === 'unlink_pending';
  const pending = sp?.couple_state === 'unlink_pending';
  const tabs = !joint && connected && !!p;
  const ownerId = joint ? null : tabs && p && who === p.id ? p.id : (m?.id ?? null);
  const owner = p && ownerId === p.id ? p : m;
  const theirs = !joint && !!m && ownerId !== m.id;
  const split = splits.data?.find((x) => x.owner_user_id === ownerId);
  // 이번 사이클 그 사람(합쳐서면 공동) 체크리스트(링크 줄, 금액 바꾸기 Toast)
  const month = lists.data?.find((c) => c.owner_user_id === ownerId);
  const canEdit = !!split && !theirs && !pending;
  const serverLines = [...(split?.split_line ?? [])].sort((a, b) => a.sort - b.sort);
  // 편집 모드에서 옮긴 순서(‘완료’ 전까지 화면에만). 새로 생긴 줄은 뒤에
  const lines = order
    ? [...serverLines].sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        return (ia < 0 ? 1e9 + a.sort : ia) - (ib < 0 ? 1e9 + b.sort : ib);
      })
    : serverLines;

  // W-10 ‘매달 금액 바꾸기’: 그 저금 줄 시트를 열고 시작(한 번)
  useEffect(() => {
    if (!lineParam || !split) return;
    const l = split.split_line.find((x) => x.goal_id === lineParam);
    if (l && canEdit) setSheet({ line: l, from: 'saving_detail' });
    const next = new URLSearchParams(params);
    next.delete('line');
    setParams(next, { replace: true });
  }, [lineParam, split, canEdit, params, setParams]);

  // `?income=1`: 월급 금액 시트(3b)를 열고 시작(한 번). W-11·W-10 매달 금액이 월급을 넘을 때 ‘월급 고치기’(2026-11-26)
  const incomeParam = params.get('income');
  useEffect(() => {
    if (!incomeParam || !m) return;
    if (!theirs && !pending) {
      track('salary_line_edit_opened', { joint, was_zero: (m.monthly_income ?? 0) === 0 });
      setSheet({ income: true });
    }
    const next = new URLSearchParams(params);
    next.delete('income');
    setParams(next, { replace: true });
  }, [incomeParam, m, theirs, pending, joint, params, setParams]);

  // W-11로 방금 만든 저축·투자(`?new=`, 2026-11-18): 그 줄을 잠깐 강조 + 묶음으로 스크롤. `?ask=`면 같이 모을까요·초대 물음 시트
  useEffect(() => {
    if (!newParam || !split) return;
    const l = split.split_line.find((x) => x.goal_id === newParam);
    if (!l) return;
    setFresh(l.id);
    // 같이 모을까요·초대 물음 시트는 강조가 끝난 뒤에(2026-11-23)
    if (askParam === 'bundle' || askParam === 'invite')
      setAskLater({ ask: askParam, id: newParam });
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('ask');
    setParams(next, { replace: true });
  }, [newParam, askParam, split, params, setParams]);
  // 새 줄 강조: 옅은 오렌지 2초 + 서서히 사라짐(0.5초). ‘동작 줄이기’면 애니메이션 없이 2초 표시. 화면 밖이면 그 줄로 스크롤
  useEffect(() => {
    if (!fresh) return;
    const reduce =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector<HTMLElement>(`[data-row-id="${fresh}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    const t = setTimeout(() => setFresh(null), reduce ? 2000 : 2500);
    return () => clearTimeout(t);
  }, [fresh]);
  useEffect(() => {
    if (fresh || !askLater) return;
    setAskFor(askLater);
    setAskLater(null);
  }, [fresh, askLater]);
  const planReady = !!(me.data && space.data && goals.data && splits.data);
  // 월급 계획 템플릿이 아직 없으면(월급 0원 포함) 막는 카드 없이 그 자리에서 만듦(2026-11-19 사용자 결정)
  useEnsureSplit({
    enabled: planReady && !split && !theirs && !pending,
    me: m,
    partner: p,
    goals: goals.data,
    salaryMode: sp?.salary_mode,
    sharedLiving: sp?.shared_living,
  });
  // 주소 `#saving`이나 방금 만든 줄이면 저축·투자 묶음으로 스크롤(한 번)
  useEffect(() => {
    if (!planReady || scrolled.current) return;
    if (loc.hash !== '#saving' && !fresh) return;
    const el = document.getElementById('saving');
    if (!el) return;
    scrolled.current = true;
    el.scrollIntoView({ block: 'start' });
  }, [planReady, loc.hash, fresh]);
  // 분석: 저축·투자 묶음으로 열림(옛 W-13 열림 이벤트 이름 그대로)
  const viewedEntry = params.get('from');
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current || loc.hash !== '#saving' || !saving.ready) return;
    viewed.current = true;
    track('saving_list_viewed', {
      entry:
        viewedEntry === 'checklist' || viewedEntry === 'home' || viewedEntry === 'split'
          ? viewedEntry
          : 'direct',
      items_count: saving.live.length,
    });
  }, [loc.hash, saving, viewedEntry]);

  // 빈 지출 카드의 이름 칩(20 W-01 ‘빈 지출 카드’, 2026-11-19: 예전 맨 위 ‘매달 나가는 지출이 있어요?’ 카드가 옮겨 옴):
  // 내가 고칠 수 있는 월급 계획(합쳐서면 공동)에 고정지출·생활비·직접 추가 줄이 하나도 없을 때. 한 사람 관리형의 관리하지 않는 쪽(보내기·용돈만)에게는 없음
  const notManager =
    space.data?.salary_mode === 'joint' &&
    !!space.data.manager_user_id &&
    space.data.manager_user_id !== me.data?.id;

  // 월급이 바뀐 달 띠(H-06 6번, 07 5장): W-01을 열면 끝냄(home_task_state done)
  const changedDay = m && sp ? salaryChangedDay(changes.data, m.id, baseDayOf(m, sp)) : null;
  useEffect(() => {
    if (
      !changedDay ||
      !salaryChangedTaskOpen({ appliedDay: changedDay, today: todayKst(), done: false })
    )
      return;
    void dismissHomeTask(`salary_changed:${changedDay}`, 'done')
      .then(() => qc.invalidateQueries({ queryKey: qk.homeTasks }))
      .catch(() => undefined);
  }, [changedDay, qc]);

  // 못 불러오면 오류 카드 + 다시 시도(13 공통 상태 7번, S5-02), 불러오는 중은 구간 탭 + 본문 뼈대(13-5, S5-11)
  const loads = [me, space, goals, splits];
  if (loads.some((q) => q.isError && !q.data))
    return (
      <SalaryLoadError
        value="plan"
        onRetry={() => {
          for (const q of loads) if (!q.data) void q.refetch();
        }}
      />
    );
  if (!m || !sp || !goals.data || !splits.data) return <SalaryLoading value="plan" />;

  const personName = (id: string | null | undefined) =>
    id === m.id ? (m.nickname ?? '') : (p?.nickname ?? '');
  const goalName = goalLineName(goals.data, (id) => personName(id), joint);
  const nameOf = (
    l: Pick<SplitLine, 'kind' | 'goal_id' | 'user_id' | 'name'> &
      Partial<Pick<SplitLine, 'shared_account_id'>>,
  ) =>
    l.kind === 'saving'
      ? goalName(l.goal_id)
      : l.kind === 'custom'
        ? (l.name ?? '')
        : l.kind === 'allowance' && joint
          ? `${personName(l.user_id)} ${copy.lineNames.allowance}`
          : l.kind === 'send'
            ? copy.sendName // 5e 한 사람 관리형 ‘보내기’
            : l.kind === 'shared_account'
              ? (l.name ?? accountNames.ofAccount(l.shared_account_id) ?? copy.sharedAccountName) // 5d 같이 쓰는 통장(분담 이름, M7)
              : copy.lineNames[l.kind];
  const won = (v: number) => money(v, masked);
  const baseDay = baseDayOf(owner ?? m, sp);
  // 보이는 금액 글자(가리기면 화면 읽기는 “가려진 금액”, 11 9장)
  const shown = (text: string) => speakMasked(text);
  const income = joint
    ? (m.monthly_income ?? 0) + (p?.monthly_income ?? 0)
    : (owner?.monthly_income ?? 0);
  const savingLines = lines.filter((l) => l.kind === 'saving');
  // 용돈 줄을 지출 묶음 맨 위에(2026-11-16 4차 검토 R4-3: 용돈도 ‘미계획 금액’에서 빠지는 계획 줄임이 보이게).
  // 나머지 줄은 월급 계획 순서 그대로, 편집 모드 순서 바꾸기도 이 순서 안에서
  const spendLines = [
    ...lines.filter((l) => l.kind === 'allowance'),
    ...lines.filter((l) => l.kind !== 'saving' && l.kind !== 'allowance'),
  ];
  const sum = (ls: SplitLine[]) => ls.reduce((s, l) => s + l.amount, 0);
  const savingSum = sum(savingLines);
  // 보내기 줄(한 사람 관리형)은 공동 수입 안의 이동이라 지출 합·여유 자금에 넣지 않음(06 3-2, core leftover·홈 H-07과 같음,
  // 2026-11-13 UX B M1: 수입과 보내기를 두 번 세던 것)
  const spendSum = sum(spendLines.filter((l) => l.kind !== 'send'));
  const ratio = planRatio({ income, saving: savingSum, spend: spendSum });
  const left = ratio.left;
  const closed = goals.data.filter(
    (g) => !g.deleted_at && !!g.closed_at && (joint || g.owner_user_id === ownerId),
  );
  const whose = joint ? 'joint' : theirs ? 'partner' : 'self';

  // ── 쓰기(줄마다 바로 저장) ─────────────────────────────────────────────
  const offline = () => {
    if (!isOnline()) {
      toast(sharedCopy.needOnline);
      return true;
    }
    return false;
  };
  const failed = (e: unknown) => {
    if (e instanceof SplitBlocked) {
      if (e.reason === 'duplicate_line') return toast(copy.duplicateName);
      if (e.reason === 'too_many_custom') return toast(copy.tooManyLines);
      if (e.reason === 'unlink_pending') return toast(copy.splitPending);
      if (e.reason === 'not_owner') return toast(copy.partnerSplitView(personName(ownerId)));
    }
    toast(copy.failed);
  };
  const run = async (job: () => Promise<void>) => {
    if (busy || offline()) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };
  // 지출 추가 한 화면 열기(W-01e): 지금 스크롤 자리를 기억해 닫으면 그 자리로
  const openSpendForm = (o: {
    name: string;
    chip: string | null;
    first: boolean;
    custom?: boolean;
  }) => {
    scrollAt.current = window.scrollY;
    setSpendForm({ ...o, custom: !!o.custom });
    window.scrollTo(0, 0);
  };
  const closeSpendForm = () => setSpendForm(null);
  const bandOrShort = (v: number) => (v < 0 ? ('short' as const) : amountBand(v));
  // 32 4-6 둘이 같이 고치기(S5-07): 합쳐서 공동 월급 계획을 연결된 상대와 같이 쓰면(상대에게 알림이 감)
  const shared = joint && sp.couple_state === 'connected';
  const sharedChanged = () => {
    if (shared) track('shared_item_changed', { item_type: 'split', linked: true });
  };
  /** Toast ‘되돌리기’: 서버 되돌리기 + 공동 월급 계획이면 change_reverted */
  const undo = (job: () => Promise<unknown>) => {
    const at = Date.now();
    return {
      label: copy.undo,
      onClick: () => {
        if (shared)
          track('change_reverted', {
            item_type: 'split',
            entry: 'toast',
            reverted_whose: 'self',
            hours_since_change: Math.floor((Date.now() - at) / 3_600_000),
          });
        quietly(job());
      },
    };
  };

  const change = (
    l: SplitLine,
    amount: number,
    rawName: string,
    from?: 'saving_detail',
    set?: LineSettings,
  ) =>
    run(async () => {
      const renamed = l.kind === 'custom' && rawName !== '' && rawName !== l.name;
      const moved = amount !== l.amount;
      const before: LineSettings = {
        inChecklist: l.in_checklist,
        autoPay: l.auto_pay,
        autoDay: l.auto_day,
      };
      const reset =
        !!set &&
        (set.inChecklist !== before.inChecklist ||
          set.autoPay !== before.autoPay ||
          (set.autoPay && set.autoDay !== before.autoDay));
      if (!renamed && !moved && !reset) return setSheet(null);
      if (set && reset) {
        // 줄 설정(20 W-01 7a): 바로 저장(split_lines_configure), 이번 사이클 체크 안 한 줄도 따라 바뀜
        await write(() =>
          configureSplitLines([
            {
              id: l.id,
              inChecklist: set.inChecklist,
              autoPay: set.autoPay,
              autoDay: set.autoPay ? set.autoDay : null,
            },
          ]),
        );
        const next = nextDay(baseDay);
        track('split_line_setting_changed', {
          kind: l.kind,
          in_checklist: set.inChecklist,
          auto_pay: set.autoPay,
          auto_day_band: !set.autoPay
            ? 'none'
            : set.autoDay === null
              ? 'payday'
              : set.autoDay === next
                ? 'next'
                : 'other',
        });
        if (set.autoPay !== before.autoPay)
          track('auto_pay_asked', { screen_id: 'W-01', answer: set.autoPay ? 'yes' : 'no' });
        if (!renamed && !moved) {
          setSheet(null);
          sharedChanged();
          return toast(
            copy.lineSettingChanged(nameOf(l)),
            undo(() =>
              write(() =>
                configureSplitLines([
                  {
                    id: l.id,
                    inChecklist: before.inChecklist,
                    autoPay: before.autoPay,
                    autoDay: before.autoDay,
                  },
                ]),
              ),
            ),
          );
        }
      }
      // 이번 달 체크 안 한 줄도 바뀌는지(서버 sync_checklist와 같은 맞춤, 바꾸기 전 체크리스트로)
      const monthToo = moved && planChangeTouchesMonth(l, amount, month?.pay_check_line);
      await write(() =>
        setSplitLine(l.id, {
          amount: moved ? amount : undefined,
          name: renamed ? rawName : undefined,
        }),
      );
      setSheet(null);
      const name = renamed ? rawName : nameOf(l);
      track('plan_line_changed', {
        line_kind: l.kind,
        field: renamed && moved ? 'both' : renamed ? 'name' : 'amount',
        direction: amount > l.amount ? 'up' : amount < l.amount ? 'down' : 'same',
        left_band: bandOrShort(left + l.amount - amount),
        joint,
        entry: edit ? 'edit' : (from ?? 'receipt'),
      });
      sharedChanged();
      toast(
        monthToo
          ? copy.monthLineToo
          : moved
            ? copy.lineChanged(name, won(amount))
            : copy.nameChanged,
        undo(() =>
          write(() =>
            setSplitLine(l.id, {
              amount: moved ? l.amount : undefined,
              name: renamed ? (l.name ?? undefined) : undefined,
            }),
          ),
        ),
      );
    });

  const add = (
    name: string,
    chip: string | null,
    amount: number,
    first = false,
    set?: LineSettings,
  ) =>
    run(async () => {
      if (!split) return;
      // 첫 달 묻기 ‘생활비’ 칩은 기본 생활비 줄(kind living, 이름 없음). 그 밖은 직접 추가 줄
      const living = first && chip === 'living';
      const id = await write(() =>
        addSplitLine(
          split.id,
          living ? { kind: 'living', amount } : { kind: 'custom', name, amount },
        ),
      );
      // ‘어떻게 챙겨요?’가 새 줄의 기본값(생활비 줄만 목록 끔)과 다르면 바로 설정(split_lines_configure)
      if (set && (set.autoPay || set.inChecklist !== !living))
        await write(() =>
          configureSplitLines([
            {
              id,
              inChecklist: set.inChecklist,
              autoPay: set.autoPay,
              autoDay: set.autoPay ? set.autoDay : null,
            },
          ]),
        );
      setSpendForm(null);
      if (set?.autoPay) track('auto_pay_asked', { screen_id: 'W-01', answer: 'yes' });
      track('plan_line_added', {
        source: chip ? 'chip' : 'text',
        chip,
        amount_band: amountBand(amount),
        joint,
        ...(first ? { first_ask: true } : {}),
      });
      sharedChanged();
      toast(
        copy.lineAdded(name),
        undo(() => write(() => deleteSplitLine(id))),
      );
    });

  const remove = (l: SplitLine, entry: 'sheet' | 'edit') => {
    if (offline()) return;
    if (l.kind === 'saving') {
      setSheet(null);
      return setStop(l);
    }
    void run(async () => {
      if (!split) return;
      await write(() => deleteSplitLine(l.id));
      setSheet(null);
      setOrder((o) => (o ? o.filter((x) => x !== l.id) : o));
      track('plan_line_deleted', {
        line_kind: l.kind,
        default_line: DEFAULT_KINDS.includes(l.kind),
        entry,
        joint,
      });
      const kind = l.kind as Exclude<Kind, 'saving'>;
      sharedChanged();
      toast(
        copy.lineDeleted(nameOf(l)),
        undo(() =>
          write(() =>
            addSplitLine(split.id, {
              kind,
              amount: l.amount,
              name: l.name ?? undefined,
              userId: l.user_id ?? undefined,
              sort: l.sort,
            }),
          ),
        ),
      );
    });
  };
  const stopSaving = (l: SplitLine) =>
    run(async () => {
      await write(() => deleteSplitLine(l.id));
      setStop(null);
      track('plan_line_deleted', {
        line_kind: 'saving',
        default_line: false,
        entry: edit ? 'edit' : 'sheet',
        joint,
      });
      toast(copy.stoppedToast, {
        label: copy.undo,
        onClick: () => quietly(write(() => reopenSavingItem(l.goal_id ?? ''))),
      });
    });

  // 편집 모드 순서: 같은 묶음 안에서만. 지출 묶음은 용돈 줄(맨 위 고정)과 나머지를 따로 옮김(2026-11-16 R4-3)
  const allowanceLines = spendLines.filter((l) => l.kind === 'allowance');
  const otherSpend = spendLines.filter((l) => l.kind !== 'allowance');
  const moveIn = (group: SplitLine[]) => (from: number, to: number) => {
    const ids = group.map((l) => l.id);
    const [id] = ids.splice(from, 1);
    if (!id) return;
    ids.splice(to, 0, id);
    const pick = (g: SplitLine[]) => (g[0] && g[0].id === group[0]?.id ? ids : g.map((l) => l.id));
    setOrder([...pick(savingLines), ...pick(allowanceLines), ...pick(otherSpend)]);
  };
  const finish = () =>
    void run(async () => {
      const before = serverLines.map((l) => l.id);
      const after = lines.map((l) => l.id);
      setEdit(false);
      setOrder(null);
      if (!split || before.join() === after.join()) return;
      await write(() => reorderSplit(split.id, after));
      const changed = (k: 'saving' | 'spend') => {
        const pick = (ids: string[]) =>
          ids.filter(
            (id) => (serverLines.find((l) => l.id === id)?.kind === 'saving') === (k === 'saving'),
          );
        return pick(before).join() !== pick(after).join();
      };
      const s = changed('saving');
      const d = changed('spend');
      track('plan_reordered', {
        sections: s && d ? 'both' : s ? 'saving' : 'spend',
        lines_count: after.length,
        joint,
      });
      toast(copy.orderChanged, {
        label: copy.undo,
        onClick: () => quietly(write(() => reorderSplit(split.id, before))),
      });
    });

  // 추천값으로 다시 채우기(06 3-2): 확인 Modal 뒤 바로 저장, 줄 순서는 그대로
  const doRefill = () =>
    void run(async () => {
      const current = toDraft(serverLines);
      const next = keepOrder(
        recommendedDraft(owner ?? m, goals.data ?? [], {
          joint,
          partner: p,
          saved: saved.data,
          current,
        }),
        current,
      );
      await write(() => saveSplit(next, ownerId ?? undefined));
      setRefill(false);
      track('split_saved', {
        changed_lines_count: next.filter(
          (l, i) => l.amount !== current[i]?.amount || l.kind !== current[i]?.kind,
        ).length,
        editor: 'self',
        left_band: bandOrShort(leftover(income, next)),
        reset_to_recommended: true,
        entry: 'split',
      });
      sharedChanged();
      toast(
        copy.saved,
        undo(() => write(() => saveSplit(current, ownerId ?? undefined))),
      );
    });

  // ── 공유(이미지) ─────────────────────────────────────────────────────
  const legend = [
    { kind: 'saving' as const, text: copy.legendSaving(ratio.saving) },
    { kind: 'spend' as const, text: copy.legendSpend(ratio.spend) },
    ratio.free === null
      ? { kind: 'free' as const, text: copy.legendShort(won(left)), short: true }
      : { kind: 'free' as const, text: copy.legendFree(ratio.free) },
  ];
  // 공유 이미지(2026-11-19, 2026-11-26 도넛): W-01 요약 카드 모양(월급, 한 문장, 도넛 + ● 범례) + 저축·투자·지출 줄 목록 + 워드마크.
  // 금액 가리기·공개 범위는 화면과 같은 값(won, nameOf)을 그대로 씀
  // 저축·투자 줄 보조 줄은 화면과 같은 글(“모은 금액 1,140만 원, 목표 금액의 22%”, 금액 가리기 포함): rowsOf의 note
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const savingNotes = new Map(rowsOf(savingLines).map((r) => [r.id, r.note]));
    const model: PlanImageModel = {
      label: copy.incomeRow,
      amount: won(income),
      sentence: summary.empty
        ? { before: `${copy.summaryEmpty[0]} ${copy.summaryEmpty[1]}`, after: '' }
        : summary.over
          ? { before: `${copy.overPlan[0]}${won(-summary.left)}${copy.overPlan[1]}`, after: '' }
          : summary.noSaving
            ? { before: copy.summaryNoSaving, after: '' }
            : {
                before: copy.summarySaving[0],
                pct: copy.summaryPct(summary.share),
                after: copy.summarySaving[1],
              },
      chart: summary.chart,
      bar: [
        { kind: 'saving', percent: summary.bar.saving },
        { kind: 'spend', percent: summary.bar.spend },
        { kind: 'free', percent: summary.bar.free },
      ],
      legend: [
        { kind: 'saving', name: copy.savingGroup, percent: ratio.saving, amount: won(savingSum) },
        { kind: 'spend', name: copy.spendGroup, percent: ratio.spend, amount: won(spendSum) },
        {
          kind: 'free',
          name: copy.legendFreeName,
          percent: ratio.free ?? undefined,
          amount: won(left),
          short: summary.over,
        },
      ],
      sections: [
        { title: copy.savingGroup, subtotal: won(savingSum), ls: savingLines },
        { title: copy.spendGroup, subtotal: won(spendSum), ls: spendLines },
      ]
        .filter((x) => x.ls.length > 0)
        .map(({ ls, ...x }) => ({
          ...x,
          rows: ls.map((l) => ({
            name: nameOf(l),
            amount: won(l.amount),
            sub: savingNotes.get(l.id),
          })),
        })),
    };
    try {
      const r = await sharePlan(model, copy.imageName(todayKst()));
      track('plan_shared', { result: r, masked, whose });
      if (r === 'downloaded') toast(copy.imageSaved);
    } catch {
      track('plan_shared', { result: 'failed', masked, whose });
      toast(copy.failed);
    } finally {
      setSharing(false);
    }
  };

  // ── 화면 ────────────────────────────────────────────────────────────
  const proposal = theirs
    ? undefined
    : accounts.data?.find(
        (a) =>
          a.status === 'proposed' &&
          a.proposed_by === m.id &&
          Date.parse(a.expires_at) > Date.now(),
      );
  // 그 통장 줄(내 몫을 먼저 넣어 둔 줄 또는 같은 제안 줄). 없으면 제안한 통장을 잠긴 줄로 보여 줌(편집 중에는 뺌)
  const waitLine = proposal
    ? lines.find(
        (l) => l.kind === 'shared_account' && (l.shared_account_id ?? proposal.id) === proposal.id,
      )
    : undefined;
  const waitNote = proposal
    ? copy.splitShare.waiting(coupleOf(m, sp, p).partnerName || copy.partnerFallback)
    : undefined;
  const proposalRow: ReceiptLine | null =
    proposal && !waitLine && !edit
      ? {
          id: `proposal-${proposal.id}`,
          name: proposal.name,
          amount: won(proposal.member_a === m.id ? proposal.share_a : proposal.share_b),
          label: spoken(
            copy.rowLabel(
              proposal.name,
              won(proposal.member_a === m.id ? proposal.share_a : proposal.share_b),
            ),
          ),
          locked: true,
          note: waitNote,
        }
      : null;
  const rowsOf = (group: SplitLine[]): ReceiptLine[] =>
    group.map((l) => {
      const g = l.goal_id ? goals.data?.find((x) => x.id === l.goal_id) : undefined;
      const deletable =
        canEdit &&
        !(joint && l.kind === 'allowance') &&
        // 합쳐서면 주인이 있는 저금 줄도 누구나 지움(= 그만 모음, 2026-11-12 D1). ‘금액만 보여 주기’ 파트너 것은 빼고
        !(
          l.kind === 'saving' &&
          g?.owner_user_id &&
          g.owner_user_id !== m.id &&
          !(joint && g.visibility === 'all')
        );
      // 보내기 줄(5e)은 직접 못 고침(월급 − 용돈, 서버 send_locked). 합쳐서 남의 용돈 줄은 주인만,
      // 한 사람 관리형이면 관리하는 사람도(5f)
      const send = l.kind === 'send';
      // 저축·투자 줄(2026-11-19 시안): 오른쪽 굵은 금액 + 이름 아래 보조 한 줄 “모은 금액 1,240만 원, 목표 금액의 62%”
      // + 목표 금액이 있으면 4px 진행 막대. 자동 줄은 보조 줄 끝 “자동으로 나가요”.
      // 눌러서 W-10 상세로(편집하기 중에는 금액 시트). 같이 모으기에 든 저금은 내 몫만
      const si =
        l.kind === 'saving' && l.goal_id && !edit && saving.ready
          ? saving.byId(l.goal_id)
          : undefined;
      const othersAllowance = joint && l.kind === 'allowance' && !!l.user_id && l.user_id !== m.id;
      const lineLocked = theirs || send || (othersAllowance && sp.manager_user_id !== m.id);
      // 보조 줄(2026-11-19 짧게): 자동 정보가 맨 앞, 모은 금액 0원은 뺌(core savingLineNote)
      const savedNote = si
        ? savingLineNote(
            {
              saved: si.saved,
              target: si.target,
              pct: si.pct,
              achieved: si.state === 'achieved',
              bundled: si.bundled,
            },
            won,
          )
        : undefined;
      const autoNote = receiptAutoNote(l, baseDay, !joint && owner === m && !!m?.payday_none);
      const note = joinLineNote(autoNote, [
        send ? copy.sendNote : waitLine && l.id === waitLine.id ? waitNote : savedNote,
      ]);
      return {
        id: l.id,
        name: nameOf(l),
        amount: won(l.amount),
        label: si
          ? spoken(
              copy.savingRowLabel(
                nameOf(l),
                won(l.amount),
                won(si.saved),
                si.target !== null && !si.bundled ? (si.pct ?? 0) : null,
              ),
            )
          : spoken(copy.rowLabel(nameOf(l), won(l.amount))),
        locked: lineLocked,
        fresh: l.id === fresh,
        note,
        // 2026-11-26: 0%면 막대를 그리지 않음(끊긴 구분선처럼 보여서). 보조 줄 “목표 금액 …”은 그대로
        progress:
          si && si.target !== null && !si.bundled && (si.state === 'achieved' || si.bar > 0)
            ? { percent: si.state === 'achieved' ? 100 : si.bar }
            : undefined,
        // 2026-11-26 ‘W-01 정리 A안’: 누르면 열리는 줄은 모두 오른쪽 ›(저축·투자 → W-10, 지출 → 금액 시트), 금액 끝선을 한 줄로
        go: !!(si && !si.private && l.goal_id && !lineLocked) || (canEdit && !lineLocked),
        onOpen:
          si && !si.private && l.goal_id && !lineLocked
            ? () => nav(savingPaths.item(l.goal_id as string))
            : canEdit && !lineLocked
              ? () => {
                  if (!offline()) setSheet({ line: l });
                }
              : undefined,
        onDelete: deletable && !send ? () => remove(l, 'edit') : undefined,
      };
    });
  const rowLabels = {
    handle: copy.handle,
    up: copy.moveUp,
    down: copy.moveDown,
    moved: copy.moved,
    remove: copy.remove,
    removeLabel: copy.removeLabel,
    locked: copy.locked,
  };
  const customs = serverLines.filter((l) => l.kind === 'custom').length;
  // 5d 같이 쓰는 통장 입구(‘+ 지출 추가’ 선택 시트): 같이 쓰는 생활비 ‘아니요’(O-30)이고 통장 줄이 없으면 시트 없이 바로 이름 칩. 나중에는 ‘+ 지출 추가’ 칩 끝
  // ‘같이 쓰는 통장’으로 엶(2026-11-16 4차 검토 R4-4)
  const sharedOn = sp.shared_living !== false || lines.some((l) => l.kind === 'shared_account');
  // ── 요약 카드 월급(20 W-01 3·3b, 2026-11-19 사용자 결정): 큰 금액 + 연필을 누르면 월급 금액 시트(내 월급만, S-11과 같은 저장 길
  // schedule_salary_change 이번 달부터). 합쳐서 + 파트너 합류면 큰 금액은 합계(누르지 않음)이고 사람마다 한 줄(내 것만 연필).
  // 상대 줄·파트너 탭은 보기만, 상대 월급이 0원이면 “{이름}님이 입력해요”
  const twoPeople = joint && !!p;
  const myIncomeName = twoPeople ? copy.incomeRowOf(m.nickname ?? '') : copy.incomeRow;
  const openIncome = () => {
    if (offline()) return;
    track('salary_line_edit_opened', { joint, was_zero: (m.monthly_income ?? 0) === 0 });
    setSheet({ income: true });
  };
  const canEditIncome = !theirs && !edit;
  const incomePeople =
    twoPeople && p
      ? [m, p].map((x) => {
          const mineRow = x.id === m.id;
          const name = copy.incomeRowOf(x.nickname ?? '');
          const value = x.monthly_income ?? 0;
          return {
            id: `income-${x.id}`,
            name,
            amount: shown(won(value)),
            label: spoken(
              mineRow ? copy.incomeRowLabel(name, won(value)) : copy.rowLabel(name, won(value)),
            ),
            locked: !mineRow,
            note: !mineRow && value === 0 ? copy.incomeByPartner(x.nickname ?? '') : undefined,
            onOpen: mineRow && canEditIncome ? openIncome : undefined,
          };
        })
      : undefined;
  const saveIncome = (v: number, day: number | 'last' | null) =>
    run(async () => {
      const old = m.monthly_income ?? 0;
      const thisMonth = todayKst().slice(0, 7);
      const refresh = () =>
        Promise.all(salaryChangeKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (day !== null)
        await updateMe({ payday: day === 'last' ? null : day, payday_last: day === 'last' });
      if (v === old) {
        await refresh();
        return setSheet(null);
      }
      await scheduleSalaryChange({ amount: v, from: thisMonth, until: null });
      track('fact_value_changed', {
        field: 'income',
        change_band: changeBand(old, v),
        source_screen: 'W-01',
      });
      await refresh();
      setSheet(null);
      toast(copy.incomeSaved, {
        label: copy.undo,
        onClick: () =>
          quietly(
            scheduleSalaryChange({ amount: old, from: thisMonth, until: null }).then(refresh),
          ),
      });
    });

  const sheetLine = sheet && 'line' in sheet ? sheet.line : null;
  const sheetIncome = !!sheet && 'income' in sheet;
  const sheetEl = sheetLine ? (
    <PlanSheet
      title={copy.lineAmount(nameOf(sheetLine))}
      amount={sheetLine.amount}
      name={sheetLine.name ?? undefined}
      renamable={sheetLine.kind === 'custom'}
      left0={left + sheetLine.amount}
      masked={masked}
      confirmLabel={copy.ok}
      busy={busy}
      onClose={() => setSheet(null)}
      onConfirm={(v, n, set) =>
        void change(sheetLine, v, n, sheet && 'line' in sheet ? sheet.from : undefined, set)
      }
      settings={{
        value: {
          inChecklist: sheetLine.in_checklist,
          autoPay: sheetLine.auto_pay,
          autoDay: sheetLine.auto_day,
        },
        // 체크리스트에 넣기는 지출 줄만(저금 줄은 늘 켬)
        // 날짜 없는 사람은 확인 목록이 없어 ‘체크리스트에 넣기’를 보이지 않음(07 6장, 2026-11-13 UX B)
        showInChecklist: sheetLine.kind !== 'saving' && baseDay !== null,
        payday: baseDay,
      }}
      notify={
        joint && sheetLine.kind === 'allowance' && sheetLine.user_id && sheetLine.user_id !== m.id
          ? copy.allowanceNotify(personName(sheetLine.user_id))
          : undefined
      }
      onFixIncome={openIncome}
      onDelete={rowsOf([sheetLine])[0]?.onDelete ? () => remove(sheetLine, 'sheet') : undefined}
      deleteLabel={copy.removeLineLabel(nameOf(sheetLine))}
      onItem={
        sheetLine.kind === 'saving' && sheetLine.goal_id
          ? () => nav(savingPaths.item(sheetLine.goal_id ?? ''))
          : undefined
      }
    />
  ) : sheetIncome ? (
    <IncomeSheet
      title={copy.lineAmount(myIncomeName)}
      amount={m.monthly_income ?? 0}
      planned={savingSum + spendSum}
      others={joint ? (p?.monthly_income ?? 0) : 0}
      askDay={!m.payday && !m.payday_last && !m.payday_none}
      masked={masked}
      busy={busy}
      onClose={() => setSheet(null)}
      onConfirm={(v, day) => void saveIncome(v, day)}
    />
  ) : null;

  // 머리 이동 링크 ‘이번 달 월급 체크 ›’는 2026-11-19 사용자 결정으로 없앰(W-02로는 홈 월급 상자·서랍)

  // 같이 모으기 묶음(각자 계열 내 탭, 옛 W-13 묶음 줄)과 ⋯ 메뉴(옛 W-13 ⋯: 통장 잔액과 맞추기 W-10c, 수입 기록 W-20b)
  const bundleList = (bundles.data ?? []).filter((b) =>
    b.goals.some((g) => saving.ready && saving.live.some((i) => i.goal.id === g.id)),
  );
  const savingMenu = [
    ...(saving.ready && saving.live.some((i) => i.canEdit)
      ? [{ label: copy.menuReconcile, onSelect: () => nav(togetherPaths.reconcile) }]
      : []),
    { label: copy.moneyInList, onSelect: () => nav(togetherPaths.moneyInList) },
  ];
  // 파트너 탭(각자)인데 파트너 월급 계획이 없음: 0원 영수증 대신 회색 빈 카드(2026-11-12 D3)
  const partnerNoSplit = !split && theirs;
  const summary = planSummary({
    income,
    saving: savingSum,
    spend: spendSum,
    lines: savingLines.length + spendLines.length,
  });
  // 빈 저축·투자 카드: 저축·투자 줄도 같이 모으기 묶음도 없고 내 것으로 고칠 수 있을 때(파트너 탭 보기만·편집 모드는 없음)
  const savingEmpty =
    !edit && !theirs && canEdit && savingLines.length === 0 && bundleList.length === 0;
  // 빈 지출 카드: 고정지출·생활비·직접 추가 줄이 하나도 없을 때(용돈·보내기 줄은 셈하지 않음). 처음 보인 뒤에는 spendAsk로 칩을 계속 둠
  const spendEmpty =
    !edit &&
    canEdit &&
    !notManager &&
    !spendLines.some((l) => l.kind === 'fixed' || l.kind === 'living' || l.kind === 'custom');
  if (spendEmpty && !spendAsk) setSpendAsk(true);
  const spendChipsShown = spendAsk && !edit && canEdit && !notManager;
  // 줄이 하나도 없으면(저축·투자도 지출도 0개, 월급 금액과 상관없이) 맨 아래 ‘편집하기’·‘공유하기’·‘추천값으로 다시 채우기’를 숨김(2026-11-19 사용자 결정)
  const planEmpty = savingLines.length === 0 && spendLines.length === 0 && !proposalRow;
  const pv = partnerView.data ?? null;
  const limited = theirs && !!pv && !pv.hidden && pv.mode === 'separate' && pv.share !== 'all';
  const column = (
    <div key="l" className="hg-stack">
      {edit ? (
        <SectionHeader
          title={copy.editTitle}
          action={
            <button
              type="button"
              className="hg-btn hg-btn--link"
              aria-busy={busy || undefined}
              onClick={finish}
            >
              {copy.editDone}
            </button>
          }
        />
      ) : (
        <>
          {tabs && p && (
            <Tabs
              label={copy.splitTitle}
              value={ownerId ?? m.id}
              onChange={(v) => {
                const next = new URLSearchParams(params);
                next.set('who', v);
                setParams(next, { replace: true });
              }}
              items={[m, p].map((x) => ({
                value: x.id,
                label: x.nickname ?? '',
                lead: (
                  <PersonDot
                    name={x.nickname ?? ''}
                    starter={x.id === sp.created_by}
                    userId={x.id}
                  />
                ),
              }))}
            />
          )}
          {theirs && !partnerNoSplit && (
            <p className="hg-q__help" style={{ margin: 0 }}>
              {copy.partnerSplitView(owner?.nickname ?? '')}
            </p>
          )}
          {limited && pv && (
            <p className="hg-q__help" style={{ margin: 0 }}>
              {pv.share === 'saving_only'
                ? copy.partnerSavingOnly(owner?.nickname ?? '')
                : copy.partnerDoneOnly(owner?.nickname ?? '')}
            </p>
          )}
          {pending && !theirs && (
            <p className="hg-q__help" style={{ margin: 0 }}>
              {copy.splitPending}
            </p>
          )}
        </>
      )}
      {partnerNoSplit ? (
        <section className="hg-card hg-card--fill hg-stack">
          <p className="hg-card__meta">{copy.partnerNoPlan(owner?.nickname ?? '')}</p>
        </section>
      ) : limited && pv ? (
        // 3b 저금만 / 했어요만: 머리 금액·지출·여유 자금 없이 서버가 준 줄만(보기만)
        <section className="hg-card hg-stack" aria-label={copy.splitTitle}>
          {pv.lines.length === 0 ? (
            <p className="hg-card__meta">{copy.partnerNoPlan(owner?.nickname ?? '')}</p>
          ) : (
            <div className="hg-list hg-list--plain">
              {pv.lines.map((l) => (
                <ListRow
                  key={l.id}
                  label={
                    l.kind === 'saving'
                      ? (l.name ??
                        (pv.share === 'done_only' ? copy.privateSaving : goalName(l.goal_id)))
                      : l.kind === 'shared_account'
                        ? (l.name ?? copy.sharedAccountName)
                        : (l.name ?? copy.lineNames[l.kind as keyof typeof copy.lineNames] ?? '')
                  }
                  value={
                    l.amount !== null
                      ? shown(won(l.amount))
                      : l.state === 'checked'
                        ? copy.doneThisMonth
                        : copy.notDoneYet
                  }
                  chevron={false}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <PlanStage label={copy.splitTitle}>
          <PlanSummary
            label={copy.incomeRow}
            amount={shown(won(income))}
            amountLabel={spoken(copy.incomeRowLabel(copy.incomeRow, won(income)))}
            onAmount={!twoPeople && canEditIncome ? openIncome : undefined}
            people={incomePeople}
            empty={
              summary.empty
                ? {
                    title: (
                      <>
                        {copy.summaryEmpty[0]}
                        <br />
                        {copy.summaryEmpty[1]}
                      </>
                    ),
                    action: canEditIncome
                      ? { label: copy.summaryEmptyAction, onClick: openIncome }
                      : undefined,
                  }
                : undefined
            }
            // 계획이 월급보다 많으면(입력 없이 넘은 상태: 월급이 줄었거나 상대 월급 변화·해제) “계획이 월급보다 250,000원 많아요”,
            // 2026-11-26 사용자 결정: 빨강은 금액만(.hg-over), 나머지는 평소 굵은 문장 색. 줄이 하나도 없으면 도넛·범례 없이 문장만
            title={
              // 2026-11-26 사용자 결정: 저축·투자가 0원일 때 “월급을 어떻게 나눌지 정해 보세요”는 없앰(막대·범례만)
              summary.over ? (
                <>
                  {copy.overPlan[0]}
                  <span className="hg-over">{shown(won(-summary.left))}</span>
                  {copy.overPlan[1]}
                </>
              ) : summary.noSaving ? undefined : (
                <>
                  {copy.summarySaving[0]}
                  <em>{copy.summaryPct(summary.share)}</em>
                  {copy.summarySaving[1]}
                </>
              )
            }
            bar={
              summary.chart
                ? [
                    { kind: 'saving', percent: summary.bar.saving },
                    { kind: 'spend', percent: summary.bar.spend },
                    { kind: 'free', percent: summary.bar.free },
                  ]
                : undefined
            }
            barLabel={spoken(copy.ratioLabel(ratio.saving, ratio.spend, legend[2]?.text ?? ''))}
            legend={
              summary.chart
                ? [
                    // 2026-11-26 ‘W-01 정리 A안’: 범례는 금액 없이 이름 + 회색 퍼센트(금액 가리기에도 그대로).
                    // 미계획만 퍼센트 대신 금액(“0원”, 모자라면 “−300,000원” 빨강)
                    { kind: 'saving', name: copy.savingGroup, percent: ratio.saving },
                    { kind: 'spend', name: copy.spendGroup, percent: ratio.spend },
                    {
                      kind: 'free',
                      name: copy.legendFreeName,
                      amount: shown(won(left)),
                      short: summary.over,
                    },
                  ]
                : undefined
            }
          />
          <PlanCard id="saving" title={copy.savingGroup} sum={shown(won(savingSum))}>
            <ReceiptRows
              label={copy.savingGroup}
              lines={rowsOf(savingLines)}
              edit={edit}
              onMove={edit ? moveIn(savingLines) : undefined}
              labels={rowLabels}
            />
            {!edit && !theirs && bundleList.length > 0 && (
              <div className="hg-goallist" aria-label={copy.together}>
                {bundleList.map((b) => (
                  <div key={b.id}>
                    <BundleRow
                      bundle={b}
                      masked={masked}
                      open={openBundle === b.id}
                      onToggle={() => setOpenBundle((x) => (x === b.id ? null : b.id))}
                    />
                    {openBundle === b.id &&
                      b.goals.map((g) => {
                        const i = saving.ready ? saving.byId(g.id) : undefined;
                        if (!i) return null;
                        return g.mine || (b.show_each && !b.percent_only) ? (
                          <SavingGoalRow
                            key={g.id}
                            item={i}
                            masked={masked}
                            onClick={() => nav(savingPaths.item(g.id))}
                          />
                        ) : (
                          <ListRow
                            key={g.id}
                            label={copy.bundlePartnerRow(
                              saving.ready ? saving.partnerName : '',
                              g.name,
                            )}
                          />
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
            {savingEmpty ? (
              <>
                {/* 2026-11-26 사용자 결정: 안내 한 줄 “무엇을 모을지 골라 보세요”는 없앰(칩만, 화면 읽기 이름으로는 남김) */}
                <div className="hg-receipt__chips" role="group" aria-label={copy.savingEmptyAsk}>
                  {savingStartChips(sp.marriage_status).map((c) => {
                    const name = c === 'custom' ? '' : copy.chipNames[c];
                    return (
                      <Chip
                        key={c}
                        small
                        onClick={() => {
                          // 오프라인이면 W-11로 가지 않음(20 W-01 ‘오프라인’, S5-08)
                          if (offline()) return;
                          writeDraft({ ...EMPTY_DRAFT, name, custom: c === 'custom' });
                          nav(`${savingPaths.add}?from=split`);
                        }}
                      >
                        {c === 'custom' ? copy.savingEmptyCustom : name}
                      </Chip>
                    );
                  })}
                </div>
              </>
            ) : (
              canEdit && (
                <PlanAdd
                  onClick={() => {
                    // 오프라인이면 W-11로 가지 않음(20 W-01 ‘오프라인’, S5-08)
                    if (!offline()) nav(`${savingPaths.add}?from=split`);
                  }}
                >
                  {copy.addItemInReceipt}
                </PlanAdd>
              )
            )}
            {/* 그만 모은 저축·투자(옛 W-13 맨 아래와 같음): 접힌 줄, 펼치면 이름 + 모은 금액 → W-10 */}
            {!edit && closed.length > 0 && (
              <button
                type="button"
                className="hg-foldrow"
                aria-expanded={fold}
                onClick={() => setFold((x) => !x)}
              >
                <span>{copy.closedFold(closed.length)}</span>
                <Icon name={fold ? 'chevron-up' : 'chevron-down'} size={16} />
              </button>
            )}
            {!edit &&
              fold &&
              closed.map((g) => (
                <ListRow
                  key={g.id}
                  label={g.name}
                  value={won(saved.data?.[g.id] ?? 0)}
                  onClick={() => nav(savingPaths.item(g.id))}
                />
              ))}
          </PlanCard>
          <PlanCard title={copy.spendGroup} sum={shown(won(spendSum))}>
            {/* 용돈 줄 먼저(맨 위 고정, 2026-11-16 R4-3), 그 아래 나머지 지출 */}
            {allowanceLines.length > 0 && (
              <ReceiptRows
                label={copy.allowanceRows}
                lines={rowsOf(allowanceLines)}
                edit={edit}
                onMove={edit ? moveIn(allowanceLines) : undefined}
                labels={rowLabels}
              />
            )}
            <ReceiptRows
              label={copy.spendGroup}
              lines={proposalRow ? [...rowsOf(otherSpend), proposalRow] : rowsOf(otherSpend)}
              edit={edit}
              onMove={edit ? moveIn(otherSpend) : undefined}
              labels={rowLabels}
            />
            {spendChipsShown && (
              <>
                {/* 2026-11-26 사용자 결정: 안내 한 줄 “매달 나가는 지출을 골라 보세요”는 없앰(칩만) */}
                <div className="hg-receipt__chips" role="group" aria-label={copy.spendEmpty.ask}>
                  {copy.spendEmpty.chips
                    .filter((c) => !spendLines.some((l) => nameOf(l) === c.name))
                    .map((c) => (
                      <Chip
                        key={c.code}
                        small
                        onClick={() => {
                          if (!offline())
                            openSpendForm({ name: c.name, chip: c.code, first: true });
                        }}
                      >
                        {c.name}
                      </Chip>
                    ))}
                  <Chip
                    small
                    onClick={() => {
                      if (!offline())
                        openSpendForm({ name: '', chip: null, first: true, custom: true });
                    }}
                  >
                    {copy.spendEmpty.other}
                  </Chip>
                </div>
              </>
            )}
            {!spendEmpty && canEdit && customs < MAX_CUSTOM && (
              <PlanAdd
                onClick={() => {
                  if (offline()) return;
                  // 같이 쓰는 통장을 쓸 수 있으면 먼저 작은 선택 시트(지출 / 같이 쓰는 통장), 아니면 바로 지출 추가
                  if (sharedOn) setPick(true);
                  else openSpendForm({ name: '', chip: null, first: false });
                }}
              >
                {copy.addSpend}
              </PlanAdd>
            )}
          </PlanCard>
        </PlanStage>
      )}
      <BundleAchieveWatch />
    </div>
  );
  if (spendForm)
    return (
      <W01eSpendAdd
        chips={spendForm.first ? copy.spendEmpty.chips : copy.spendChips}
        taken={spendLines.map((l) => nameOf(l))}
        initial={spendForm}
        left0={left}
        masked={masked}
        baseDay={baseDay}
        busy={busy}
        more={
          spendForm.first || sharedOn
            ? undefined
            : { label: copy.sharedAccountChip, onClick: () => nav('/salary/split/new') }
        }
        onBack={closeSpendForm}
        onFixIncome={() => {
          closeSpendForm();
          openIncome();
        }}
        onConfirm={(o) => {
          if (spendLines.some((l) => nameOf(l) === o.name)) return toast(copy.duplicateName);
          void add(o.name, o.chip, o.amount, spendForm.first && o.chip === 'living', o.settings);
        }}
      />
    );
  // 2026-11-26 ‘W-01 정리 A안’: 흩어진 동작 입구(머리 ‘편집’, 저축·투자 묶음 ⋯, 맨 아래 ‘공유하기’·‘추천값으로 다시 채우기’)를
  // 머리 오른쪽 ⋯ 하나(화면 읽기 “더 보기”)로 모음. 좁은 창 = 앱 머리 오른쪽, 넓은 창 = 제목 줄. 편집 중에는 없음(‘완료’)
  const headActions: MenuAction[] = edit
    ? []
    : [
        ...(!planEmpty && canEdit
          ? [
              {
                label: copy.editShort,
                onSelect: () => {
                  if (offline()) return;
                  setOrder(null);
                  setEdit(true);
                },
              },
            ]
          : []),
        ...(theirs ? [] : savingMenu),
        ...(!planEmpty ? [{ label: copy.share, onSelect: () => void share() }] : []),
        ...(!planEmpty && canEdit
          ? [
              {
                label: copy.refill,
                onSelect: () => {
                  if (!offline()) setRefill(true);
                },
              },
            ]
          : []),
      ];
  const headMenu =
    headActions.length > 0 ? <Menu label={copy.headMore} actions={headActions} /> : undefined;
  return (
    <>
      <MainFrame
        current="salary"
        page={{
          title: copy.planTitle,
          actions: headMenu ? <span className="hg-wide-only">{headMenu}</span> : undefined,
        }}
        narrowAction={headMenu}
        // W-02 링크로 열었으면 ‹ = W-02(2026-11-18), 서랍·홈에서 열었으면 홈
        onBack={fromMonth ? () => nav(-1) : undefined}
        columns={[column]}
      />
      {sheetEl}
      {pick && (
        <BottomSheet title={copy.addPick.title} onClose={() => setPick(false)}>
          <div className="hg-list hg-list--plain">
            <ListRow
              label={copy.addPick.spend}
              onClick={() => {
                setPick(false);
                openSpendForm({ name: '', chip: null, first: false });
              }}
            />
            <ListRow
              label={copy.addPick.account}
              onClick={() => {
                setPick(false);
                nav('/salary/split/new');
              }}
            />
          </div>
        </BottomSheet>
      )}
      {askFor && (
        <SavingAskSheet
          ask={askFor.ask}
          goalId={askFor.id}
          partnerName={saving.ready ? saving.partnerName : ''}
          onClose={() => setAskFor(null)}
        />
      )}
      {stop && (
        <Modal
          title={copy.stopQ(nameOf(stop))}
          body={copy.afterStopSub}
          confirmLabel={copy.afterStop}
          cancelLabel={copy.cancel}
          busy={busy}
          onCancel={() => setStop(null)}
          onConfirm={() => void stopSaving(stop)}
        />
      )}
      {refill && (
        <Modal
          title={copy.refillTitle}
          body={copy.refillBody}
          confirmLabel={copy.refillOk}
          cancelLabel={copy.cancel}
          tone="primary"
          busy={busy}
          onCancel={() => setRefill(false)}
          onConfirm={doRefill}
        />
      )}
    </>
  );
}
