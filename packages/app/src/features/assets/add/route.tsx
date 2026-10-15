import { insertAsset } from '@sweetwo/api';
import {
  assetGroup,
  assetGroupsOf,
  isHighInterestKind,
  quickChips,
  type AssetSide,
} from '@sweetwo/core';
import { AmountInput, ChoiceCards, Chip, QuestionLayout, ShortText, Tabs } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetsData, useRefreshAssets } from '../data';
import { assetSteps, useAssetDraft } from './draft';

const path = (step: string) => `/assets/new/${step}`;

// F-03 항목 추가: a 유형(자산·부채 + 그룹 칩 + 세부 항목) → b 이름 → c 금액 → d 명의 → e 공개 범위(내 명의만).
// 유형별 추가 질문(F-03f~i: 만기일, 월 납입액, 금리, 목표 연결)은 다음 단계.
export function AssetAddRoute() {
  const { step = 'kind' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const { draft, set, reset } = useAssetDraft();
  const { masked } = useMask();
  const [name, setName] = useState<string | null>(null);
  const [dupOk, setDupOk] = useState(false);
  const [saving, setSaving] = useState(false);

  // 처음 열면 진입한 탭(자산/부채)으로 새로 시작
  const startSide = params.get('side') === 'debt' ? 'debt' : 'asset';
  useEffect(() => {
    if (step === 'kind' && !params.get('keep')) reset(startSide);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || !d.couple || !d.space) return null;
  const solo = d.space.couple_state === 'solo';
  const joined = d.couple.joined;
  const steps = assetSteps(draft, solo);
  const i = Math.max(steps.indexOf(step), 0);
  if (step !== 'kind' && !draft.kind) return <Navigate to={path('kind')} replace />;
  const progress = { total: steps.length, now: i, fill: 50 };
  const back = () => (i > 0 ? nav(`${path(steps[i - 1] ?? 'kind')}?keep=1`) : nav(-1));
  const go = (next: Partial<typeof draft>) => {
    const nd = { ...draft, ...next };
    set(next);
    const l = assetSteps(nd, solo);
    const to = l[l.indexOf(step) + 1];
    if (to) nav(path(to));
    else void save(nd);
  };

  const save = async (x: typeof draft) => {
    if (saving || !x.grp || !x.kind || !x.name || x.amount === null) return;
    setSaving(true);
    try {
      const owner = solo ? 'me' : (x.owner ?? 'me');
      await insertAsset({
        side: x.side,
        grp: x.grp,
        kind: x.kind,
        name: x.name.trim(),
        amount: x.amount,
        owner: owner === 'joint' ? 'joint' : 'person',
        owner_user_id: owner === 'me' ? (d.me?.id ?? null) : null,
        visibility: owner === 'me' && !solo ? x.visibility : 'all',
      });
      await refresh();
      const counted = !(owner === 'me' && !solo && x.visibility === 'private');
      toast(
        !counted
          ? copy.added
          : x.side === 'asset'
            ? copy.addedUp(money(x.amount, masked))
            : copy.addedDown(money(x.amount, masked)),
      );
      nav(`/assets/items?side=${x.side}`, { replace: true });
      if (x.side === 'debt' && isHighInterestKind(x.kind))
        toast(copy.highInterest, { label: copy.makeGoal, onClick: () => nav('/goals/new') });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'kind') {
    const groups = assetGroupsOf(draft.side);
    const g = draft.grp ? assetGroup(draft.grp) : undefined;
    return (
      <QuestionLayout steps={progress} title={copy.addTitle} onBack={back}>
        <Tabs<AssetSide>
          variant="seg"
          label={copy.sideLabel}
          value={draft.side}
          onChange={(side) => set({ side, grp: null, kind: null })}
          items={[
            { value: 'asset', label: copy.assetsLabel },
            { value: 'debt', label: copy.debtsLabel },
          ]}
        />
        <div
          className="hg-row"
          role="group"
          aria-label={copy.groupLabel}
          style={{ gap: 'var(--space-2)' }}
        >
          {groups.map((x) => (
            <Chip
              key={x.key}
              selected={draft.grp === x.key}
              onClick={() => set({ grp: x.key, kind: null })}
            >
              {x.name}
            </Chip>
          ))}
        </div>
        {g && (
          <div
            className="hg-row"
            role="group"
            aria-label={g.name}
            style={{ gap: 'var(--space-2)' }}
          >
            {g.kinds.map((k) => (
              <Chip
                key={k.key}
                selected={draft.kind === k.key}
                onClick={() => {
                  setName(null);
                  go({ kind: k.key, name: k.key === 'other' ? '' : k.name });
                }}
              >
                {k.name}
              </Chip>
            ))}
          </div>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'name') {
    const v = name ?? draft.name ?? '';
    const dup = d.items.some((a) => a.name === v.trim());
    return (
      <QuestionLayout
        steps={progress}
        title={copy.nameTitle}
        onBack={back}
        primary={{ label: copy.next, disabled: !v.trim() }}
        onSubmit={() => {
          if (!v.trim()) return;
          if (dup && !dupOk) return setDupOk(true); // 같은 이름이면 한 번 확인
          go({ name: v.trim() });
        }}
      >
        <ShortText
          label={copy.nameTitle}
          value={v}
          onChange={(x) => {
            setName(x);
            setDupOk(false);
          }}
          max={20}
        />
        {dup && dupOk && (
          <p className="hg-banner hg-banner--info" role="alert" style={{ margin: 0 }}>
            <span>{copy.sameName}</span>
          </p>
        )}
      </QuestionLayout>
    );
  }

  if (step === 'amount') {
    const title = draft.side === 'debt' ? copy.amountDebt : copy.amountAsset;
    const big = draft.grp ? assetGroup(draft.grp)?.big : false;
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        onBack={back}
        primary={{ label: copy.next, disabled: draft.amount === null, loading: saving }}
        onSubmit={() => draft.amount !== null && go({})}
      >
        <AmountInput
          label={title}
          value={draft.amount}
          onChange={(amount) => set({ amount })}
          quick={big ? quickChips.big : quickChips.small}
          allowZero
        />
      </QuestionLayout>
    );
  }

  if (step === 'owner') {
    type O = 'me' | 'partner' | 'joint';
    return (
      <QuestionLayout steps={progress} title={copy.ownerTitle} onBack={back}>
        <ChoiceCards<O>
          label={copy.ownerTitle}
          value={draft.owner}
          onChange={(owner) => set({ owner })}
          onPick={(owner) => go({ owner })}
          options={[
            { value: 'me', label: copy.ownerMe },
            // 배우자 명의는 합류 전 대신 입력만(합류 뒤 상대 명의 새로 만들기 불가)
            ...(!joined ? [{ value: 'partner' as const, label: d.couple.partnerName }] : []),
            { value: 'joint', label: copy.joint },
          ]}
        />
      </QuestionLayout>
    );
  }

  if (step === 'visibility') {
    type V = 'all' | 'sum' | 'private';
    return (
      <QuestionLayout
        steps={progress}
        title={copy.visTitle}
        onBack={back}
        primary={{ label: copy.save, loading: saving }}
        onSubmit={() => go({})}
      >
        <ChoiceCards<V>
          label={copy.visTitle}
          value={draft.visibility}
          onChange={(visibility) => set({ visibility })}
          autoAdvance={false}
          options={[
            { value: 'all', label: copy.visOptions.all },
            { value: 'sum', label: copy.visOptions.sum },
            { value: 'private', label: copy.visOptions.private },
          ]}
        />
      </QuestionLayout>
    );
  }
  return <Navigate to={path('kind')} replace />;
}
