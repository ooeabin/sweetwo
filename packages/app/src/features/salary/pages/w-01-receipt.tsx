import {
  addSplitLine,
  deleteSplitLine,
  reopenSavingItem,
  reorderSplit,
  saveSplit,
  setSplitLine,
  SplitBlocked,
  type SplitLine,
} from '@sweetwo/api';
import { amountBand, leftover, planChangeTouchesMonth, planRatio, todayKst } from '@sweetwo/core';
import {
  Button,
  Icon,
  ListRow,
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
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  useChecklists,
  useGoalSaved,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  useSplits,
  useSplitWrite,
} from '../data';
import { salaryPaths, savingPaths } from '../paths';
import { shareReceipt, type ReceiptImageModel } from '../receipt-image';
import { PlanSheet, SpendChips } from '../receipt-parts';
import { SalaryLoadError, SalaryLoading, SalarySeg } from '../salary-tab';
import { keepOrder, recommendedDraft } from '../split-draft';
import { toDraft } from '../split-editor';

// from: W-10 ‘매달 금액 바꾸기’(?line=)로 연 시트(분석 entry saving_detail, 주소의 line은 열자마자 지움)
type Sheet =
  { line: SplitLine; from?: 'saving_detail' } | { add: string; chip: string | null } | null;
type Kind = SplitLine['kind'];
const DEFAULT_KINDS: Kind[] = ['fixed', 'living', 'allowance'];
const MAX_CUSTOM = 10;

