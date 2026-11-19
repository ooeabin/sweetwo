import {
  addSplitLine,
  configureSplitLines,
  deleteSplitLine,
  dismissHomeTask,
  fetchHomeTasks,
  fetchSharedAccounts,
  qk,
  reopenSavingItem,
  reorderSplit,
  saveSplit,
  setSplitLine,
  SplitBlocked,
  type SplitLine,
} from '@sweetwo/api';
import {
  amountBand,
  coupleOf,
  leftover,
  planChangeTouchesMonth,
  planRatio,
  salaryChangedTaskOpen,
  savingStartChips,
  todayKst,
} from '@sweetwo/core';
import {
  Button,
  Chip,
  Icon,
  ListRow,
  Menu,
  Modal,
  PlanBar,
  ReceiptAdd,
  ReceiptCard,
  ReceiptHead,
  ReceiptRows,
  ReceiptSection,
  ReceiptStage,
  ReceiptTotal,
  SectionHeader,
  Tabs,
  type ReceiptLine,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
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
import { baseDayOf, nextDayOf as nextDay, receiptAutoPill, salaryChangedDay } from '../cycle';
import { useQuery } from '@tanstack/react-query';
import { fetchPartnerPlanView, fetchSalaryChanges } from '@sweetwo/api';
import { BundleRow } from '../bundle-parts';
import { savingPaths, togetherPaths } from '../paths';
import { EMPTY_DRAFT, writeDraft } from '../saving-draft';
import { shareReceipt, type ReceiptImageModel } from '../receipt-image';
import { FirstSpendAsk, PlanSheet, SpendChips, type LineSettings } from '../receipt-parts';
import { SalaryLoadError, SalaryLoading } from '../salary-tab';
import { SavingAskSheet, SavingGoalRow } from '../saving-parts';
import { useSavingItems } from '../saving';
import { useBundles } from '../together';
import { BundleAchieveWatch } from './w-12-bundle-achieved';
import { keepOrder, recommendedDraft } from '../split-draft';
import { toDraft } from '../split-editor';

// from: W-10 ‘매달 금액 바꾸기’(?line=)로 연 시트(분석 entry saving_detail, 주소의 line은 열자마자 지움)
type Sheet =
  | { line: SplitLine; from?: 'saving_detail' }
  | { add: string; chip: string | null; first?: boolean }
  | null;
type Kind = SplitLine['kind'];
const DEFAULT_KINDS: Kind[] = ['fixed', 'living', 'allowance'];
const MAX_CUSTOM = 10;
/** 첫 달 ‘매달 나가는 지출’ 묻기를 끝낸 표시(home_task_state, 사람마다, 2026-11-16 R4) */
const FIRST_SPEND_KEY = 'first_spend_ask';

// W-01 월급 계획 영수증(20 W-01, 2026-11-09). 별도 화면(/salary/plan, 2026-11-18 구간 탭 없앰).
// 고칠 때마다 바로 저장(줄 RPC) + Toast ‘되돌리기’. 편집 모드: 손잡이·위아래로 순서(‘완료’에서 한 번에), 지우기.
// 각자 + 파트너 합류면 사람 탭(?who=), 파트너 탭은 보기만(자물쇠, 서버 not_owner). 해제 대기 중 보기만.
// ?line={저금 항목 id}: 그 저금 줄 금액 시트를 열고 시작(W-10 ‘매달 금액 바꾸기’).
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
  const [adding, setAdding] = useState(false);
  const [stop, setStop] = useState<SplitLine | null>(null);
  const [refill, setRefill] = useState(false);
  const [fold, setFold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  // 첫 달 묻기 카드: 처음 판단한 값을 끝날 때까지 유지(줄을 넣어도 카드가 사라지지 않게). null = 아직 판단 전
  const [ask, setAsk] = useState<boolean | null>(null);
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
  const newParam = params.get('new');
  const askParam = params.get('ask');
  const scrolled = useRef(false);
  const qc = useQueryClient();
  const changes = useQuery({ queryKey: qk.salaryChanges, queryFn: fetchSalaryChanges });
  const homeTasks = useQuery({ queryKey: qk.homeTasks, queryFn: fetchHomeTasks });
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

  // W-11로 방금 만든 저축·투자(`?new=`, 2026-11-18): 그 줄을 잠깐 강조 + 묶음으로 스크롤. `?ask=`면 같이 모을까요·초대 물음 시트
  useEffect(() => {
    if (!newParam || !split) return;
    const l = split.split_line.find((x) => x.goal_id === newParam);
    if (!l) return;
    setFresh(l.id);
    if (askParam === 'bundle' || askParam === 'invite') setAskFor({ ask: askParam, id: newParam });
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('ask');
    setParams(next, { replace: true });
  }, [newParam, askParam, split, params, setParams]);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 2000);
    return () => clearTimeout(t);
  }, [fresh]);
  const planReady = !!(me.data && space.data && goals.data && splits.data);
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

  // 첫 달 묻기(20 W-01 ‘첫 달 묻기’): 내가 고칠 수 있는 내 월급 계획(합쳐서면 공동)이고, 아직 지출 줄(고정지출·생활비·직접 추가)이
  // 없고, 끝낸 표시가 없을 때 한 번. 한 사람 관리형의 관리하지 않는 쪽(보내기·용돈만)에게는 묻지 않음
  const notManager =
    space.data?.salary_mode === 'joint' &&
    !!space.data.manager_user_id &&
    space.data.manager_user_id !== me.data?.id;
  useEffect(() => {
    if (ask !== null || !split || !homeTasks.data) return;
    const hasSpend = split.split_line.some(
      (l) => l.kind === 'fixed' || l.kind === 'living' || l.kind === 'custom',
    );
    setAsk(canEdit && !notManager && !hasSpend && !homeTasks.data.includes(FIRST_SPEND_KEY));
  }, [ask, split, homeTasks.data, canEdit, notManager]);

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
  const dayText = (u: { payday: number | null; payday_last: boolean } | null | undefined) =>
    !u ? null : u.payday_last ? copy.paydayLast : u.payday ? copy.payday(u.payday) : null;
  const sub = joint
    ? (() => {
        const parts = [m, p]
          .filter((x): x is NonNullable<typeof x> => !!x)
          .map((x) => ({ x, d: dayText(x) }))
          .filter((x) => x.d);
        if (parts.length === 1 && parts[0]) return copy.everyMonth(parts[0].d ?? '');
        return copy.jointPaydays(
          parts.map(({ x, d }) => copy.personPayday(x.nickname ?? '', d ?? '')),
        );
      })()
    : ownerId === m.id && m.payday_none
      ? copy.noPaydayHead // 날짜 없음(20 W-01 예외)
      : dayText(owner)
        ? copy.everyMonth(dayText(owner) ?? '')
        : undefined;
  const people = (joint && p ? [m, p] : owner ? [owner] : []).map((x) => ({
    id: x.id,
    name: x.nickname ?? '',
    starter: x.id === sp.created_by,
  }));
  const closed = goals.data.filter(
    (g) => !g.deleted_at && !!g.closed_at && (joint || g.owner_user_id === ownerId),
  );
  const whose = joint ? 'joint' : theirs ? 'partner' : 'self';

  // ── 쓰기(줄마다 바로 저장) ─────────────────────────────────────────────
  const offline = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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

  const add = (name: string, chip: string | null, amount: number, first = false) =>
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
      setSheet(null);
      setAdding(false);
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
      setAdding(false);
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

  // 첫 달 묻기 끝(‘다 넣었어요’ / ‘건너뛸게요’): 다시 묻지 않게 서버에 표시. 넣은 줄 = 지금 지출 줄(카드는 지출 줄이 없을 때만 뜸)
  const asked = spendLines.filter(
    (l) => l.kind === 'fixed' || l.kind === 'living' || l.kind === 'custom',
  ).length;
  const firstDone = (skipped: boolean) =>
    void run(async () => {
      await dismissHomeTask(FIRST_SPEND_KEY, skipped ? 'dismissed' : 'done');
      setAsk(false);
      setAdding(false);
      track('first_spend_asked', {
        answer: skipped ? 'skipped' : 'done',
        lines_count: asked,
        joint,
      });
      void qc.invalidateQueries({ queryKey: qk.homeTasks });
    });

  // ── 공유(이미지) ─────────────────────────────────────────────────────
  const legend = [
    { kind: 'saving' as const, text: copy.legendSaving(ratio.saving) },
    { kind: 'spend' as const, text: copy.legendSpend(ratio.spend) },
    ratio.free === null
      ? { kind: 'free' as const, text: copy.legendShort(won(left)), short: true }
      : { kind: 'free' as const, text: copy.legendFree(ratio.free) },
  ];
  const bar = [
    { kind: 'saving' as const, percent: ratio.saving },
    { kind: 'spend' as const, percent: ratio.spend },
    { kind: 'free' as const, percent: ratio.free ?? 0 },
  ];
  const totals = [
    { label: copy.allocated, amount: won(savingSum + spendSum) },
    left >= 0
      ? { label: copy.leftoverLabel, amount: won(left), strong: true }
      : { label: copy.leftoverLabel, amount: copy.short(won(-left)), strong: true, short: true },
  ];
  const totalRows = totals.map((r) => ({ ...r, amount: shown(r.amount) }));
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const model: ReceiptImageModel = {
      people: people.map((x) => ({ no: x.starter ? 1 : 2, name: x.name })),
      amount: won(income),
      sub,
      bar,
      legend,
      sections: [
        {
          title: copy.savingGroup,
          subtotal: won(savingSum),
          rows: savingLines.map((l) => ({ name: nameOf(l), amount: won(l.amount) })),
        },
        {
          title: copy.spendGroup,
          subtotal: won(spendSum),
          rows: spendLines.map((l) => ({ name: nameOf(l), amount: won(l.amount) })),
        },
      ],
      totals,
    };
    try {
      const r = await shareReceipt(model, copy.imageName(todayKst()));
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
      // 저축·투자 줄(2026-11-18): 큰 금액 “매달 30만 원” + 보조 “모은 금액 1,240만 원” + 목표 금액이 있으면 진행 막대와 “목표 금액의 62%”.
      // 눌러서 W-10 상세로(편집하기 중에는 금액 시트). 같이 모으기에 든 저금은 내 몫만
      const si =
        l.kind === 'saving' && l.goal_id && !edit && saving.ready
          ? saving.byId(l.goal_id)
          : undefined;
      const othersAllowance = joint && l.kind === 'allowance' && !!l.user_id && l.user_id !== m.id;
      const lineLocked = theirs || send || (othersAllowance && sp.manager_user_id !== m.id);
      return {
        id: l.id,
        name: nameOf(l),
        amount: si ? copy.monthlyShort(won(l.amount)) : won(l.amount),
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
        note: send
          ? copy.sendNote
          : waitLine && l.id === waitLine.id
            ? waitNote
            : si
              ? si.bundled
                ? copy.myShare(won(si.saved))
                : copy.listSaved(won(si.saved))
              : undefined,
        progress:
          si && si.target !== null && !si.bundled
            ? {
                percent: si.state === 'achieved' ? 100 : si.bar,
                label: si.state === 'achieved' ? copy.achieved : copy.targetPct(si.pct ?? 0),
              }
            : undefined,
        auto: receiptAutoPill(l, baseDay, !joint && owner === m && !!m?.payday_none),
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
  // 5d “+ 같이 쓰는 통장 추가”: 같이 쓰는 생활비 ‘아니요’(O-30)이고 통장 줄이 없으면 숨김. 나중에는 ‘+ 지출 추가’ 칩 끝
  // ‘같이 쓰는 통장’으로 엶(2026-11-16 4차 검토 R4-4)
  const sharedOn = sp.shared_living !== false || lines.some((l) => l.kind === 'shared_account');
  const lead =
    people.length > 1 ? (
      <span className="hg-avatars">
        {people.map((x) => (
          <PersonDot
            key={x.id}
            name={x.name}
            starter={x.starter}
            userId={x.id}
            className="hg-avatar--lg"
          />
        ))}
      </span>
    ) : people[0] ? (
      <PersonDot
        name={people[0].name}
        starter={people[0].starter}
        userId={people[0].id}
        className="hg-avatar--lg"
      />
    ) : null;

  const sheetLine = sheet && 'line' in sheet ? sheet.line : null;
  const sheetAdd = sheet && 'add' in sheet ? sheet : null;
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
      onDelete={rowsOf([sheetLine])[0]?.onDelete ? () => remove(sheetLine, 'sheet') : undefined}
      deleteLabel={copy.removeLineLabel(nameOf(sheetLine))}
      onItem={
        sheetLine.kind === 'saving' && sheetLine.goal_id
          ? () => nav(savingPaths.item(sheetLine.goal_id ?? ''))
          : undefined
      }
    />
  ) : sheetAdd ? (
    <PlanSheet
      title={copy.lineAmount(sheetAdd.add)}
      amount={0}
      left0={left}
      masked={masked}
      confirmLabel={copy.addDone}
      busy={busy}
      notify={copy.addMyShareHint}
      onClose={() => setSheet(null)}
      onConfirm={(v) => void add(sheetAdd.add, sheetAdd.chip, v, !!sheetAdd.first)}
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
  const noSplit = !split && !theirs;
  // 파트너 탭(각자)인데 파트너 월급 계획이 없음: 0원 영수증 대신 회색 빈 카드(2026-11-12 D3)
  const partnerNoSplit = !split && theirs;
  const pv = partnerView.data ?? null;
  const limited = theirs && !!pv && !pv.hidden && pv.mode === 'separate' && pv.share !== 'all';
  const column = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
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
      {ask && canEdit && !edit && (
        <FirstSpendAsk
          taken={spendLines.map((l) => nameOf(l))}
          added={asked}
          busy={busy}
          onPick={(name, chip) => {
            if (!offline()) setSheet({ add: name, chip, first: true });
          }}
          onOther={() => {
            if (!offline()) setAdding(true);
          }}
          onDone={firstDone}
        />
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
      ) : noSplit ? (
        // 월급 없음: W-02와 같은 빈 카드
        <section className="hg-card hg-card--fill hg-stack">
          <p className="hg-card__meta">{copy.noChecklist}</p>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => nav('/settings/me')}
          >
            {copy.tellSalary}
          </button>
        </section>
      ) : (
        <ReceiptStage label={copy.splitTitle}>
          <ReceiptCard className={edit ? 'is-edit' : undefined}>
            <ReceiptHead
              lead={lead}
              // 누를 수 있으면 버튼 이름(amountLabel)이 읽히고, 아니면 글자(가리기면 “가려진 금액”)
              amount={!theirs && !edit ? won(income) : shown(won(income))}
              sub={sub}
              onAmount={!theirs && !edit ? () => nav('/settings/me') : undefined}
              amountLabel={spoken(copy.incomeLabel(won(income)))}
            />
            <PlanBar
              label={spoken(copy.ratioLabel(ratio.saving, ratio.spend, legend[2]?.text ?? ''))}
              parts={bar}
              legend={legend}
            />
            <ReceiptSection
              id="saving"
              title={copy.savingGroup}
              subtotal={shown(won(savingSum))}
              action={
                !edit && !theirs && savingMenu.length > 0 ? (
                  <Menu label={copy.menu} actions={savingMenu} />
                ) : undefined
              }
            >
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
              {!edit &&
                !theirs &&
                canEdit &&
                savingLines.length === 0 &&
                bundleList.length === 0 && (
                  <>
                    <p className="hg-receipt__empty">{copy.savingEmptyAsk}</p>
                    <div
                      className="hg-receipt__chips"
                      role="group"
                      aria-label={copy.savingEmptyAsk}
                    >
                      {savingStartChips(sp.marriage_status).map((c) => {
                        const name = c === 'custom' ? '' : copy.chipNames[c];
                        return (
                          <Chip
                            key={c}
                            small
                            onClick={() => {
                              // 오프라인이면 W-11로 가지 않음(20 W-01 ‘오프라인’, S5-08)
                              if (offline()) return;
                              writeDraft({ ...EMPTY_DRAFT, name });
                              nav(`${savingPaths.add}/a?from=split`);
                            }}
                          >
                            {c === 'custom' ? copy.savingEmptyCustom : name}
                          </Chip>
                        );
                      })}
                    </div>
                  </>
                )}
              {canEdit && (
                <ReceiptAdd
                  onClick={() => {
                    // 오프라인이면 W-11로 가지 않음(20 W-01 ‘오프라인’, S5-08)
                    if (!offline()) nav(`${savingPaths.add}/a?from=split`);
                  }}
                >
                  {copy.addItemInReceipt}
                </ReceiptAdd>
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
            </ReceiptSection>
            <ReceiptSection title={copy.spendGroup} subtotal={shown(won(spendSum))}>
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
              {canEdit && customs < MAX_CUSTOM && (
                <ReceiptAdd
                  expanded={adding}
                  onClick={() => {
                    if (!offline()) setAdding((x) => !x);
                  }}
                >
                  {copy.addSpend}
                </ReceiptAdd>
              )}
              {canEdit && sharedOn && (
                // 5d 같이 쓰는 통장 → W-01b 분담 도우미(PR 11)
                <ReceiptAdd onClick={() => nav('/salary/split/new')}>
                  {copy.addSharedAccount}
                </ReceiptAdd>
              )}
              {adding && canEdit && (
                <SpendChips
                  more={
                    sharedOn
                      ? undefined
                      : { label: copy.sharedAccountChip, onClick: () => nav('/salary/split/new') }
                  }
                  taken={spendLines.map((l) => nameOf(l))}
                  onPick={(name, chip) => {
                    if (spendLines.some((l) => nameOf(l) === name))
                      return toast(copy.duplicateName);
                    setSheet({ add: name, chip });
                  }}
                />
              )}
            </ReceiptSection>
            <ReceiptTotal rows={totalRows} />
          </ReceiptCard>
          {!edit && (
            <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
              {canEdit && (
                <Button
                  variant="outline"
                  block
                  onClick={() => {
                    if (offline()) return;
                    setOrder(null);
                    setEdit(true);
                  }}
                >
                  {copy.editPlan}
                </Button>
              )}
              <div className="hg-receipt-actions">
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  aria-busy={sharing || undefined}
                  onClick={() => void share()}
                >
                  {copy.share}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="hg-btn hg-btn--link hg-btn--quiet"
                    onClick={() => {
                      if (!offline()) setRefill(true);
                    }}
                  >
                    {copy.refill}
                  </button>
                )}
              </div>
            </div>
          )}
        </ReceiptStage>
      )}
      <BundleAchieveWatch />
    </div>
  );
  return (
    <>
      <MainFrame
        current="salary"
        page={{ title: copy.planTitle }}
        // W-02 링크로 열었으면 ‹ = W-02(2026-11-18), 서랍·홈에서 열었으면 홈
        onBack={fromMonth ? () => nav(-1) : undefined}
        columns={[column]}
      />
      {sheetEl}
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
