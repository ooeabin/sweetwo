import {
  AuthCallError,
  checkPayLine,
  qk,
  updateAsset,
  updateGoal,
  updateIfUnchanged,
  type Asset,
  type Goal,
} from '@sweetwo/api';
import { conflictDecision } from '@sweetwo/core';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

// 오프라인 입력 대기열(30 동기화 4장). 인터넷이 없을 때 고친 것은 기기에 순서대로 두고(기기 캐시와 같이 암호화),
// 연결되면 순서대로 보냄. 지금 받는 입력: 월급 체크(W-02·W-05), 목표 금액·기한·이름, 자산 금액.
// - 보낼 때 같은 칸을 배우자가 그 뒤에 바꿨으면 덮지 않고 고르기(conflicts, ConflictChoice)
// - 서버가 거절한 것(지난 체크리스트, 지워진 항목, 권한)은 ‘보내지 못한 입력’(rejected) → 다시 하기 / 버리기
// - 7일 넘게 오프라인이었으면 바로 보내지 않고 목록을 먼저 보여 주고 ‘한 번에 보내기’
export type OutboxOp =
  | {
      id: string;
      at: string;
      label: string;
      kind: 'check';
      lineId: string;
      state: 'checked' | 'wait' | 'skipped';
      actual?: number;
    }
  | {
      id: string;
      at: string;
      label: string;
      kind: 'goal';
      rowId: string;
      patch: Partial<Goal>;
      base: Partial<Goal>;
    }
  | {
      id: string;
      at: string;
      label: string;
      kind: 'asset';
      rowId: string;
      patch: Partial<Asset>;
      base: Partial<Asset>;
    };
export type RejectReason = 'closed' | 'gone' | 'denied';
export interface OutboxConflict {
  op: Extract<OutboxOp, { kind: 'goal' | 'asset' }>;
  /** 배우자가 바꾼 지금 값 */
  current: Record<string, unknown>;
  by: string | null;
}

interface OutboxState {
  ops: OutboxOp[];
  rejected: { op: OutboxOp; reason: RejectReason }[];
  conflicts: OutboxConflict[];
  sending: boolean;
  set: (p: Partial<Omit<OutboxState, 'set'>>) => void;
}
export const useOutbox = create<OutboxState>((set) => ({
  ops: [],
  rejected: [],
  conflicts: [],
  sending: false,
  set: (p) => set(p),
}));

/** 기기 캐시에 같이 두는 모양 */
export type OutboxSaved = Pick<OutboxState, 'ops' | 'rejected' | 'conflicts'>;
export const outboxSnapshot = (): OutboxSaved => {
  const s = useOutbox.getState();
  return { ops: s.ops, rejected: s.rejected, conflicts: s.conflicts };
};
export const restoreOutbox = (o: Partial<OutboxSaved> | undefined) => {
  if (!o) return;
  useOutbox.getState().set({
    ops: o.ops ?? [],
    rejected: o.rejected ?? [],
    conflicts: o.conflicts ?? [],
  });
};

