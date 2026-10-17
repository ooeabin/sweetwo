import {
  completeTodoKind,
  fetchAssets,
  insertAsset,
  qk,
  updateAsset,
  updateSpace,
} from '@sweetwo/api';
import { QUICK_ASSETS, QUICK_LOANS, type QuickPick } from '@sweetwo/core';
import { Tabs } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useAssetsData, useRefreshAssets } from '../data';
import { newItem, useWeekDraft, type WeekItem, type WeekOwner } from './draft';

// 첫 주 자산·대출 정리(17 O-41~47) 공통: 경로, 진행 막대(카드 안 화면 수), 소유자 토글, 저장.
// 넘길 때마다 바로 저장(‘닫기’ = 답 저장, 할 일 유지). 끝까지 가면 할 일을 끝냄.
export const weekPath = {
  assets: '/assets/week/assets',
  asset: (n: number) => `/assets/week/assets/${n}`,
  lump: '/assets/week/lump',
  loans: '/assets/week/loans',
  loan: (n: number, f: 'amount' | 'rate' | 'pay') => `/assets/week/loans/${n}/${f}`,
  fixedStart: '/assets/week/fixed',
  fixed: (n: number) => `/assets/week/fixed/${n}`,
  card: '/assets/week/card',
  bonus: '/assets/week/bonus',
  bonusList: '/assets/week/bonus/list',
  income: '/assets/week/income',
  incomeAmount: (n: number) => `/assets/week/income/${n}`,
};
export const LUMP = 'wedding_left';
export const pickOf = (side: 'assets' | 'loans', key: string): QuickPick | undefined =>
  (side === 'assets' ? QUICK_ASSETS : QUICK_LOANS).find((q) => q.key === key);

export function useWeek(side: 'assets' | 'loans') {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const draft = useWeekDraft((x) => x[side]);
  const setPicks = useWeekDraft((x) => x.setPicks);
  const setItem = useWeekDraft((x) => x.setItem);
  const solo = !!d.couple?.solo;
  const joined = !!d.couple?.joined;
  // 배우자 명의는 합류 전 대신 입력만(합류 뒤에는 상대 명의를 새로 못 만듦)
  const owners: WeekOwner[] = solo ? [] : joined ? ['me', 'joint'] : ['me', 'partner', 'joint'];

  const itemOf = (key: string) => draft.items[key];

  /** 칩 하나를 자산(부채)으로 저장. 이미 저장했으면 고침 */
  const save = async (key: string, p: Partial<WeekItem>): Promise<string | null> => {
    const pick = pickOf(side, key);
    const cur: WeekItem = { ...newItem(), ...draft.items[key], ...p };
    setItem(side, key, p);
    if (!pick || cur.amount === null || !d.me) return null;
    const owner = solo ? 'me' : cur.owner;
    const row = {
      amount: cur.amount,
      owner: owner === 'joint' ? ('joint' as const) : ('person' as const),
      owner_user_id: owner === 'me' ? d.me.id : null,
      // 내 명의 기본 = 합계만(F-03과 같음), 공동·대신 입력은 전체 공개
      visibility: owner === 'me' && !solo ? ('sum' as const) : ('all' as const),
      paid_count: cur.paidCount,
      interest_rate: cur.rate,
      rate_estimated: cur.rateEstimated,
      monthly_payment: cur.payment,
    };
    const id = cur.id
      ? (await updateAsset(cur.id, row), cur.id)
      : await insertAsset({
          side: side === 'assets' ? 'asset' : 'debt',
          grp: pick.grp,
          kind: pick.kind,
          name: pick.name,
          ...row,
        });
    setItem(side, key, { id });
    await refresh();
    return id;
  };

  /** 끝: 할 일 끝냄. 대출은 월 상환액 합계가 O-39 대출 상환 합계를 대신하고 안 나눈 돈을 다시 셈 */
  const finish = async () => {
    if (!d.me) return;
    if (side === 'loans') {
      const pays = draft.picks
        .map((k) => draft.items[k]?.payment)
        .filter((x): x is number => x !== null && x !== undefined);
      if (pays.length) {
        const total = (await fetchAssets())
          .filter((a) => a.side === 'debt' && a.status === 'held')
          .reduce((t, a) => t + (a.monthly_payment ?? 0), 0);
        await updateSpace({ loan_repayment: total });
        await recalcPendingShares();
      }
    }
    await completeTodoKind(side === 'assets' ? 'assets' : 'loans', d.me.id);
    await Promise.all(
      [qk.todos, qk.space, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })),
    );
  };

  const toggle = (key: string) =>
    owners.length ? (
      <Tabs<WeekOwner>
        variant="seg"
        label={copy.weekOwner}
        value={itemOf(key)?.owner ?? 'me'}
        onChange={(owner) => setItem(side, key, { owner })}
        items={owners.map((o) => ({
          value: o,
          label:
            o === 'me'
              ? copy.ownerMe
              : o === 'partner'
                ? (d.couple?.partnerName ?? '')
                : copy.weekTogether,
        }))}
      />
    ) : null;

  return {
    nav,
    d,
    draft,
    setPicks: (picks: string[]) => setPicks(side, picks),
    setItem: (key: string, p: Partial<WeekItem>) => setItem(side, key, p),
    itemOf,
    save,
    finish,
    toggle,
    close: () => nav('/'),
  };
}
