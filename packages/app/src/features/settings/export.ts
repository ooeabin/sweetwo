import type { ExportData } from '@sweetwo/api';
import { assetGroup, formatDot, toCsv, todayKst } from '@sweetwo/core';
import { describeProposal, type Names } from '../proposals';
import { copy } from './copy';

// S-18 내보내기(엑셀 CSV, zip 하나에 시트별). 범위: 내 데이터(내 명의 항목 + 내가 쓴 기록) / 공동 데이터
// (공동 항목·목표·월 플랜·월말 정리·챙길 날·제안 + 배우자 항목은 공개 범위대로: 전체 공개는 행, 합계만은 합계 한 줄).
// 서프라이즈·비공개는 서버(RLS)가 이미 거름. 사진은 빠짐.

export type Scope = 'mine' | 'joint';

const kindName = (grp: string, kind: string) => {
  const g = assetGroup(grp);
  return g?.kinds.find((x) => x.key === kind)?.name.replace('(직접 입력)', '') ?? g?.name ?? kind;
};

export function buildExport(
  d: ExportData,
  scope: Scope,
  n: Names & { mySide: 'groom' | 'bride' | null },
): { name: string; text: string }[] {
  const owner = (a: ExportData['assets'][number]) =>
    a.owner === 'joint' ? copy.ex.joint : a.owner_user_id === n.myId ? n.myName : n.partnerName;
  const inScope = (a: ExportData['assets'][number]) =>
    scope === 'mine'
      ? a.owner === 'person' && a.owner_user_id === n.myId
      : a.owner === 'joint' || (a.owner_user_id !== n.myId && a.visibility === 'all');
  // 배우자 ‘합계만’ 항목은 합계 한 줄
  const partnerSum = (side: 'asset' | 'debt') =>
    scope === 'joint'
      ? d.assets
          .filter(
            (a) =>
              a.side === side &&
              a.owner === 'person' &&
              a.owner_user_id !== n.myId &&
              a.visibility === 'sum',
          )
          .reduce((t, a) => t + a.amount, 0)
      : 0;
  const upd = (s: string | null) => (s ? formatDot(todayKst(new Date(s))) : '');

  const assets = d.assets.filter((a) => a.side === 'asset' && inScope(a));
  const assetRows = assets.map((a) => [
    a.name,
    kindName(a.grp, a.kind),
    owner(a),
    a.amount,
    a.principal,
    a.maturity_date,
    copy.vis[a.visibility],
    upd(a.updated_at),
  ]);
  const ps = partnerSum('asset');
  if (ps)
    assetRows.push([
      copy.ex.partnerSum(n.partnerName),
      '',
      n.partnerName,
      ps,
      null,
      null,
      copy.vis.sum,
      '',
    ]);

  const debts = d.assets.filter((a) => a.side === 'debt' && inScope(a));
  const debtRows = debts.map((a) => [
    a.name,
    kindName(a.grp, a.kind),
    owner(a),
    a.amount,
    a.interest_rate,
    a.monthly_payment,
    a.maturity_date,
  ]);
  const pd = partnerSum('debt');
  if (pd)
    debtRows.push([copy.ex.partnerSum(n.partnerName), '', n.partnerName, pd, null, null, null]);

  const files = [
    { name: copy.ex.files.assets, text: toCsv(copy.ex.heads.assets, assetRows) },
    { name: copy.ex.files.debts, text: toCsv(copy.ex.heads.debts, debtRows) },
  ];
  if (scope === 'mine') {
    const mineRecords = d.careRecords.filter((r) => r.created_by === n.myId);
    files.push({
      name: copy.ex.files.care,
      text: toCsv(copy.ex.heads.care, careRows(d, mineRecords)),
    });
    return files;
  }

  // 공동: 목표, 월급 플랜, 월말 정리, 챙길 날, 제안
  const lastPlan = d.plans[d.plans.length - 1];
  const doneClose = new Set(d.closes.filter((c) => c.status === 'done').map((c) => c.id));
  const held = (gid: string, other: number) =>
    other +
    d.deposits
      .filter((x) => x.goal_id === gid && doneClose.has(x.month_close_id))
      .reduce((t, x) => t + x.amount, 0);
  files.push({
    name: copy.ex.files.goals,
    text: toCsv(
      copy.ex.heads.goals,
      d.goals.map((g) => [
        g.name,
        copy.ex.goalKinds[g.kind] ?? g.kind,
        g.target_amount,
        held(g.id, g.other_held),
        g.deadline,
        g.priority,
        copy.ex.goalStatus[g.status] ?? g.status,
        lastPlan?.plan_line.find((l) => l.goal_id === g.id)?.amount ?? null,
      ]),
    ),
  });
  const mineCol = (l: ExportData['plans'][number]['plan_line'][number], who: 'me' | 'partner') => {
    const side =
      who === 'me'
        ? n.mySide
        : n.mySide === 'groom'
          ? 'bride'
          : n.mySide === 'bride'
            ? 'groom'
            : null;
    return side === 'groom' ? l.amount_groom : side === 'bride' ? l.amount_bride : null;
  };
  const goalName = (id: string | null) => d.goals.find((g) => g.id === id)?.name ?? '';
  files.push({
    name: copy.ex.files.plans,
    text: toCsv(
      copy.ex.heads.plans(n.myName, n.partnerName),
      d.plans.flatMap((p) =>
        p.plan_line
          .filter((l) => !l.deleted_at)
          .sort((a, b) => a.sort - b.sort)
          .map((l) => [
            p.label_month.slice(0, 7),
            l.target === 'goal' ? goalName(l.goal_id) : (copy.ex.roles[l.account_role ?? ''] ?? ''),
            l.amount,
            mineCol(l, 'me'),
            mineCol(l, 'partner'),
            copy.ex.lineState[l.state] ?? l.state,
            l.done_amount,
          ]),
      ),
    ),
  });
  const planMonth = (id: string) => d.plans.find((p) => p.id === id)?.label_month.slice(0, 7) ?? '';
  const whoName = (id: string | null) => (id === n.myId ? n.myName : id ? n.partnerName : '');
  files.push({
    name: copy.ex.files.closes,
    text: toCsv(
      copy.ex.heads.closes,
      d.closes.map((c) => [
        planMonth(c.plan_id),
        d.deposits.filter((x) => x.month_close_id === c.id).reduce((t, x) => t + x.amount, 0),
        c.income,
        copy.ex.closeStatus[c.status] ?? c.status,
        whoName(c.closed_by),
        c.closed_at ? formatDot(todayKst(new Date(c.closed_at))) : '',
      ]),
    ),
  });
  files.push({
    name: copy.ex.files.care,
    text: toCsv(copy.ex.heads.care, careRows(d, d.careRecords)),
  });
  const goalsForNames = d.goals.map((g) => ({ id: g.id, name: g.name }));
  files.push({
    name: copy.ex.files.proposals,
    text: toCsv(
      copy.ex.heads.proposals,
      d.proposals.map((p) => {
        const line = describeProposal(p, n, goalsForNames);
        return [
          formatDot(todayKst(new Date(p.created_at))),
          line.label,
          `${line.before} → ${line.after}`,
          p.response ? (copy.ex.responses[p.response] ?? p.response) : '',
          copy.ex.proposalStatus[p.status] ?? p.status,
        ];
      }),
    ),
  });
  return files;
}

function careRows(d: ExportData, records: ExportData['careRecords']) {
  return records.map((r) => {
    const day = d.careDays.find((c) => c.id === r.care_day_id);
    return [
      r.occurs_on,
      day?.name ?? '',
      day ? (copy.ex.careCats[day.category] ?? day.category) : '',
      day?.budget ?? null,
      r.amount,
      copy.ex.paidFrom[r.paid_from] ?? r.paid_from,
      [...r.gifts, r.gift_name].filter(Boolean).join(', '),
    ];
  });
}
