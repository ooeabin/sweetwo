import { insertAsset, qk, setAssetShareDefault } from '@sweetwo/api';
import {
  assetGroup,
  bands,
  parsePaidCount,
  parseRate,
  quickChips,
  todayKst,
  type AssetSide,
} from '@sweetwo/core';
import {
  AmountInput,
  ChoiceCards,
  Chip,
  DateWheel,
  Field,
  List,
  ListRow,
  QuestionLayout,
  ShortText,
  Tabs,
  QuestionSkeleton,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetGroups, useAssetsData, useRefreshAssets } from '../data';
import { assetSteps, useAssetDraft } from './draft';
import { AssetArt } from '../asset-art';
import { F03eShare } from '../pages/f-03e-share';

const pad = (n: number) => String(n).padStart(2, '0');
const ymdText = (v: { y: number; m: number; d: number }) => `${v.y}-${pad(v.m)}-${pad(v.d)}`;
const ymdOf = (s: string) => ({
  y: Number(s.slice(0, 4)),
  m: Number(s.slice(5, 7)),
  d: Number(s.slice(8, 10)),
});

const path = (step: string) => `/assets/new/${step}`;

// F-03 항목 추가: a 유형(자산·부채 + 그룹 칩 + 세부 항목) → b 이름 → c 금액 → d 명의 → e 공개 범위(내 명의만)
// → 유형별 추가 질문(F-03f~h: 만기일, 납입 회차, 금리, 월 납입·상환액, 모두 ‘나중에 할게요’ 가능).
export function AssetAddRoute() {
  const { step = 'kind' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const qc = useQueryClient();
  const { draft, set, reset } = useAssetDraft();
  const { masked } = useMask();
  const [name, setName] = useState<string | null>(null);
  const groups = useAssetGroups(draft.side);
  const [dupOk, setDupOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateText, setRateText] = useState<string | null>(null);
  const [countText, setCountText] = useState<string | null>(null);
  // 분석 asset_added entry(홈 ‘추가’ 메뉴 ?from=home, 검색 ‘바로 하기’ ?from=palette, 그 밖 자산 관리). 단계가 바뀌어도 그대로
  const [entry] = useState<'home' | 'assets' | 'palette'>(() => {
    const f = params.get('from');
    return f === 'home' || f === 'palette' ? f : 'assets';
  });

  // 처음 열면 진입한 탭(자산/부채)으로 새로 시작
  const startSide = params.get('side') === 'debt' ? 'debt' : 'asset';
  useEffect(() => {
    if (step === 'kind' && !params.get('keep')) {
      // 2026-11-13 F-03e: 처음 적는 사람(asset_share_default null)은 미리 고른 값 없음
      reset(startSide, d.me?.asset_share_default ?? null);
      // F-01 빈 상태 묶음 타일에서 오면 그 묶음을 고른 채로(2026-11-04)
      const grp = params.get('grp');
      if (grp) set({ grp, kind: null });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || !d.couple || !d.space) return <QuestionSkeleton />;
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
      const isFirst = d.items.length === 0 && d.sums.length === 0;
      const vis = owner === 'me' && !solo ? (x.visibility ?? 'sum') : 'all';
      // F-03e 처음 고른 값 = 내 새 항목 기본값(서버도 첫 저장 행으로 정하지만 명시)
      if (owner === 'me' && !solo && !d.me?.asset_share_default && x.visibility) {
        await setAssetShareDefault(x.visibility);
        void qc.invalidateQueries({ queryKey: qk.me });
      }
      await insertAsset({
        side: x.side,
        grp: x.grp,
        kind: x.kind,
        name: x.name.trim(),
        amount: x.amount,
        estimated: x.estimated,
        owner: owner === 'joint' ? 'joint' : 'person',
        owner_user_id: owner === 'me' ? (d.me?.id ?? null) : null,
        visibility: vis,
        maturity_date: x.maturity,
        monthly_payment: x.payment,
        paid_count: x.paidCount,
        interest_rate: x.rate,
      });
      // 32 4-5 asset_added(2026-11-12 S8-07)
      track('asset_added', {
        kind:
          x.side === 'debt'
            ? 'debt'
            : x.grp === 'cash' || x.grp === 'deposit' || x.grp === 'subscription'
              ? 'account'
              : x.grp === 'invest' ||
                  x.grp === 'pension' ||
                  x.grp === 'insurance' ||
                  x.grp === 'real_estate'
                ? x.grp
                : 'other',
        entry,
        is_first: isFirst,
      });
      await refresh();
      const counted = vis !== 'private';
      carryToast(
        !counted
          ? copy.added
          : x.side === 'asset'
            ? copy.addedUp(money(x.amount, masked))
            : copy.addedDown(money(x.amount, masked)),
      );
      nav(`/assets/items?side=${x.side}`, { replace: true });
    } catch {
      // 13 공통 상태 10번 저장 실패(2026-11-12 S8-16). 입력값은 그대로라 다시 누르면 됨
      toast(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'kind') {
    const g = draft.grp ? groups.find((x) => x.key === draft.grp) : undefined;
    return (
      <QuestionLayout steps={progress} title={copy.addTitle} onBack={back}>
        {/* 2026-11-13 F-03q 입구: 맨 위 “큰 묶음만 빠르게 적기 ›” */}
        <List>
          <ListRow label={copy.quickEntry} onClick={() => nav('/assets/quick')} />
        </List>
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
        {/* 2026-11-04 묶음은 아이콘 타일 3열(시안 A, Rocket Money처럼). 고르면 아래 세부 항목 */}
        <div className="hg-pick hg-pick--tiles" role="group" aria-label={copy.groupLabel}>
          {groups.map((x) => (
            <button
              key={x.key}
              type="button"
              className={'hg-pick__item' + (draft.grp === x.key ? ' is-on' : '')}
              aria-pressed={draft.grp === x.key}
              onClick={() => set({ grp: x.key, kind: null })}
            >
              <AssetArt group={x.key} />
              {x.name}
            </button>
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
                key={k.id ?? k.key}
                selected={draft.kind === k.key && (k.key === 'other' || draft.name === k.name)}
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
          onChange={(amount) => set({ amount, estimated: false })}
          quick={big ? quickChips.big : quickChips.small}
          allowZero
          // 잘 모르겠어요 → 구간 칩, 중간값을 ‘추정’으로 저장(F-03 6번)
          bands={bands.goalAmount}
          unsureLabel={copy.unsure}
          onBand={(b) => go({ amount: b.value, estimated: true })}
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
            // 파트너 명의는 합류 전 대신 입력만(합류 뒤 상대 명의 새로 만들기 불가)
            ...(!joined ? [{ value: 'partner' as const, label: d.couple.partnerName }] : []),
            { value: 'joint', label: copy.joint },
          ]}
        />
      </QuestionLayout>
    );
  }

  if (step === 'visibility') {
    return (
      <F03eShare
        steps={progress}
        value={draft.visibility}
        onChange={(visibility) => set({ visibility })}
        onBack={back}
        primaryLabel={steps[i + 1] ? copy.next : copy.save}
        loading={saving}
        onSubmit={() => go({})}
      />
    );
  }

  // F-03f~i 유형별 질문: 모두 ‘나중에 할게요’로 건너뛸 수 있음
  const skip = { label: copy.later, onClick: () => go({}) };
  const lastLabel = steps[i + 1] ? copy.next : copy.save;

  if (step === 'maturity') {
    const t = todayKst();
    const initial = {
      y: Number(t.slice(0, 4)) + 1,
      m: Number(t.slice(5, 7)),
      d: Number(t.slice(8, 10)),
    };
    const title = draft.kind === 'deposit_money' ? copy.contractEnd : copy.maturity;
    return (
      <QuestionLayout
        steps={progress}
        title={title}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, loading: saving }}
        onSubmit={() => go({ maturity: draft.maturity ?? ymdText(initial) })}
      >
        {/* 2026-11-04 다른 날짜 질문(목표 기한)과 같은 휠. 처음 값은 1년 뒤 오늘 */}
        <DateWheel
          label={title}
          value={draft.maturity ? ymdOf(draft.maturity) : null}
          initial={initial}
          minYear={initial.y - 11}
          maxYear={initial.y + 39}
          onChange={(v) => set({ maturity: ymdText(v) })}
        />
      </QuestionLayout>
    );
  }

  if (step === 'count') {
    // 회차 0~999: F-04와 같은 core 규칙(2026-11-12 S8-12)
    const text = countText ?? (draft.paidCount === null ? '' : String(draft.paidCount));
    const v = parsePaidCount(text);
    return (
      <QuestionLayout
        steps={progress}
        title={copy.paidCount}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: v === null || v === 'bad', loading: saving }}
        onSubmit={() => typeof v === 'number' && go({ paidCount: v })}
      >
        <Field
          label={copy.paidCount}
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, '').slice(0, 3);
            setCountText(t);
            const n = parsePaidCount(t);
            set({ paidCount: typeof n === 'number' ? n : null });
          }}
          error={v === 'bad' ? copy.countInvalid : undefined}
          help={copy.paidCountUnit}
        />
      </QuestionLayout>
    );
  }

  if (step === 'rate') {
    // 금리 0~30%, 소수 1자리: F-04와 같은 core 규칙(2026-11-12 D5 = A, S8-12)
    const text = rateText ?? (draft.rate === null ? '' : String(draft.rate));
    const v = parseRate(text);
    const bad = v === 'bad';
    return (
      <QuestionLayout
        steps={progress}
        title={copy.rate}
        onBack={back}
        later={skip}
        primary={{ label: lastLabel, disabled: v === null || bad, loading: saving }}
        onSubmit={() => typeof v === 'number' && go({ rate: v })}
      >
        <Field
          label={copy.rate}
          inputMode="decimal"
          value={text}
          onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))}
          error={bad ? copy.rateInvalid : undefined}
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

  return <Navigate to={path('kind')} replace />;
}
