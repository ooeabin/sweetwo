import { createInvite, insertTodos, qk, updateTodo, type Proposal } from '@sweetwo/api';
import { addDays, todoDefs, visibleTodos, type TodoDef, type TodoState } from '@sweetwo/core';
import { Badge, Button } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  describeProposal,
  proposalCopy,
  proposalArrived,
  proposerName,
  type GoalName,
  type Names,
} from '../proposals';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useTodos } from './data';

const SHOWN = 3;
/** 여는 화면이 만들어진 할 일 → 경로 */
export const OPENS: Partial<Record<TodoDef['kind'], string>> = {
  assets: '/assets/week/assets',
  loans: '/assets/week/loans',
  fixed_card: '/assets/week/fixed',
  rest: '/goals/week',
  invest: '/assets/principle',
};

// H-04 할 일(Checklist 카드). 최대 3개, 첫 주 할 일은 하루 하나씩 열림. ‘내일 할게요’로 미룸.
// 받은 제안이 맨 위(19 H-04 순서), 줄을 누르면 G-08. 여는 화면이 있는 할 일(자산 정리 O-41, 대출 정리 O-44, 고정지출 O-37, 나머지 목표·상여금·다른 수입 O-22, 투자 원칙 O-53)은 글자를 누르면 그 화면.
// 나머지(O-41 등)는 화면이 아직 없어 이동하지 않는다. 초대는 ‘코드 복사’.
export function H04Todos({
  state,
  today,
  partner,
  received = [],
  names,
  goals = [],
  tops = [],
}: {
  /** 맨 위 할 일(연결 해제 요청 받음 S-12d > 다시 연결 요청 받음 S-12g) */
  tops?: { key: string; title: string; sub?: string; to: string }[];
  state: TodoState;
  today: string;
  partner: string;
  received?: Proposal[];
  names?: Names;
  goals?: GoalName[];
}) {
  const nav = useNavigate();
  const todos = useTodos();
  const qc = useQueryClient();
  const defs = todoDefs(state);

  // 있어야 할 할 일이 없으면 한 번 넣는다(종류마다 하나)
  const ensured = useRef(false);
  useEffect(() => {
    if (!todos.data || ensured.current) return;
    ensured.current = true;
    const missing = defs.filter((d) => !todos.data.some((t) => t.kind === d.kind));
    if (!missing.length) return;
    void insertTodos(
      missing.map((d) => ({ kind: d.kind, screen: d.screen, open_on: d.openOn, sort: d.sort })),
    )
      .then(() => qc.invalidateQueries({ queryKey: qk.todos }))
      .catch(() => undefined);
  }, [todos.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!todos.data) return null;
  const visible = visibleTodos(defs, todos.data, today);
  const proposals = names ? received : [];
  const top = tops.length;
  const left = top + proposals.length + visible.length;
  if (!left) return null; // 모두 끝나면 카드가 사라짐

  const rowOf = (d: TodoDef) => todos.data.find((t) => t.kind === d.kind);
  const snooze = async (d: TodoDef) => {
    const r = rowOf(d);
    if (!r) return;
    try {
      await updateTodo(r.id, { status: 'snoozed', snoozed_until: addDays(today, 1) });
      await qc.invalidateQueries({ queryKey: qk.todos });
    } catch {
      toast(copy.loadFailed);
    }
  };
  const copyCode = async () => {
    try {
      const inv = await createInvite();
      await navigator.clipboard.writeText(inv.code);
      toast(copy.copied);
    } catch {
      toast(copy.inviteFailed);
    }
  };
  const label = (d: TodoDef) =>
    d.kind === 'invite' ? copy.todoLabels.invite(partner) : copy.todoLabels[d.kind];

  return (
    <section className="hg-checklist" style={{ maxWidth: 'none' }} aria-label={copy.todos}>
      <div className="hg-checklist__head">
        <b>{copy.todos}</b>
        <span>{copy.todosLeft(left)}</span>
      </div>
      <div className="hg-checklist__list">
        {tops.map((t) => (
          <button key={t.key} type="button" className="hg-task" onClick={() => nav(t.to)}>
            <span className="hg-check" role="img" aria-label={copy.todoLeftState} />
            <span className="hg-task__text">
              <span className="hg-task__title">{t.title}</span>
              {t.sub && <span className="hg-task__sub">{t.sub}</span>}
            </span>
          </button>
        ))}
        {names &&
          proposals.slice(0, SHOWN - top).map((p) => {
            const line = describeProposal(p, names, goals);
            return (
              <button
                key={p.id}
                type="button"
                className="hg-task"
                onClick={() => nav(`/proposals/${p.id}`)}
              >
                <span className="hg-check" role="img" aria-label={copy.todoLeftState} />
                <span className="hg-task__text">
                  <span className="hg-task__title">
                    {proposalArrived(p, proposerName(names, p.proposer), goals)}
                  </span>
                  <span className="hg-task__sub">
                    {proposalCopy.change(line.before, line.after)}
                  </span>
                </span>
                {p.together && <Badge kind="warn">{proposalCopy.together}</Badge>}
              </button>
            );
          })}
        {visible.slice(0, Math.max(0, SHOWN - top - proposals.length)).map((d) => (
          <div key={d.kind} className="hg-task">
            <span className="hg-check" role="img" aria-label={copy.todoLeftState} />
            {OPENS[d.kind] ? (
              // 여는 화면이 있는 할 일: 글자 부분이 버튼(옆 ‘내일 할게요’와 겹치지 않게)
              <button
                type="button"
                className="hg-task__text"
                onClick={() => nav(OPENS[d.kind] ?? '/')}
              >
                <span className="hg-task__title">{label(d)}</span>
                {d.minutes !== undefined && (
                  <span className="hg-task__sub">{copy.minutes(d.minutes)}</span>
                )}
              </button>
            ) : (
              <span className="hg-task__text">
                <span className="hg-task__title">{label(d)}</span>
                {d.minutes !== undefined && (
                  <span className="hg-task__sub">{copy.minutes(d.minutes)}</span>
                )}
              </span>
            )}
            {d.kind === 'invite' ? (
              <Button variant="secondary" size="sm" onClick={() => void copyCode()}>
                {copy.copyCode}
              </Button>
            ) : (
              <button type="button" className="hg-btn hg-btn--link" onClick={() => void snooze(d)}>
                {copy.tomorrow}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
