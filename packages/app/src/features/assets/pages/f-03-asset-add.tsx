import { insertAsset, qk, setAssetShareDefault } from '@sweetwo/api';
import {
  assetGroup,
  assetOwnership,
  bands,
  firstAssetChips,
  parsePaidCount,
  parseRate,
  partnerLabel,
  quickChips,
  todayKst,
  type AssetSide,
} from '@sweetwo/core';
import {
  AmountInput,
  BottomSheet,
  Button,
  Chip,
  DateWheel,
  Field,
  FormAmount,
  FormFold,
  FormFolds,
  FormHero,
  FormScreen,
  FormSection,
  LineTabs,
  QuestionSkeleton,
  SegChoice,
  ShortText,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useAssetGroups, useAssetsData, useRefreshAssets } from '../data';
import { assetFolds, assetFormReady, assetHero, type AssetFold } from '../form-logic';
import { shareOptions, type ShareVis } from './f-03e-share';

const pad = (n: number) => String(n).padStart(2, '0');
const ymdText = (v: { y: number; m: number; d: number }) => `${v.y}-${pad(v.m)}-${pad(v.d)}`;
const ymdOf = (s: string) => ({
  y: Number(s.slice(0, 4)),
  m: Number(s.slice(5, 7)),
  d: Number(s.slice(8, 10)),
});

type Owner = 'me' | 'partner' | 'joint';
type Sheet = AssetFold | 'visibility' | 'unsure';

