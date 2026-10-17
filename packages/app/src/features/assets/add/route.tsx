import { fetchGoals, insertAsset, qk } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';
import {
  assetGroup,
  assetGroupsOf,
  isHighInterestKind,
  quickChips,
  type AssetSide,
} from '@sweetwo/core';
import {
  AmountInput,
  ChoiceCards,
  Chip,
  DateInput,
  Field,
  QuestionLayout,
  ShortText,
  Tabs,
} from '@sweetwo/ui';
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
  const [rateText, setRateText] = useState<string | null>(null);
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  // 연결할 수 있는 목표: 진행 중(보류·달성·사용 완료 빼고)
  const openGoals = (goals.data ?? []).filter(
    (g) => !['paused', 'achieved', 'used'].includes(g.status),
  );

  // 처음 열면 진입한 탭(자산/부채)으로 새로 시작
  const startSide = params.get('side') === 'debt' ? 'debt' : 'asset';
  useEffect(() => {
    if (step === 'kind' && !params.get('keep')) reset(startSide, d.me?.default_visibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || goals.isLoading || !d.couple || !d.space) return null;
  const solo = d.space.couple_state === 'solo';
  const joined = d.couple.joined;
  const steps = assetSteps(draft, solo, openGoals.length > 0);
  const i = Math.max(steps.indexOf(step), 0);
  if (step !== 'kind' && !draft.kind) return <Navigate to={path('kind')} replace />;
  const progress = { total: steps.length, now: i, fill: 50 };
  const back = () => (i > 0 ? nav(`${path(steps[i - 1] ?? 'kind')}?keep=1`) : nav(-1));
  const go = (next: Partial<typeof draft>) => {
    const nd = { ...draft, ...next };
    set(next);
    const l = assetSteps(nd, solo, openGoals.length > 0);
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
        maturity_date: x.maturity,
        monthly_payment: x.payment,
        pay_from: x.payFrom,
        paid_count: x.paidCount,
        interest_rate: x.rate,
        goal_id: x.side === 'asset' ? x.goalId : null,
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
        primary={{ label: steps[i + 1] ? copy.next : copy.save, loading: saving }}
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

  // F-03f~i 유형별 질문: 모두 ‘나중에 할게요’로 건너뛸 수 있음
  const skip = { label: copy.later, onClick: () => go({}) };
  const lastLabel = steps[i + 1] ? copy.next : copy.save;

  if (step === 'maturity') {
    const title = draft.kind === 'deposit_money' ? copy.contractEnd : copy.maturity;
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: !draft.maturity, loading: saving }}
        onSubmit={() => draft.maturity && go({})}
      >
        <DateInput
          label={title}
          value={draft.maturity}
          onChange={(maturity) => set({ maturity })}
        />
      </QuestionLayout>
    );
  }

  if (step === 'count') {
    return (
      <QuestionLayout
        steps={progress}
        title={copy.paidCount}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: draft.paidCount === null, loading: saving }}
        onSubmit={() => draft.paidCount !== null && go({})}
      >
        <Field
          label={copy.paidCount}
          inputMode="numeric"
          value={draft.paidCount ?? ''}
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, '').slice(0, 4);
            set({ paidCount: n ? Number(n) : null });
          }}
          help={copy.paidCountUnit}
        />
      </QuestionLayout>
    );
  }

  if (step === 'rate') {
    const text = rateText ?? (draft.rate === null ? '' : String(draft.rate));
    const v = text.trim() === '' ? null : Number(text);
    const bad = v !== null && (!Number.isFinite(v) || v < 0 || v > 100);
    return (
      <QuestionLayout
        steps={progress}
        title={copy.rate}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: v === null || bad, loading: saving }}
        onSubmit={() => v !== null && !bad && go({ rate: Math.round(v * 100) / 100 })}
      >
        <Field
          label={copy.rate}
          inputMode="decimal"
          value={text}
          onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))}
          error={bad ? copy.rateError : undefined}
          help="%"
        />
      </QuestionLayout>
    );
  }

  if (step === 'payment') {
    const title = draft.side === 'debt' ? copy.repayment : copy.payment;
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: draft.payment === null, loading: saving }}
        onSubmit={() => draft.payment !== null && go({})}
      >
        <AmountInput
          label={title}
          value={draft.payment}
          onChange={(payment) => set({ payment })}
          quick={quickChips.small}
          monthly
        />
      </QuestionLayout>
    );
  }

  if (step === 'payfrom') {
    type P = 'goal_fund' | 'personal';
    return (
      <QuestionLayout steps={progress} title={copy.payFrom} onBack={back} later={skip}>
        <ChoiceCards<P>
          label={copy.payFrom}
          value={draft.payFrom}
          onChange={(payFrom) => set({ payFrom })}
          onPick={(payFrom) => go({ payFrom })}
          options={[
            { value: 'goal_fund', label: copy.payFromOptions.goal_fund },
            { value: 'personal', label: copy.payFromOptions.personal },
          ]}
        />
      </QuestionLayout>
    );
  }

  if (step === 'goal') {
    return (
      <QuestionLayout steps={progress} title={copy.goal} onBack={back} later={skip}>
        <ChoiceCards<string>
          label={copy.goal}
          value={draft.goalId ?? (draft.goalId === null ? null : 'none')}
          onChange={(g) => set({ goalId: g === 'none' ? null : g })}
          onPick={(g) => go({ goalId: g === 'none' ? null : g })}
          options={[
            ...openGoals.map((g) => ({ value: g.id, label: g.name })),
            { value: 'none', label: copy.noGoal },
          ]}
        />
      </QuestionLayout>
    );
  }
  return <Navigate to={path('kind')} replace />;
}
