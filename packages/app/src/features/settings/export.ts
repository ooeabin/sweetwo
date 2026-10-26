import type { ExportData } from '@sweetwo/api';
import { assetGroup, formatDot, toCsv, todayKst } from '@sweetwo/core';
import { copy } from './copy';

// S-18 내보내기(엑셀 CSV, zip 하나에 시트별, 25 S-18). 범위: 내 데이터(내 명의 항목, 내 분배표·체크리스트, 내가 쓴 기록)
// / 공동 데이터(공동 항목·목표·분배표·체크리스트·챙길 날 + 배우자 항목은 공개 범위대로: 전체 공개는 행, 합계만은 합계 한 줄).
// 서프라이즈·비공개는 서버(RLS)가 이미 거름. 사진은 빠짐.

export type Scope = 'mine' | 'joint';
export type Names = { myId: string; myName: string; partnerName: string };

const kindName = (grp: string, kind: string) => {
  const g = assetGroup(grp);
  return g?.kinds.find((x) => x.key === kind)?.name.replace('(직접 입력)', '') ?? g?.name ?? kind;
};

export function buildExport(
  d: ExportData,
  scope: Scope,
  n: Names,
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
  const whoName = (id: string | null) => (id === n.myId ? n.myName : id ? n.partnerName : '');
  const goalName = (id: string | null) => d.goals.find((g) => g.id === id)?.name ?? '';
  const lineName = (l: {
    kind: string;
    goal_id: string | null;
    name: string | null;
    user_id: string | null;
  }) =>
    l.kind === 'saving'
      ? goalName(l.goal_id)
      : l.kind === 'custom'
        ? (l.name ?? '')
        : l.kind === 'allowance' && l.user_id
          ? `${copy.ex.lineKinds.allowance}(${whoName(l.user_id)})`
          : (copy.ex.lineKinds[l.kind] ?? l.kind);
  const mine = (owner: string | null) => scope === 'joint' || owner === n.myId;
  const splitRows = d.splits
    .filter((x) => mine(x.owner_user_id))
    .flatMap((x) =>
      [...x.split_line]
        .sort((a, b) => a.sort - b.sort)
        .map((l) => [
          x.owner_user_id ? whoName(x.owner_user_id) : copy.ex.joint,
          copy.ex.lineKinds[l.kind] ?? l.kind,
          lineName(l),
          l.amount,
        ]),
    );
  const checkRows = d.checklists
    .filter((c) => mine(c.owner_user_id))
    .flatMap((c) =>
      [...c.pay_check_line]
        .sort((a, b) => a.sort - b.sort)
        .map((l) => [
          c.label,
          c.owner_user_id ? whoName(c.owner_user_id) : copy.ex.joint,
          lineName(l),
          l.actual ?? l.planned,
          copy.ex.checkState[l.state] ?? l.state,
          whoName(l.checked_by),
          l.checked_at ? formatDot(todayKst(new Date(l.checked_at))) : '',
        ]),
    );
  files.push(
    { name: copy.ex.files.splits, text: toCsv(copy.ex.heads.splits, splitRows) },
    { name: copy.ex.files.checklists, text: toCsv(copy.ex.heads.checklists, checkRows) },
  );
  if (scope === 'mine') {
    const mineRecords = d.careRecords.filter((r) => r.created_by === n.myId);
    files.push({
      name: copy.ex.files.care,
      text: toCsv(copy.ex.heads.care, careRows(d, mineRecords)),
    });
    return files;
  }

  // 공동: 목표(모은 돈, 분배표 저금 금액 = 보이는 분배표의 그 목표 줄 합), 챙길 날
  const monthly = (gid: string) =>
    d.splits
      .flatMap((x) => x.split_line)
      .filter((l) => l.kind === 'saving' && l.goal_id === gid)
      .reduce((t, l) => t + l.amount, 0);
  files.push({
    name: copy.ex.files.goals,
    text: toCsv(
      copy.ex.heads.goals,
      d.goals.map((g) => [
        g.name,
        copy.ex.goalKinds[g.kind] ?? g.kind,
        g.target_amount,
        d.saved[g.id] ?? g.other_held,
        g.deadline,
        g.priority,
        copy.ex.goalStatus[g.status] ?? g.status,
        monthly(g.id),
      ]),
    ),
  });
  files.push({
    name: copy.ex.files.care,
    text: toCsv(copy.ex.heads.care, careRows(d, d.careRecords)),
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
