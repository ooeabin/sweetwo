import { formatMonthDay, todoDefs, visibleTodos, type TraySnapshot } from '@sweetwo/core';
import { useEffect, useRef } from 'react';
import { detectPlatform } from '../../platform';
import { copy } from './copy';
import { useTodos } from './data';
import { OPENS } from './h-04-todos';
import { closePath, spendPath } from './paths';
import { useMonthView } from './use-month-view';

// 트레이 위젯 값(26 트레이 위젯 창, WG-01·03 규칙). 앱 창(앱 기본 틀)에서 이번 달 값이 바뀔 때마다 계산해 데스크톱 main으로 보냄.
// 금액 가림은 위젯 창이 설정(S-22)과 앱 가리기를 보고 정함. 웹에서는 아무것도 안 함.
export function useTraySync() {
  const desktop = detectPlatform() === 'desktop';
  const v = useMonthView();
  const todos = useTodos();
  const last = useRef('');
  useEffect(() => {
    const bridge = window.sweetwo?.widget;
    if (!desktop || !bridge || !v || !todos.data) return;
    const kind: TraySnapshot['kind'] = !v.planId
      ? 'no_plan'
      : v.separate
        ? 'gather'
        : v.hasSplit
          ? 'split'
          : 'living';
    const prog = v.split.progress;
    const first = visibleTodos(todoDefs(v.todoState), todos.data, v.today)[0];
    const snap: Omit<TraySnapshot, 'at'> = {
      kind,
      amount:
        kind === 'split'
          ? v.pendingSplit.amount
          : kind === 'gather'
            ? v.wedding.gather.me
            : Math.abs(v.living.left),
      over: kind === 'living' && v.living.over,
      pct:
        kind === 'split'
          ? prog.total
            ? Math.round((prog.done * 100) / prog.total)
            : null
          : kind === 'living'
            ? v.living.pct
            : null,
      done: prog.done,
      total: prog.total,
      payday: v.split.myPayday ? Number(v.split.myPayday.slice(8, 10)) : null,
      closeDays: v.closing ? v.closeDays : null,
      task: first
        ? {
            title:
              first.kind === 'invite'
                ? copy.todoLabels.invite(v.partnerName)
                : copy.todoLabels[first.kind],
            to: OPENS[first.kind] ?? '/',
          }
        : null,
      days: v.events.slice(0, 3).map((e) => ({
        dday: e.dday,
        name:
          e.kind === 'payday'
            ? copy.payday(e.who ?? '')
            : e.kind === 'close'
              ? copy.closeTitle(v.month)
              : copy.wedding,
        date: formatMonthDay(e.date),
        money: e.kind !== 'wedding',
        to: '/calendar',
      })),
      to:
        kind === 'split'
          ? v.closing
            ? closePath
            : '/plan/split'
          : kind === 'living'
            ? v.closing
              ? closePath
              : spendPath
            : '/',
      unlink: false,
    };
    const key = JSON.stringify(snap);
    if (key === last.current) return;
    last.current = key;
    void bridge.update({ ...snap, at: new Date().toISOString() }).catch(() => {
      last.current = '';
    });
  }, [desktop, v, todos.data]);
}
