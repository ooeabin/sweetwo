import { qk, updateGoal, updateIfUnchanged, type Goal } from '@sweetwo/api';
import {
  amountBand,
  conflictDecision,
  formatYm,
  readWon,
  thisMonth,
  ymToDate,
  type YearMonth,
} from '@sweetwo/core';
import {
  AmountInput,
  Button,
  ConflictChoice,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
  YearMonthInput,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems } from '../saving';

type Field = 'amount' | 'deadline' | 'name';
type Patch = Partial<Pick<Goal, 'name' | 'target_amount' | 'deadline'>>;
class ConflictFound extends Error {
  constructor(readonly current: Goal) {
    super('conflict');
  }
}

// W-10a 저금 항목 고치기(20): 목표 금액 Q3(+ ‘목표 금액 지우기’), 기한 Q4(+ ‘기한 지우기’, 이번 달 이전 안 됨), 이름 Q5.
// 저장 = 바로 반영 + Toast ‘되돌리기’. 우리 둘 항목(합쳐서)은 상대 알림·활동 기록(서버).
// 목표 금액을 처음 정할 때(`?first=1`)는 저장 뒤 기한으로 이어짐. 매달 금액은 W-01에서.
// 합쳐서 모드에서 파트너가 1분 안에 같은 칸을 바꿨으면 충돌 선택(ConflictChoice, 30 동기화 2장). 비교 기준은 이 화면을 열 때 값
export function W10aSavingEdit() {
  const { id = '', field = 'amount' } = useParams();
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const live = d.ready ? d.byId(id)?.goal : undefined;
  // 열 때 값(충돌 비교 기준). 같은 화면에서 칸이 바뀌면(목표 금액 → 기한) 다시 잡음
  const [opened, setOpened] = useState<{ field: string; goal: Goal } | null>(null);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [ym, setYm] = useState<YearMonth | null | undefined>(undefined);
  const [name, setName] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ patch: Patch; current: Goal } | null>(null);
  useEffect(() => {
    if (live && opened?.field !== field) setOpened({ field, goal: live });
  }, [live, opened, field]);
  const back = () => nav(savingPaths.item(id), { replace: true });
  if (!d.ready) return <QuestionSkeleton />;
  const g = (opened?.field === field ? opened.goal : undefined) ?? live;
  const f = field as Field;
  const item = d.byId(id);
  if (!g || !item || !['amount', 'deadline', 'name'].includes(f))
    return <Navigate to={salaryPaths.checklist} replace />;
  if (!item.canEdit || item.state === 'closed')
    return <Navigate to={savingPaths.item(id)} replace />;
  // 기한은 목표 금액이 있을 때만
  if (f === 'deadline' && g.target_amount === null)
    return <Navigate to={savingPaths.edit(id, 'amount')} replace />;

  const curAmount = amount === undefined ? g.target_amount : amount;
  const curYm =
    ym === undefined ? ((g.deadline?.slice(0, 7) as YearMonth | undefined) ?? null) : ym;
  const curName = name ?? g.name;
  const err =
    f === 'deadline' && curYm && curYm < thisMonth() ? copy.notBeforeThisMonth : undefined;
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );

  /** 열 때 값이 그대로면 바꿈. force면 묻지 않고 덮음(‘내 값’ 고름) */
  const write = async (patch: Patch, force: boolean) => {
    if (force) return updateGoal(g.id, patch);
    const base: Patch = Object.fromEntries(Object.keys(patch).map((k) => [k, g[k as keyof Patch]]));
    const r = await updateIfUnchanged('goal', g.id, patch, base);
    if (r.ok) return;
    const dec = conflictDecision(r.current, patch, d.meId);
    if (dec === 'same') return;
    if (dec === 'choose') throw new ConflictFound(r.current as Goal);
    await updateGoal(g.id, patch);
  };
  const send = async (patch: Patch, text: string, force = false): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    const before: Patch = Object.fromEntries(
      Object.keys(patch).map((k) => [k, g[k as keyof Patch]]),
    );
    try {
      await write(patch, force);
      setConflict(null);
      toast(text, {
        label: copy.undo,
        onClick: () => void updateGoal(g.id, before).then(refresh),
      });
      await refresh();
      return true;
    } catch (e) {
      if (e instanceof ConflictFound) {
        setConflict({ patch, current: e.current });
        return false;
      }
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void send(patch, text, force) });
      void refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };
  const after = (ok: boolean) => {
    if (!ok) return;
    // 목표 금액을 처음 정했으면 기한으로 이어짐(20 W-10a)
    if (f === 'amount' && first) nav(savingPaths.edit(id, 'deadline'), { replace: true });
    else back();
  };

  const changed =
    f === 'amount'
      ? curAmount !== null && curAmount !== g.target_amount
      : f === 'deadline'
        ? !!curYm && ymToDate(curYm) !== g.deadline?.slice(0, 10)
        : !!curName.trim() && curName.trim() !== g.name;
  const submit = async () => {
    if (!changed || err) return after(true);
    if (f === 'amount') {
      track('saving_item_target_set', {
        had_target: g.target_amount !== null,
        has_deadline: g.deadline !== null,
        target_band: amountBand(curAmount ?? 0),
      });
      return after(await send({ target_amount: curAmount }, copy.amountChanged));
    }
    if (f === 'deadline')
      return after(await send({ deadline: ymToDate(curYm as YearMonth) }, copy.deadlineChanged));
    return after(await send({ name: curName.trim() }, copy.nameChanged));
  };
  const title =
    f === 'amount' ? copy.addTargetQ : f === 'deadline' ? copy.addDeadlineQ : copy.addNameQ;
  const show = (x: Goal) =>
    f === 'amount'
      ? x.target_amount === null
        ? '-'
        : readWon(x.target_amount)
      : f === 'deadline'
        ? x.deadline
          ? formatYm(x.deadline)
          : '-'
        : x.name;
  const partner = d.partnerName;
  const current =
    f === 'amount'
      ? { target_amount: curAmount }
      : f === 'deadline' && curYm
        ? { deadline: ymToDate(curYm) }
        : { name: curName.trim() };
  return (
    <QuestionLayout
      title={title}
      onBack={back}
      primary={{
        label: copy.saveEdit,
        disabled:
          !!err ||
          (f === 'amount' && !curAmount) ||
          (f === 'deadline' && !curYm) ||
          (f === 'name' && !curName.trim()),
        loading: busy,
      }}
      onSubmit={() => void submit()}
    >
      {f === 'amount' && (
        <AmountInput label={title} value={curAmount} onChange={(v) => setAmount(v)} />
      )}
      {f === 'amount' && g.target_amount !== null && (
        // 목표 금액을 지우면 기한도 같이 지움(20 W-10a 2번)
        <Button
          variant="ghost"
          onClick={() =>
            void send({ target_amount: null, deadline: null }, copy.targetCleared).then(after)
          }
        >
          {copy.clearTarget}
        </Button>
      )}
      {f === 'deadline' && (
        <YearMonthInput
          label={title}
          value={curYm}
          onChange={(v) => setYm((v as YearMonth | null) ?? null)}
          error={err}
        />
      )}
      {f === 'deadline' && g.deadline !== null && (
        <Button
          variant="ghost"
          onClick={() => void send({ deadline: null }, copy.deadlineCleared).then(after)}
        >
          {copy.clearDeadline}
        </Button>
      )}
      {f === 'name' && (
        <ShortText
          label={title}
          value={curName}
          onChange={setName}
          max={20}
          error={curName.trim() ? undefined : copy.nameRequired}
        />
      )}
      {conflict && (
        <ConflictChoice
          title={copy.conflictQ}
          body={copy.conflictBody(partner)}
          mine={{ label: copy.conflictMine, value: show({ ...g, ...current }) }}
          theirs={{ label: copy.conflictTheirs(partner), value: show(conflict.current) }}
          busy={busy}
          onMine={() => void send(conflict.patch, copy.amountChanged, true).then(after)}
          onTheirs={() => {
            setConflict(null);
            void refresh().then(back);
          }}
        />
      )}
    </QuestionLayout>
  );
}
