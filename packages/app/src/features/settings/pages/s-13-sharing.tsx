import {
  AssetForbiddenError,
  bundleKeys,
  fetchAssets,
  fetchBundles,
  fetchOpenRankRequest,
  qk,
  rankKeys,
  setAssetShareDefault,
  setBundleVisibility,
  turnOffRankConsent,
  updateAsset,
  type Asset,
} from '@sweetwo/api';
import { PLAN_SHARES, type PlanShare } from '@sweetwo/core';
import { Button, ListRow, PageHeader, SectionHeader, Toggle } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { SheetSelect } from '../../../shared/sheet-select';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { savePlanShare } from '../share-sheet';

type Vis = 'all' | 'sum' | 'private';
const VIS: Vis[] = ['all', 'sum', 'private'];

// S-13 공개 범위(25 ‘S-13 공개 범위 (한 목록)’, 08 6장, 2026-11-13 한 곳 한 목록):
// 0 맨 위 “{이름}님에게 보이는 모습 보기 ›”(→ S-13p, 합류했을 때만)
// ① 내 월급 계획: 모두 / 저금만(기본) / 했어요만(각자 계열만, 같이 계열은 “같이 관리해서 모두 보여요” 한 줄)
// ② 같이 모으기: 묶음마다 “각자 모은 금액 보여 주기”(W-15a와 같은 값, 내 쪽만). 묶음 없으면 숨김
// ③ 자산·부채: 새 항목 기본값(처음 자산을 적을 때 고른 값, 그 전엔 비어 있음) + 내 명의 항목마다(모두 / 총액만 / 숨기기)
// ④ 자산 순위 같이 보기: 켜면 F-08c(/assets/rank/consent, 동의 보내기), 끄면 set_rank_consent(false)
// 저금마다 공개(옛 ‘금액만 보여 주기’ 저금)는 없앰. ?next=로 열면 맨 아래 ‘확인’(합류 뒤 한 번 확인).
export function S13Sharing() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next');
  const d = useSettingsData();
  const joined = !!d.c?.joined;
  const separate = d.space?.salary_mode === 'separate';
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const bundles = useQuery({
    queryKey: qk.bundles,
    queryFn: () => fetchBundles(),
    enabled: joined && separate,
  });
  const rankReq = useQuery({
    queryKey: qk.rankRequest,
    queryFn: fetchOpenRankRequest,
    enabled: joined,
  });
  const [ask, setAsk] = useState<Vis | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.me || !d.c || !d.space || assets.isLoading)
    return <LoadingFrame sub="settings" current={null} />;
  const me = d.me;
  const c = d.c;
  const mine = (assets.data ?? []).filter((a) => a.owner === 'person' && a.owner_user_id === me.id);
  const run = async (
    f: () => Promise<unknown>,
    keys: readonly (readonly unknown[])[],
    ok = copy.saved,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(ok);
    } catch (e) {
      toast(e instanceof AssetForbiddenError ? copy.previewNoPartner : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const setDefault = (v: Vis, all: boolean) =>
    run(async () => {
      await setAssetShareDefault(v);
      if (all)
        await Promise.all(
          mine.filter((a) => a.visibility !== v).map((a) => updateAsset(a.id, { visibility: v })),
        );
    }, [qk.me, qk.assets]);
  const differ = (v: Vis) => mine.filter((a) => a.visibility !== v).length;
  const label = (a: Asset) => (a.side === 'debt' ? `${a.name} ${copy.visDebt}` : a.name);
  const visName = (v: Vis) => copy.assetVis[v] ?? v;
  const myBundles = (bundles.data ?? []).filter((b) => b.status !== 'closed');
  const myRankOpen = rankReq.data && rankReq.data.from_user === me.id ? rankReq.data : null;
  const share = me.plan_share as PlanShare;

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.visTitle}
        backLabel={copy.back}
        backTo={next ? undefined : copy.title}
        onBack={() => nav(next ?? '/settings')}
      />
      {joined && (
        <div className="hg-row">
          <Button
            variant="ghost"
            size="sm"
            className="hg-btn--link"
            onClick={() => nav('/settings/visibility/preview')}
          >
            {copy.previewLink(c.partnerName)}
          </Button>
        </div>
      )}
      {/* ① 내 월급 계획 */}
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.planShareTitle} />
        {separate ? (
          <div className="hg-list">
            <SheetSelect<PlanShare>
              label={copy.planShareTitle}
              rowLabel={copy.planShareTitle}
              value={share}
              options={PLAN_SHARES}
              nameOf={(v) => copy.planShares[v] ?? v}
              subOf={(v) => sharedCopy.shareNote.subs[v]}
              onChange={(v) =>
                v !== share &&
                void run(
                  () => savePlanShare(me.id, share, v, 'S-13'),
                  [qk.me, ['partner_plan_view']],
                )
              }
            />
          </div>
        ) : (
          <p className="hg-help" style={{ margin: 0 }}>
            {copy.planShareJoint}
          </p>
        )}
      </section>
      {/* ② 같이 모으기(묶음마다, 내 쪽만) */}
      {myBundles.length > 0 && (
        <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <SectionHeader title={copy.bundlesTitle} />
          <div className="hg-card hg-stack" style={{ gap: 0 }}>
            {myBundles.map((b) => (
              <Toggle
                key={b.id}
                label={b.name}
                help={copy.bundleShowEach}
                checked={b.my_show_each}
                onChange={(on) =>
                  run(() => setBundleVisibility(b.id, { showEach: on }), bundleKeys).then(() =>
                    track('bundle_show_each_toggled', {
                      entry: 's13',
                      has_target: b.target !== null,
                      on,
                    }),
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
      {/* ③ 자산·부채 */}
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.assetsTitle} />
        <div className="hg-list">
          {me.asset_share_default ? (
            <SheetSelect<Vis>
              label={copy.visDefault}
              rowLabel={copy.visDefault}
              value={me.asset_share_default}
              options={VIS}
              nameOf={visName}
              subOf={(v) => copy.assetVisHelp[v]}
              onChange={(v) => {
                if (differ(v) > 0) setAsk(v);
                else void setDefault(v, false);
              }}
            />
          ) : (
            <ListRow label={copy.visDefault} value={copy.assetDefaultNone} chevron={false} />
          )}
        </div>
        {me.asset_share_default && copy.assetVisHelp[me.asset_share_default] && (
          <p className="hg-help" style={{ margin: 0 }}>
            {copy.assetVisHelp[me.asset_share_default]}
          </p>
        )}
        {ask && (
          <div className="hg-stack" role="alertdialog" aria-label={copy.visApplyAll(differ(ask))}>
            <b>{copy.visApplyAll(differ(ask))}</b>
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, true);
                }}
              >
                {copy.visAll}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, false);
                }}
              >
                {copy.visNewOnly}
              </Button>
            </div>
          </div>
        )}
        {mine.length === 0 ? (
          <p className="hg-q__help">{copy.visNone}</p>
        ) : (
          <div className="hg-list">
            {mine.map((a) => (
              <SheetSelect<Vis>
                key={a.id}
                label={copy.visLabel(a.name)}
                rowLabel={label(a)}
                value={a.visibility}
                options={VIS}
                nameOf={visName}
                subOf={(v) => copy.assetVisHelp[v]}
                onChange={(v) => void run(() => updateAsset(a.id, { visibility: v }), [qk.assets])}
              />
            ))}
          </div>
        )}
      </section>
      {/* ④ 자산 순위 같이 보기 */}
      {joined && (
        <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <SectionHeader title={copy.rankTitle} />
          <div className="hg-card">
            <Toggle
              label={copy.rankTitle}
              help={myRankOpen ? copy.rankWaiting(c.partnerName) : copy.rankHelp}
              checked={me.rank_consent}
              onChange={(on) =>
                // 켜기는 F-08c(순위 같이 보기 동의 보내기, PR 12)에서, 끄기는 바로
                on
                  ? nav('/assets/rank/consent')
                  : run(turnOffRankConsent, rankKeys).then(() =>
                      track('rank_consent_turned_off', {}),
                    )
              }
            />
          </div>
        </section>
      )}
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.alwaysShared}
      </p>
      {next && (
        <div className="hg-row">
          <Button variant="primary" onClick={() => nav(next, { replace: true })}>
            {copy.ok}
          </Button>
        </div>
      )}
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