// F-03 자산·부채 추가 한 화면 입력(23, 2026-11-24 FormScreen). 예전 단계형(F-03a 유형 → b 이름 → c 금액 → d 명의 → e 공개 범위 → f~h 유형별)을 한 화면으로:
// 맨 위 요약 문장(“여행 적금 / 1,200만 원 적을까요?”) + 자산·부채 밑줄 탭 + 종류 칩(묶음 → 세부 종류) + 이름 + 지금 금액(‘잘 모르겠어요’) + 명의
// + 접힌 선택 줄(파트너에게 보이기, 만기일, 월 납입액, 납입 회차, 금리) + 아래 “추가하기”.
// 공개 범위는 처음 한 번 직접 고름(asset_share_default 없음, 미리 고른 값 없음): 그때는 필수 섹션으로 펼쳐 보이고, 고른 값이 내 기본값이 되면 이후는 접힌 줄.
// 들어오는 곳이 종류를 미리 고른 채로 엶: F-01 묶음 타일 ?grp=, F-02 빈 상태 종류 칩 ?chip=(분석 entry chip), 탭 쪽 ?side=
export function F03AssetAdd() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const refresh = useRefreshAssets();
  const qc = useQueryClient();
  const { masked } = useMask();
  const chip = firstAssetChips.find((c) => c.key === params.get('chip'));
  const [side, setSide] = useState<AssetSide>(
    chip ? chip.side : params.get('side') === 'debt' ? 'debt' : 'asset',
  );
  const [grp, setGrp] = useState<string | null>(chip?.grp ?? params.get('grp'));
  const [kind, setKind] = useState<string | null>(chip?.kind ?? null);
  const [name, setName] = useState(
    chip ? (copy.firstChips[chip.key as keyof typeof copy.firstChips] ?? '') : '',
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [owner, setOwner] = useState<Owner>('me');
  const [picked, setPicked] = useState<ShareVis | null>(null);
  const [maturity, setMaturity] = useState<string | null>(null);
  const [payment, setPayment] = useState<number | null>(null);
  const [rateText, setRateText] = useState('');
  const [countText, setCountText] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [dupOk, setDupOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const groups = useAssetGroups(side);
  // 분석 asset_added entry(홈 ‘추가’ 메뉴 ?from=home, 검색 ‘바로 하기’ ?from=palette, 종류 칩 ?chip=, 그 밖 자산 관리)
  const [entry] = useState<'home' | 'assets' | 'palette' | 'chip'>(() => {
    if (params.get('chip')) return 'chip';
    const f = params.get('from');
    return f === 'home' || f === 'palette' ? f : 'assets';
  });

  if (d.loading || !d.couple || !d.space) return <QuestionSkeleton />;
  const solo = d.space.couple_state === 'solo';
  const joined = d.couple.joined;
  const defaultVis = d.me?.asset_share_default ?? null;
  const vis: ShareVis | null = picked ?? defaultVis;
  // 공개 범위는 내 명의일 때만(혼자 쓰기는 늘 모두). 처음이면(기본값 없음) 필수 섹션으로 펼침
  const showVis = !solo && owner === 'me';
  const firstVis = showVis && defaultVis === null;
  const g = grp ? groups.find((x) => x.key === grp) : undefined;
  const folds = assetFolds({ side, grp, kind });
  const m = (v: number) => money(v, masked);
  const sameName = d.items.some((a) => a.name === name.trim());
  const ready = assetFormReady({
    grp,
    kind,
    name,
    amount,
    askVisibility: showVis,
    visibility: vis,
    rateText,
    countText,
  });
  const close = () => setSheet(null);

  const pickSide = (s: AssetSide) => {
    if (s === side) return;
    setSide(s);
    setGrp(null);
    setKind(null);
    setName('');
    setMaturity(null);
    setPayment(null);
    setRateText('');
    setCountText('');
  };
  const pickGroup = (key: string) => {
    setGrp(key);
    setKind(null);
    setName('');
    setDupOk(false);
  };
  const pickKind = (k: { key: string; name: string }) => {
    setKind(k.key);
    setName(k.key === 'other' ? '' : k.name);
    setDupOk(false);
  };

  const save = async () => {
    if (saving || !ready || !grp || !kind || amount === null) return;
    if (sameName && !dupOk) return setDupOk(true); // 같은 이름이면 한 번 확인
    setSaving(true);
    try {
      const own: Owner = solo ? 'me' : owner;
      const isFirst = d.items.length === 0 && d.sums.length === 0;
      // 내 첫 자산(파트너만 적은 상태 포함): F-02 맨 위 순자산 + 순위 이동 줄을 한 번
      const ownFirst = assetOwnership(d.items, d.sums, d.me?.id).mine === 0;
      const v = own === 'me' && !solo ? (vis ?? 'sum') : 'all';
      // 처음 고른 공개 범위 = 내 새 항목 기본값(서버도 첫 저장 행으로 정하지만 명시)
      if (own === 'me' && !solo && defaultVis === null && vis) {
        await setAssetShareDefault(vis);
        void qc.invalidateQueries({ queryKey: qk.me });
      }
      const rate = parseRate(rateText);
      const count = parsePaidCount(countText);
      await insertAsset({
        side,
        grp,
        kind,
        name: name.trim(),
        amount,
        estimated,
        owner: own === 'joint' ? 'joint' : 'person',
        owner_user_id: own === 'me' ? (d.me?.id ?? null) : null,
        visibility: v,
        maturity_date: folds.includes('maturity') ? maturity : null,
        monthly_payment: folds.includes('payment') ? payment : null,
        paid_count: folds.includes('count') && typeof count === 'number' ? count : null,
        interest_rate: folds.includes('rate') && typeof rate === 'number' ? rate : null,
      });
      // 32 4-5 asset_added(2026-11-12 S8-07)
      track('asset_added', {
        kind:
          side === 'debt'
            ? 'debt'
            : grp === 'cash' || grp === 'deposit' || grp === 'subscription'
              ? 'account'
              : grp === 'invest' ||
                  grp === 'pension' ||
                  grp === 'insurance' ||
                  grp === 'real_estate'
                ? grp
                : 'other',
        entry,
        is_first: isFirst,
      });
      await refresh();
      // 숨기기도 내 합계에는 더함(2026-11-13 H3)
      carryToast(side === 'asset' ? copy.addedUp(m(amount)) : copy.addedDown(m(amount)));
      // 첫 자산이면 F-02 맨 위에 순자산 + 순위 이동 줄을 한 번(state는 이번 이동에만, 2026-11-18)
      nav(`/assets/items?side=${side}`, {
        replace: true,
        state: ownFirst && side === 'asset' ? { firstAsset: true } : null,
      });
    } catch {
      // 13 공통 상태 10번 저장 실패(2026-11-12 S8-16). 입력값은 그대로라 다시 누르면 됨
      toast(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const foldLabel = (f: AssetFold) =>
    f === 'maturity'
      ? kind === 'deposit_money'
        ? copy.foldContract
        : copy.foldMaturity
      : f === 'count'
        ? copy.foldCount
        : f === 'payment'
          ? side === 'debt'
            ? copy.foldRepay
            : copy.foldPayment
          : copy.foldRate;
  const foldValue = (f: AssetFold): string | undefined =>
    f === 'maturity'
      ? (maturity ?? undefined)
      : f === 'count'
        ? countText.trim()
          ? `${countText}${copy.paidCountUnit}`
          : undefined
        : f === 'payment'
          ? payment !== null
            ? m(payment)
            : undefined
          : rateText.trim()
            ? `${rateText}%`
            : undefined;

  const ownerItems: { value: Owner; label: string }[] = [
    { value: 'me', label: copy.ownerMe },
    // 파트너 명의는 합류 전 대신 입력만(합류 뒤 상대 명의 새로 만들기 불가)
    ...(!joined ? [{ value: 'partner' as const, label: partnerLabel(d.couple.partnerName) }] : []),
    { value: 'joint', label: copy.joint },
  ];

  return (
    <>
      <FormScreen
        title={copy.formTitle[side]}
        onBack={() => nav(-1)}
        hero={
          <FormHero
            lines={assetHero({
              name,
              amount,
              money: m,
              what: copy.formWhat,
              ask: copy.formAsk,
              verb: copy.formVerb,
            })}
          />
        }
        primary={{ label: copy.save, disabled: !ready, loading: saving }}
        onSubmit={() => void save()}
      >
        <LineTabs<AssetSide>
          label={copy.sideLabel}
          value={side}
          onChange={pickSide}
          items={[
            { value: 'asset', label: copy.assetsLabel },
            { value: 'debt', label: copy.debtsLabel },
          ]}
        />
        <FormSection title={copy.formKindQ}>
          <div className="hg-form__chips" role="group" aria-label={copy.groupLabel}>
            {groups.map((x) => (
              <Chip key={x.key} small selected={grp === x.key} onClick={() => pickGroup(x.key)}>
                {x.name}
              </Chip>
            ))}
          </div>
          {g && (
            <div className="hg-form__chips" role="group" aria-label={g.name}>
              {g.kinds.map((k) => (
                <Chip
                  key={k.id ?? k.key}
                  small
                  selected={kind === k.key && (k.key === 'other' || name === k.name)}
                  onClick={() => pickKind(k)}
                >
                  {k.name}
                </Chip>
              ))}
            </div>
          )}
        </FormSection>
        <FormSection title={copy.formNameQ}>
          <ShortText
            label={copy.formNameQ}
            value={name}
            onChange={(v) => {
              setName(v);
              setDupOk(false);
            }}
            max={20}
            autoFocus={false}
          />
          {sameName && dupOk && (
            <p className="hg-banner hg-banner--info" role="alert" style={{ margin: 0 }}>
              <span>{copy.sameName}</span>
            </p>
          )}
        </FormSection>
        <FormSection
          title={copy.formAmountQ[side]}
          aside={
            <button
              type="button"
              className="hg-btn hg-btn--link"
              onClick={() => setSheet('unsure')}
            >
              {copy.unsure}
            </button>
          }
        >
          <FormAmount
            label={copy.formAmountQ[side]}
            sheetTitle={copy.formAmountKeypad[side]}
            closeLabel={copy.close}
            confirmLabel={copy.ok}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setEstimated(false);
            }}
            quick={grp && assetGroup(grp)?.big ? quickChips.big : quickChips.small}
            monthly={false}
          />
        </FormSection>
        {!solo && (
          <FormSection title={copy.formOwnerQ}>
            <SegChoice<Owner>
              label={copy.formOwnerQ}
              items={ownerItems}
              value={owner}
              onChange={setOwner}
            />
          </FormSection>
        )}
        {firstVis && (
          <FormSection title={copy.formVisQ}>
            <SegChoice<ShareVis>
              label={copy.formVisQ}
              items={shareOptions()}
              value={vis}
              onChange={setPicked}
            />
          </FormSection>
        )}
        {((showVis && !firstVis) || folds.length > 0) && (
          <FormFolds>
            {showVis && !firstVis && (
              <FormFold
                label={copy.formVisFold}
                value={vis ? copy.vis[vis] : undefined}
                onClick={() => setSheet('visibility')}
              />
            )}
            {folds.map((f) => (
              <FormFold
                key={f}
                label={foldLabel(f)}
                value={foldValue(f)}
                placeholder={copy.foldPick}
                onClick={() => setSheet(f)}
              />
            ))}
          </FormFolds>
        )}
      </FormScreen>
      {sheet === 'unsure' && (
        <BottomSheet title={copy.unsure} closeLabel={copy.close} onClose={close}>
          <div className="hg-form__chips" role="group" aria-label={copy.unsure}>
            {bands.goalAmount.map((b) => (
              <Chip
                key={b.label}
                small
                onClick={() => {
                  setAmount(b.value);
                  setEstimated(true);
                  close();
                }}
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </BottomSheet>
      )}
      {sheet === 'visibility' && (
        <BottomSheet title={copy.formVisQ} closeLabel={copy.close} onClose={close}>
          <SegChoice<ShareVis>
            label={copy.formVisQ}
            items={shareOptions()}
            value={vis}
            onChange={(v) => {
              setPicked(v);
              close();
            }}
          />
        </BottomSheet>
      )}
      {sheet === 'maturity' && (
        <MaturitySheet
          title={foldLabel('maturity')}
          value={maturity}
          onClose={close}
          onDone={setMaturity}
        />
      )}
      {sheet === 'payment' && (
        <PaymentSheet
          title={foldLabel('payment')}
          value={payment}
          onClose={close}
          onDone={setPayment}
        />
      )}
      {sheet === 'count' && (
        <TextSheet
          title={foldLabel('count')}
          value={countText}
          mode="numeric"
          help={copy.paidCountUnit}
          clean={(t) => t.replace(/\D/g, '').slice(0, 3)}
          error={(t) => (parsePaidCount(t) === 'bad' ? copy.countInvalid : undefined)}
          clearLabel={countText ? copy.foldClear(foldLabel('count')) : undefined}
          onClose={close}
          onDone={setCountText}
        />
      )}
      {sheet === 'rate' && (
        <TextSheet
          title={foldLabel('rate')}
          value={rateText}
          mode="decimal"
          help="%"
          clean={(t) => t.replace(/[^\d.]/g, '').slice(0, 4)}
          error={(t) => (parseRate(t) === 'bad' ? copy.rateInvalid : undefined)}
          clearLabel={rateText ? copy.foldClear(foldLabel('rate')) : undefined}
          onClose={close}
          onDone={setRateText}
        />
      )}
    </>
  );
}

/** 접힌 줄 시트 틀: 제목 + 본문 + ‘확인’ + 값이 있으면 ‘… 지우기’ */
function FoldSheet({
  title,
  onClose,
  clearLabel,
  onClear,
  disabled,
  onConfirm,
  children,
}: {
  title: string;
  onClose: () => void;
  clearLabel?: string;
  onClear?: () => void;
  disabled?: boolean;
  onConfirm?: () => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheet
      title={title}
      closeLabel={copy.close}
      onClose={onClose}
      actions={
        <>
          <Button
            variant="primary"
            block
            disabled={disabled}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {copy.ok}
          </Button>
          {clearLabel && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'center' }}
              onClick={() => {
                onClear?.();
                onClose();
              }}
            >
              {clearLabel}
            </button>
          )}
        </>
      }
    >
      {children}
    </BottomSheet>
  );
}

/** 월 납입·상환액 시트: 기존 키패드 */
function PaymentSheet({
  title,
  value,
  onClose,
  onDone,
}: {
  title: string;
  value: number | null;
  onClose: () => void;
  onDone: (v: number | null) => void;
}) {
  const [v, setV] = useState<number | null>(value);
  return (
    <FoldSheet
      title={title}
      onClose={onClose}
      disabled={v === null}
      onConfirm={() => onDone(v)}
      clearLabel={value !== null ? copy.foldClear(title) : undefined}
      onClear={() => onDone(null)}
    >
      <AmountInput label={title} value={v} onChange={setV} quick={quickChips.small} monthly />
    </FoldSheet>
  );
}

/** 만기일 시트: 날짜 휠(처음 값 1년 뒤 오늘, F-03f와 같음) */
function MaturitySheet({
  title,
  value,
  onClose,
  onDone,
}: {
  title: string;
  value: string | null;
  onClose: () => void;
  onDone: (v: string | null) => void;
}) {
  const t = todayKst();
  const initial = {
    y: Number(t.slice(0, 4)) + 1,
    m: Number(t.slice(5, 7)),
    d: Number(t.slice(8, 10)),
  };
  const [v, setV] = useState<string>(value ?? ymdText(initial));
  return (
    <FoldSheet
      title={title}
      onClose={onClose}
      onConfirm={() => onDone(v)}
      clearLabel={value ? copy.foldClear(title) : undefined}
      onClear={() => onDone(null)}
    >
      <DateWheel
        label={title}
        value={ymdOf(v)}
        initial={initial}
        minYear={initial.y - 11}
        maxYear={initial.y + 39}
        onChange={(x) => setV(ymdText(x))}
      />
    </FoldSheet>
  );
}

/** 글자 칸 시트(납입 회차, 금리): 규칙 밖이면 오류 + 확인 비활성 */
function TextSheet({
  title,
  value,
  mode,
  help,
  clean,
  error,
  clearLabel,
  onClose,
  onDone,
}: {
  title: string;
  value: string;
  mode: 'numeric' | 'decimal';
  help: string;
  clean: (t: string) => string;
  error: (t: string) => string | undefined;
  clearLabel?: string;
  onClose: () => void;
  onDone: (v: string) => void;
}) {
  const [t, setT] = useState(value);
  const err = t.trim() ? error(t) : undefined;
  return (
    <FoldSheet
      title={title}
      onClose={onClose}
      disabled={!t.trim() || !!err}
      onConfirm={() => onDone(t.trim())}
      clearLabel={clearLabel}
      onClear={() => onDone('')}
    >
      <Field
        label={title}
        inputMode={mode}
        value={t}
        onChange={(e) => setT(clean(e.target.value))}
        error={err}
        help={help}
      />
    </FoldSheet>
  );
}