/** 인터넷이 없어서 못 보낸 것인지 */
export function isOfflineError(e: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (e instanceof AuthCallError) return e.code === 'network';
  return e instanceof Error && /fetch|network/i.test(e.message);
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 대기열에 넣음(화면은 이미 바뀐 값으로 그려 둠) */
export type NewOutboxOp = OutboxOp extends infer T ? (T extends unknown ? Omit<T, 'id' | 'at'> : never) : never;
export function enqueue(op: NewOutboxOp) {
  const s = useOutbox.getState();
  s.set({ ops: [...s.ops, { ...op, id: newId(), at: new Date().toISOString() } as OutboxOp] });
}

export const OLD_MS = 7 * 86_400_000;
/** 7일 넘게 기다린 입력이 있으면 먼저 보여 주고 사람이 보냄 */
export const hasOldOps = (now = new Date()) =>
  useOutbox.getState().ops.some((o) => now.getTime() - new Date(o.at).getTime() > OLD_MS);

const reasonOf = (e: unknown): RejectReason =>
  e instanceof Error && /closed/.test(e.message)
    ? 'closed'
    : e instanceof Error && /not_found|gone/.test(e.message)
      ? 'gone'
      : 'denied';

/** 하나 보내기. 'done' | 'offline'(멈춤) | 거절 이유 | 충돌 */
async function sendOne(
  op: OutboxOp,
  meId: string,
): Promise<'done' | 'offline' | { reject: RejectReason } | { conflict: OutboxConflict }> {
  try {
    if (op.kind === 'check') {
      const r = await checkPayLine(op.lineId, op.state, op.actual);
      if (r === 'closed') return { reject: 'closed' };
      return 'done'; // already_checked: 배우자가 먼저 체크 → 그대로
    }
    const table = op.kind;
    const r =
      table === 'goal'
        ? await updateIfUnchanged('goal', op.rowId, op.patch, op.base)
        : await updateIfUnchanged('asset', op.rowId, op.patch, op.base);
    if (r.ok) return 'done';
    const cur = r.current as unknown as Record<string, unknown> & {
      updated_by: string | null;
      updated_at: string;
      deleted_at?: string | null;
    };
    if (cur.deleted_at) return { reject: 'gone' };
    const dec = conflictDecision(cur, op.patch, meId, new Date(), { queued: true });
    if (dec === 'same') return 'done';
    if (dec === 'choose') return { conflict: { op, current: cur, by: cur.updated_by } };
    if (table === 'goal') await updateGoal(op.rowId, op.patch as Partial<Goal>);
    else await updateAsset(op.rowId, op.patch as Partial<Asset>);
    return 'done';
  } catch (e) {
    if (isOfflineError(e)) return 'offline';
    return { reject: reasonOf(e) };
  }
}

/** 순서대로 보냄. 인터넷이 다시 끊기면 멈추고 남김 */
export async function flushOutbox(qc: QueryClient, meId: string) {
  const s = useOutbox.getState();
  if (s.sending || !s.ops.length) return;
  s.set({ sending: true });
  try {
    for (;;) {
      const op = useOutbox.getState().ops[0];
      if (!op) break;
      const r = await sendOne(op, meId);
      if (r === 'offline') break;
      const cur = useOutbox.getState();
      const rest = cur.ops.filter((o) => o.id !== op.id);
      if (r === 'done') cur.set({ ops: rest });
      else if ('reject' in r)
        cur.set({ ops: rest, rejected: [...cur.rejected, { op, reason: r.reject }] });
      else cur.set({ ops: rest, conflicts: [...cur.conflicts, r.conflict] });
    }
  } finally {
    useOutbox.getState().set({ sending: false });
    await Promise.all(
      [['pay_checklist'], qk.goals, qk.goalSaved, qk.goalCheckedSums, qk.assets].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  }
}

/** ‘보내지 못한 입력’ 다시 하기 / 버리기 */
export function retryRejected(id: string) {
  const s = useOutbox.getState();
  const r = s.rejected.find((x) => x.op.id === id);
  if (!r) return;
  s.set({ rejected: s.rejected.filter((x) => x.op.id !== id), ops: [...s.ops, r.op] });
}
export function discardRejected(id: string) {
  const s = useOutbox.getState();
  s.set({ rejected: s.rejected.filter((x) => x.op.id !== id) });
}

/** 대기 입력 충돌 고르기: 내 값이면 덮어 저장, 배우자 값이면 버림 */
export async function resolveOutboxConflict(qc: QueryClient, id: string, mine: boolean) {
  const s = useOutbox.getState();
  const c = s.conflicts.find((x) => x.op.id === id);
  if (!c) return;
  if (mine) {
    if (c.op.kind === 'goal') await updateGoal(c.op.rowId, c.op.patch);
    else await updateAsset(c.op.rowId, c.op.patch);
  }
  useOutbox
    .getState()
    .set({ conflicts: useOutbox.getState().conflicts.filter((x) => x.op.id !== id) });
  await Promise.all([qk.goals, qk.assets].map((k) => qc.invalidateQueries({ queryKey: k })));
}