// W-01 월급 계획 영수증(20 W-01, 2026-11-09). 월급 탭 구간 탭 ‘계획’(/salary?view=plan).
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
  const who = params.get('who');
  const lineParam = params.get('line');

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
  const nameOf = (l: Pick<SplitLine, 'kind' | 'goal_id' | 'user_id' | 'name'>) =>
    l.kind === 'saving'
      ? goalName(l.goal_id)
      : l.kind === 'custom'
        ? (l.name ?? '')
        : l.kind === 'allowance' && joint
          ? `${personName(l.user_id)} ${copy.lineNames.allowance}`
          : copy.lineNames[l.kind];
  const won = (v: number) => money(v, masked);
  // 보이는 금액 글자(가리기면 화면 읽기는 “가려진 금액”, 11 9장)
  const shown = (text: string) => speakMasked(text);
  const income = joint
    ? (m.monthly_income ?? 0) + (p?.monthly_income ?? 0)
    : (owner?.monthly_income ?? 0);
  const savingLines = lines.filter((l) => l.kind === 'saving');
  const spendLines = lines.filter((l) => l.kind !== 'saving');
  const sum = (ls: SplitLine[]) => ls.reduce((s, l) => s + l.amount, 0);
  const savingSum = sum(savingLines);
  const spendSum = sum(spendLines);
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

  const change = (l: SplitLine, amount: number, rawName: string, from?: 'saving_detail') =>
    run(async () => {
      const renamed = l.kind === 'custom' && rawName !== '' && rawName !== l.name;
      const moved = amount !== l.amount;
      if (!renamed && !moved) return setSheet(null);
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

  const add = (name: string, chip: string | null, amount: number) =>
    run(async () => {
      if (!split) return;
      const id = await write(() => addSplitLine(split.id, { kind: 'custom', name, amount }));
      setSheet(null);
      setAdding(false);
      track('plan_line_added', {
        source: chip ? 'chip' : 'text',
        chip,
        amount_band: amountBand(amount),
        joint,
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

  // 편집 모드 순서: 같은 묶음 안에서만
  const moveIn = (group: SplitLine[]) => (from: number, to: number) => {
    const ids = group.map((l) => l.id);
    const [id] = ids.splice(from, 1);
    if (!id) return;
    ids.splice(to, 0, id);
    const saving = group[0]?.kind === 'saving' ? ids : savingLines.map((l) => l.id);
    const spend = group[0]?.kind === 'saving' ? spendLines.map((l) => l.id) : ids;
    setOrder([...saving, ...spend]);
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
      people: people.map((x) => (x.starter ? 1 : 2)),
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
  const rowsOf = (group: SplitLine[]): ReceiptLine[] =>
    group.map((l) => {
      const g = l.goal_id ? goals.data?.find((x) => x.id === l.goal_id) : undefined;
      const deletable =
        canEdit &&
        !(joint && l.kind === 'allowance') &&
        !(l.kind === 'saving' && g?.owner_user_id && g.owner_user_id !== m.id);
      return {
        id: l.id,
        name: nameOf(l),
        amount: won(l.amount),
        label: spoken(copy.rowLabel(nameOf(l), won(l.amount))),
        locked: theirs,
        onOpen: canEdit
          ? () => {
              if (!offline()) setSheet({ line: l });
            }
          : undefined,
        onDelete: deletable ? () => remove(l, 'edit') : undefined,
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
      onConfirm={(v, n) =>
        void change(sheetLine, v, n, sheet && 'line' in sheet ? sheet.from : undefined)
      }
      onDelete={rowsOf([sheetLine])[0]?.onDelete ? () => remove(sheetLine, 'sheet') : undefined}
      deleteLabel={copy.removeLabel(nameOf(sheetLine))}
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
      onClose={() => setSheet(null)}
      onConfirm={(v) => void add(sheetAdd.add, sheetAdd.chip, v)}
    />
  ) : null;

  // 머리 아래 한 줄 ‘이번 달 3/5 체크했어요 ›’(2026-11-09) → 그 사람 이번 달(W-02). 이번 체크리스트가 없거나 편집 중이면 없음
  const monthChecked = month?.pay_check_line.filter((l) => l.state === 'checked').length ?? 0;
  const monthTotal = month?.pay_check_line.length ?? 0;
  const monthLink =
    month && monthTotal > 0 && !edit ? (
      <button
        type="button"
        className="hg-receipt__link"
        aria-label={copy.monthLinkLabel(monthChecked, monthTotal)}
        onClick={() => {
          track('plan_link_tapped', { whose, checked: monthChecked, total: monthTotal });
          nav(theirs && p ? `${salaryPaths.checklist}?who=${p.id}` : salaryPaths.checklist);
        }}
      >
        {copy.monthLink(monthChecked, monthTotal)}
        <Icon name="chevron-right" size={16} />
      </button>
    ) : undefined;

  const noSplit = !split && !theirs;
  // 파트너 탭(각자)인데 파트너 월급 계획이 없음: 0원 영수증 대신 회색 빈 카드(2026-11-12 D3)
  const partnerNoSplit = !split && theirs;
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
          <SalarySeg value="plan" />
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
              extra={monthLink}
            />
            <PlanBar
              label={spoken(copy.ratioLabel(ratio.saving, ratio.spend, legend[2]?.text ?? ''))}
              parts={bar}
              legend={legend}
            />
            <ReceiptSection title={copy.savingGroup} subtotal={shown(won(savingSum))}>
              <ReceiptRows
                label={copy.savingGroup}
                lines={rowsOf(savingLines)}
                edit={edit}
                onMove={edit ? moveIn(savingLines) : undefined}
                labels={rowLabels}
              />
              {canEdit && (
                <ReceiptAdd
                  onClick={() => {
                    // 오프라인이면 W-11로 가지 않음(20 W-01 ‘오프라인’, S5-08)
                    if (!offline()) nav(`${savingPaths.add}/a?from=split`);
                  }}
                >
                  {copy.addItem}
                </ReceiptAdd>
              )}
            </ReceiptSection>
            <ReceiptSection title={copy.spendGroup} subtotal={shown(won(spendSum))}>
              <ReceiptRows
                label={copy.spendGroup}
                lines={rowsOf(spendLines)}
                edit={edit}
                onMove={edit ? moveIn(spendLines) : undefined}
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
              {adding && canEdit && (
                <SpendChips
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
      {/* 그만 모은 저금(20 W-01 10번): 접힌 줄, 펼치면 이름 + 모은 금액 → W-10 */}
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
    </div>
  );
  return (
    <>
      <MainFrame current="salary" page={{ title: copy.tabTitle }} columns={[column]} />
      {sheetEl}
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
