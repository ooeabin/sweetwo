import { createInvite, insertTodos, qk, updateTodo } from '@sweetwo/api';
import { addDays, todoDefs, visibleTodos, type TodoDef, type TodoState } from '@sweetwo/core';
import { Button } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useTodos } from './data';

const SHOWN = 3;

// H-04 할 일(Checklist 카드). 최대 3개, 첫 주 할 일은 하루 하나씩 열림. ‘내일 할게요’로 미룸.
// 여는 화면(O-41 등)은 아직 없어서 줄을 눌러 이동하지는 않는다. 초대는 ‘코드 복사’.
export function H04Todos({
  state,
  today,
  partner,
}: {
  state: TodoState;
  today: string;
  partner: string;
}) {
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
  if (!visible.length) return null; // 모두 끝나면 카드가 사라짐

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
        <span>{copy.todosLeft(visible.length)}</span>
      </div>
      <div className="hg-checklist__list">
        {visible.slice(0, SHOWN).map((d) => (
          <div key={d.kind} className="hg-task">
            <span className="hg-check" role="img" aria-label={copy.todoLeftState} />
            <span className="hg-task__text">
              <span className="hg-task__title">{label(d)}</span>
              {d.minutes !== undefined && (
                <span className="hg-task__sub">{copy.minutes(d.minutes)}</span>
              )}
            </span>
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
