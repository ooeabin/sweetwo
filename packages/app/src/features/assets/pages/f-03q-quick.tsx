import { insertAsset, qk, setAssetShareDefault } from '@sweetwo/api';
import { amountBand, MAX_WON, readWon, type AssetSide } from '@sweetwo/core';
import { Field, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetsData, useRefreshAssets } from '../data';
import { F03eShare, type ShareVis } from './f-03e-share';

type QuickKey = keyof typeof copy.quickFields;

/** 5칸 = 묶음 + 기본 세부 항목(이름은 칸 이름, F-04에서 고침). 23 v2.2 ‘F-03a, F-03q 빠르게 적기’ */
const QUICK: { key: QuickKey; side: AssetSide; grp: string; kind: string }[] = [
  { key: 'cash', side: 'asset', grp: 'cash', kind: 'bank' },
  { key: 'invest', side: 'asset', grp: 'invest', kind: 'other' },
  { key: 'home', side: 'asset', grp: 'real_estate', kind: 'other' },
  { key: 'pension', side: 'asset', grp: 'pension', kind: 'other' },
  { key: 'loan', side: 'debt', grp: 'other_loan', kind: 'other' },
];

/**
 * F-03q 빠르게 적기(2026-11-13): “큰 묶음만 빠르게 적어 볼까요?” + 5칸 금액. 빈 칸은 저장하지 않음, 명의 ‘나’.
 * 처음 자산을 적는 사람(asset_share_default null, 혼자 쓰기 아님)은 저장 전에 F-03e를 한 번, 아니면 내 기본값.
 * 주 버튼 “저장하기” → F-01. 분석 quick_assets_saved.
 * 빠르게 적기 표시 asset.quick = true(서버 20261208090000)
 */
export function F03qQuick() {
  const nav = useNavigate();
  const d = useAssetsData();
  const qc = useQueryClient();
  const refresh = useRefreshAssets();
  const [vals, setVals] = useState<Partial<Record<QuickKey, number>>>({});
  const [step, setStep] = useState<'fields' | 'share'>('fields');
  const [vis, setVis] = useState<ShareVis | null>(null);
  const [saving, setSaving] = useState(false);

  if (d.loading || !d.space || !d.me) return <QuestionSkeleton />;
  const solo = d.space.couple_state === 'solo';
  const needShare = !solo && !d.me.asset_share_default;
  const filled = QUICK.filter((q) => (vals[q.key] ?? 0) > 0);

  const save = async (chosen: ShareVis | null) => {
    if (saving || !filled.length || !d.me) return;
    setSaving(true);
    try {
      const visibility: ShareVis = solo ? 'all' : (chosen ?? d.me.asset_share_default ?? 'sum');
      if (needShare && chosen) {
        await setAssetShareDefault(chosen);
        void qc.invalidateQueries({ queryKey: qk.me });
      }
      for (const q of filled) {
        await insertAsset({
          side: q.side,
          grp: q.grp,
          kind: q.kind,
          name: copy.quickFields[q.key],
          amount: vals[q.key] ?? 0,
          estimated: false,
          owner: 'person',
          owner_user_id: d.me.id,
          visibility,
          quick: true,
        });
      }
      track('quick_assets_saved', {
        count: filled.length,
        has_debt: filled.some((q) => q.side === 'debt'),
        total_band: amountBand(filled.reduce((t, q) => t + (vals[q.key] ?? 0), 0)),
        share: visibility,
      });
      await refresh();
      carryToast(copy.quickSaved(filled.length));
      nav('/assets', { replace: true });
    } catch {
      toast(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'share')
    return (
      <F03eShare
        value={vis}
        onChange={setVis}
        onBack={() => setStep('fields')}
        primaryLabel={copy.quickSave}
        loading={saving}
        onSubmit={() => void save(vis)}
      />
    );

  return (
    <QuestionLayout
      title={copy.quickTitle}
      help={copy.quickHelp}
      onBack={() => nav(-1)}
      primary={{
        label: needShare ? copy.next : copy.quickSave,
        disabled: !filled.length,
        loading: saving,
      }}
      onSubmit={() => {
        if (!filled.length) return;
        if (needShare) setStep('share');
        else void save(null);
      }}
    >
      <div className="hg-stack" role="group" aria-label={copy.quickTitle}>
        {QUICK.map((q) => {
          const v = vals[q.key];
          return (
            <Field
              key={q.key}
              label={copy.quickFields[q.key]}
              inputMode="numeric"
              placeholder={copy.quickPlaceholder}
              value={v === undefined ? '' : v.toLocaleString('ko-KR')}
              help={v ? readWon(v) : undefined}
              onChange={(e) => {
                const t = e.target.value.replace(/\D/g, '');
                setVals((o) => ({
                  ...o,
                  [q.key]: t === '' ? undefined : Math.min(Number(t), MAX_WON),
                }));
              }}
            />
          );
        })}
      </div>
    </QuestionLayout>
  );
}
