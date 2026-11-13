import {
  fetchAssets,
  fetchBundles,
  fetchGoalSaved,
  fetchGoals,
  fetchPartnerPlanView,
  qk,
} from '@sweetwo/api';
import { assetGroup, readWon } from '@sweetwo/core';
import { ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-13p 상대에게 보이는 모습(25 ‘S-13p’, 08 6장): 상대 기기에서 나를 보는 화면을 읽기 전용으로.
// 월급 계획(W-01 파트너 탭)은 서버 필터 partner_plan_view를 ‘상대로서’(p_viewer = 상대) 부른 결과 그대로.
// 같이 모으기(H-10)와 자산은 상대가 실제로 받는 값과 같은 규칙으로 보여 줌(가리는 척 하지 않음):
// - 저금: 저금 이름·목표 금액·모은 금액은 공개 단계와 상관없이 상대에게 보임(goal 읽기, goal_saved_sums).
//   묶음에 넣은 내 저금 금액은 두 사람 모두 ‘각자 모은 금액 보여 주기’를 켰을 때만. 묶음은 합계(퍼센트만이면 %).
// - 자산: 모두 = 항목·금액, 총액만 = 묶음(종류)별 합계만(partner_asset_sums), 숨기기 = 없음. 공동 명의는 늘 보임.
// 연결 해제 대기면 상대에게는 아무것도 안 보임. 분석 share_preview_viewed(한 번).
export function S13pPreview() {
  const nav = useNavigate();
  const d = useSettingsData();
  const partnerId = d.partner?.id ?? null;
  const view = useQuery({
    queryKey: qk.partnerPlanView(partnerId),
    queryFn: () => fetchPartnerPlanView(partnerId ?? undefined),
    enabled: !!partnerId,
  });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const saved = useQuery({ queryKey: qk.goalSaved, queryFn: fetchGoalSaved });
  const bundles = useQuery({
    queryKey: qk.bundles,
    queryFn: () => fetchBundles(),
    enabled: d.space?.salary_mode === 'separate' && !!partnerId,
  });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !view.data) return;
    sent.current = true;
    track('share_preview_viewed', {});
  }, [view.data]);
  if (
    d.loading ||
    !d.me ||
    !d.c ||
    !d.space ||
    (partnerId && view.isLoading) ||
    goals.isLoading ||
    saved.isLoading ||
    assets.isLoading
  )
    return <LoadingFrame sub="settings" current={null} />;
  const me = d.me;
  const c = d.c;
  const joint = d.space.salary_mode === 'joint';
  const v = view.data ?? null;
  const header = (
    <PageHeader
      title={copy.previewTitle(c.partnerName)}
      backLabel={copy.back}
      backTo={copy.visTitle}
      onBack={() => nav('/settings/visibility')}
    />
  );
  const frame = (children: React.ReactNode) => (
    <MainFrame
      sub="settings"
      current={null}
      columns={[
        <div key="p" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          {header}
          {children}
        </div>,
      ]}
    />
  );
  if (!partnerId || !v) return frame(<p className="hg-help">{copy.previewNoPartner}</p>);
  if (v.hidden) return frame(<p className="hg-help">{copy.previewHidden}</p>);

  // 같이 모으기: 묶음(합계 또는 %) + 묶이지 않은 내 저금(같이 계열이면 공동 저금 전부)
  const bundleRows = (bundles.data ?? []).filter((b) => b.status !== 'closed');
  const bundleOpen = new Map(bundleRows.map((b) => [b.id, b.show_each && !b.percent_only]));
  const myGoals = (goals.data ?? []).filter(
    (g) =>
      !g.deleted_at &&
      !g.closed_at &&
      (joint || g.owner_user_id === me.id) &&
      (!g.bundle_id || bundleOpen.get(g.bundle_id)),
  );
  const amountOf = (n: number | null | undefined) => (n == null ? '' : readWon(n));
  const savingSection = (
    <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
      <SectionHeader title={copy.previewSaving} />
      {bundleRows.length + myGoals.length === 0 ? (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.previewNothing}
        </p>
      ) : (
        <div className="hg-list">
          {bundleRows.map((b) => (
            <ListRow
              key={b.id}
              label={b.name}
              value={
                b.percent_only || b.total === null
                  ? `${b.pct ?? 0}%`
                  : b.target
                    ? copy.previewOf(readWon(b.total), readWon(b.target))
                    : readWon(b.total)
              }
              chevron={false}
            />
          ))}
          {myGoals.map((g) => {
            const s = saved.data?.[g.id] ?? 0;
            return (
              <ListRow
                key={g.id}
                label={g.name}
                value={
                  g.target_amount
                    ? copy.previewOf(readWon(s), readWon(g.target_amount))
                    : readWon(s)
                }
                chevron={false}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  // 월급 계획(W-01 파트너 탭): 서버가 자른 줄 그대로
  const lineName = (l: (typeof v.lines)[number]) => l.name ?? copy.lineNames[l.kind] ?? l.kind;
  const planNote =
    joint || v.share === 'all'
      ? null
      : v.share === 'saving_only'
        ? copy.previewSavingOnly(c.myName)
        : copy.previewDoneOnly(c.myName);
  const planSection = (
    <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
      <SectionHeader title={copy.previewPlan} />
      {planNote && (
        <p className="hg-help" style={{ margin: 0 }}>
          {planNote}
        </p>
      )}
      <div className="hg-list">
        {v.income !== null && (
          <ListRow
            label={copy.previewIncome(
              readWon(v.income),
              v.payday === null ? '' : v.payday >= 31 ? copy.lastDay : copy.dayN(v.payday),
            )}
            chevron={false}
          />
        )}
        {v.lines.map((l) => (
          <ListRow
            key={l.id}
            label={lineName(l)}
            value={
              l.amount !== null
                ? amountOf(l.amount)
                : l.state === 'checked'
                  ? copy.previewDone
                  : copy.previewNotYet
            }
            chevron={false}
          />
        ))}
        {v.income === null && v.lines.length === 0 && (
          <ListRow label={copy.previewNothing} chevron={false} />
        )}
      </div>
    </section>
  );

  // 자산: 모두 = 항목, 총액만 = 종류별 합계, 숨기기 = 없음, 공동 명의 = 늘
  const held = assets.data ?? [];
  const items = held.filter(
    (a) => a.owner === 'joint' || (a.owner_user_id === me.id && a.visibility === 'all'),
  );
  const sums = new Map<string, { side: string; n: number; total: number }>();
  for (const a of held)
    if (a.owner === 'person' && a.owner_user_id === me.id && a.visibility === 'sum') {
      const k = `${a.side}:${a.grp}`;
      const cur = sums.get(k) ?? { side: a.side, n: 0, total: 0 };
      sums.set(k, { side: a.side, n: cur.n + 1, total: cur.total + a.amount });
    }
  const assetSection = (
    <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
      <SectionHeader title={copy.previewAssets} />
      {items.length + sums.size === 0 ? (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.previewNothing}
        </p>
      ) : (
        <div className="hg-list">
          {items.map((a) => (
            <ListRow
              key={a.id}
              label={a.owner === 'joint' ? `${a.name} (${copy.previewJoint})` : a.name}
              value={`${a.side === 'debt' ? '−' : ''}${readWon(a.amount)}`}
              chevron={false}
            />
          ))}
          {[...sums.entries()].map(([k, s]) => (
            <ListRow
              key={k}
              label={copy.previewSum(assetGroup(k.split(':')[1] ?? '')?.name ?? '', s.n)}
              value={`${s.side === 'debt' ? '−' : ''}${readWon(s.total)}`}
              chevron={false}
            />
          ))}
        </div>
      )}
    </section>
  );

  return frame(
    <>
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.previewTop(c.partnerName)}
      </p>
      {savingSection}
      {planSection}
      {assetSection}
    </>,
  );
}
