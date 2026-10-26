import { fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import { formatMonthDay, homeTodo, homeUpcoming, salaryState, type TraySnapshot } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { detectPlatform } from '../../platform';
import { useMe, usePartner } from './data';
import { useHomeInput } from './home-input';
import { todoText, upcomingName } from './home-text';

// 트레이 위젯 값(26 트레이 위젯 창 = WG-01 이번 달 월급 + 다음 할 일 + WG-03 다가오는 날). 앱 창(앱 기본 틀)에서
// 홈과 같은 계산(core homeTodo·upcoming·salaryState)으로 만들어 데스크톱 main으로 보냄. 웹·모바일에서는 아무것도 안 함.
export function useTraySync() {
  const desktop = detectPlatform() === 'desktop';
  const h = useHomeInput(desktop);
  const me = useMe();
  const partner = usePartner();
  const solo = h.input?.coupleState === 'solo';
  const ex = useQuery({
    queryKey: qk.unlinkPartner,
    queryFn: fetchUnlinkPartnerName,
    enabled: desktop && solo && !!h.input?.reconnectFrom,
  });
  const last = useRef('');
  const i = h.input;
  useEffect(() => {
    const bridge = window.sweetwo?.widget;
    if (!desktop || !bridge || !i || !me.data) return;
    const s = salaryState(i);
    const noSalary = s.state === 'none' && !me.data.monthly_income && !!me.data.onboarding_done_at;
    const todo = homeTodo(i);
    const snap: Omit<TraySnapshot, 'at'> = {
      salary:
        s.state === 'none'
          ? { state: noSalary ? 'no_salary' : 'none', label: '', done: 0, total: 0, left: 0, payday: null }
          : {
              state: s.state,
              label: s.label,
              done: s.done,
              total: s.total,
              left: s.left,
              payday: s.nextPayday,
            },
      task: todo
        ? {
            title: todoText(todo, {
              partner: partner.data?.nickname ?? '',
              exPartner: ex.data ?? '',
            }),
            to: todo.to,
          }
        : null,
      days: homeUpcoming(i)
        .slice(0, 3)
        .map((u) => ({
          dday: u.dday,
          name: upcomingName(u, me.data?.nickname ?? ''),
          date: formatMonthDay(u.date),
          money: u.kind !== 'care',
          to: u.kind === 'care' ? u.to : '/calendar/list',
        })),
    };
    const key = JSON.stringify(snap);
    if (key === last.current) return;
    last.current = key;
    void bridge.update({ ...snap, at: new Date().toISOString() }).catch(() => {
      last.current = '';
    });
  }, [desktop, i, me.data, partner.data, ex.data]);
}
