import {
  achieveBundle,
  addSavingItem,
  BundleBlocked,
  createBundle,
  joinBundle,
  setBundleVisibility,
} from '@sweetwo/api';
import {
  bundleShownName,
  bundleTargetDefault,
  canPercentOnly,
  defaultDeadline,
  joinableBundle,
  quickChips,
  thisMonth,
  waitingBundle,
  type YearMonth,
} from '@sweetwo/core';
import {
  Checkbox,
  FormAmount,
  FormScreen,
  FormSection,
  QuestionSkeleton,
  SegChoice,
  ShortText,
  YearMonthField,
  type StepDone,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { salaryPaths, savingPaths, togetherPaths } from '../paths';
import { useSavingItems, type SavingItem } from '../saving';
import { SavingQuestionError } from '../saving-parts';
import { refreshBundles, refreshSaving, useBundles } from '../together';

type Step = 'exist' | 'partner' | 'mine' | 'newName' | 'target' | 'notice';
const NEW = '__new';
const MINE_ONLY = '__mine';
const JOIN = '__join';
const SEPARATE = '__separate';

/** 끝나고 갈 곳(`?then=`, 앱 안 주소만, W-20a에서 들어가기) */
const thenOf = (p: URLSearchParams) => {
  const t = p.get('then');
  return t && t.startsWith('/') && !t.startsWith('//') ? t : null;
};

/**
 * W-15 같이 모으기로 묶기(20 v2.2, 각자 계열 + 연결만, ADR 0009 결정 5, G1).
 * 만들기(`/salary/bundles/new?goal=`): 상대 저금 고르기(또는 내 저금에서 시작) → 내 저금 고르기·새로 만들기(이름, 매달 금액)
 * → 묶음 목표 금액(처음 값 = 두 목표 금액 합, Q11) → 기한 → 고지 + ‘퍼센트만 보여 주기’ → bundle_create.
 * `goal`이 상대 저금이면(홈 띠 13번) 1단계를 고른 채로, 내 저금이면(W-10 ⋯, W-11 끝) 1·2단계를 건너뜀.
 * 들어가기(`/salary/bundles/:id/join`, 상대가 만든 묶음, 알림): 내 저금 → 고지 → bundle_join(2~4단계, 목표 금액은 서버가 합으로 맞춤)
 */
export function W15Bundle({ join = false }: { join?: boolean }) {
  const { id: bundleId = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const bundles = useBundles();
  const [step, setStep] = useState<Step | null>(null);
  const [trail, setTrail] = useState<Step[]>([]);
  const [partnerGoal, setPartnerGoal] = useState<string | null>(null);
  const [mineGoal, setMineGoal] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newMonthly, setNewMonthly] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null | undefined>(undefined);
  const [deadline, setDeadline] = useState<YearMonth | null | undefined>(undefined);
  const [pctOnly, setPctOnly] = useState(false);
  const [separate, setSeparate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existPick, setExistPick] = useState<string | null>(null);

  const ready = d.ready && !bundles.isLoading;
  const given = d.ready ? d.byId(params.get('goal') ?? '') : undefined;
  // 묶음은 한 쌍에 하나씩(2026-11-14 H1): 상대가 만든 들어갈 묶음이나 내가 만든 기다리는 묶음이 있으면 먼저 물음
  const open = join
    ? undefined
    : (joinableBundle(bundles.data ?? []) ?? waitingBundle(bundles.data ?? []));
  const openJoin = !!open && !open.goals.some((g) => g.mine);
  /**
   * 새 저금 매달 금액 처음 값(2026-11-14 R4): 같이 모을 상대 저금(들어가는 묶음이면 그 묶음의 상대 저금)의 매달 금액.
   * 공개 단계로 못 보면(0) 비워 둠. 목표 금액은 묶음 것을 쓰니 새 저금에는 묻지 않음
   */
  const partnerMonthly = (goalId: string | null | undefined) => {
    const m = d.ready && goalId ? (d.byId(goalId)?.monthly ?? 0) : 0;
    return m > 0 ? m : null;
  };
  const joinPartnerGoal = () =>
    bundles.data?.find((b) => b.id === bundleId)?.goals.find((g) => !g.mine)?.id ?? null;
  /** 처음 단계(주소의 goal에 따라). skipOpen = ‘따로 새로 모을게요’를 고른 뒤 */
  const firstStep = (skipOpen = false) => {
    if (!skipOpen && open) return setStep('exist');
    if (join) {
      // 주소에 내 저금(`?goal=`)이 있으면 고른 채로 고지, 고를 저금이 없으면 바로 새 저금 이름(18 H1)
      if (given?.owner === 'mine' && !given.goal.bundle_id) {
        setMineGoal(given.goal.id);
        return setStep('notice');
      }
      if (
        !d.ready ||
        !d.live.some((i) => i.owner === 'mine' && !i.goal.bundle_id && i.state === 'saving')
      ) {
        setMineGoal(NEW);
        setNewName(bundleShownName(bundles.data?.find((b) => b.id === bundleId)?.name ?? ''));
        setNewMonthly(partnerMonthly(joinPartnerGoal()));
        return setStep('newName');
      }
      return setStep('mine');
    }
    if (given?.owner === 'partner' && !given.goal.bundle_id) {
      setPartnerGoal(given.goal.id);
      return setStep('mine');
    }
    if (given?.owner === 'mine' && !given.goal.bundle_id) {
      setMineGoal(given.goal.id);
      return setStep('target');
    }
    setStep('partner');
  };
  useEffect(() => {
    if (!ready || step) return;
    firstStep();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  if (!d.ready && d.failed) return <SavingQuestionError onBack={back} onRetry={d.retry} />;
  if (!ready || !step) return <QuestionSkeleton />;
  // 각자 엔진 + 연결만(합쳐서 엔진에는 묶음이 없음, 서버도 거절)
  if (d.joint || d.space.couple_state !== 'connected') {
    return <Navigate to={salaryPaths.checklist} replace />;
  }
  const bundle = join ? bundles.data?.find((b) => b.id === bundleId) : undefined;
  if (join && (!bundle || bundle.goals.some((g) => g.mine)))
    return (
      <Navigate to={bundle ? togetherPaths.bundle(bundleId) : salaryPaths.checklist} replace />
    );

  const free = (i: SavingItem) => !i.goal.bundle_id && i.state === 'saving';
  const partnerList = d.live.filter((i) => i.owner === 'partner' && free(i));
  const mineList = d.live.filter((i) => i.owner === 'mine' && free(i));
  const pg = partnerGoal ? d.byId(partnerGoal) : undefined;
  const mg = mineGoal && mineGoal !== NEW ? d.byId(mineGoal) : undefined;
  const go = (s: Step) => {
    setTrail((t) => [...t, step]);
    setStep(s);
  };
  const prev = () => {
    const last = trail.at(-1);
    if (!last) return back();
    setTrail((t) => t.slice(0, -1));
    setStep(last);
  };
  // 목표 금액 처음 값(Q11): 두 저금 목표 금액 합(상대 저금을 고르지 않았으면 내 것)
  const targetDefault = pg
    ? bundleTargetDefault(pg.target, mg?.target ?? null)
    : (mg?.target ?? null);
  const tv = target === undefined ? targetDefault : target;
  const dv = deadline === undefined ? (mg?.deadline ?? pg?.deadline ?? null) : deadline;
  const afterMine = () => go(join ? 'notice' : 'target');

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let goalId = mg?.goal.id ?? null;
      if (mineGoal === NEW)
        goalId = await addSavingItem({
          name: newName.trim(),
          monthly: newMonthly ?? 0,
          target: null,
          deadline: null,
        });
      if (!goalId) return;
      let bid = bundleId;
      const then = thenOf(params);
      if (join) {
        await joinBundle(bundleId, goalId);
        track('bundle_joined', {
          entry: then ? 'money_in' : params.get('goal') ? 'exist' : 'notification',
          has_target: bundle?.pct !== null,
          on: true,
        });
      } else {
        bid = await createBundle({
          goalId,
          name: pg?.goal.name ?? mg?.goal.name ?? newName.trim(),
          target: tv,
          deadline: tv !== null ? dv : null,
          separate,
        });
        track('bundle_created', {
          entry: given?.owner === 'partner' ? 'band' : given ? 'saving' : 'direct',
          has_target: tv !== null,
          on: true,
          separate,
        });
      }
      if (pctOnly) {
        await setBundleVisibility(bid, { percentOnly: true });
        track('bundle_percent_only_toggled', { on: true });
      }
      await Promise.all([refreshBundles(qc), refreshSaving(qc)]);
      carryToast(copy.bundleStarted);
      nav(then ?? savingPaths.item(goalId), { replace: true });
    } catch (e) {
      toast(
        e instanceof BundleBlocked
          ? e.reason === 'bundle_open'
            ? copy.bundleOpenBlocked
            : copy.bundleBlocked
          : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  // 스테퍼(2026-11-24, FormScreen step): 앞 답이 뒤 질문을 정하는 분기 흐름이라 한 화면으로 못 합침. 새 저금의 이름·매달 금액, 목표 금액·기한은 각각 한 화면
  const flow: Step[] = join
    ? [
        ...(d.live.some((i) => i.owner === 'mine' && free(i)) && !given
          ? (['mine'] as Step[])
          : []),
        ...(mineGoal === NEW ? (['newName'] as Step[]) : []),
        'notice',
      ]
    : [
        ...(given?.owner === 'partner' || given?.owner === 'mine' ? [] : (['partner'] as Step[])),
        ...(given?.owner === 'mine' ? [] : (['mine'] as Step[])),
        ...(mineGoal === NEW ? (['newName'] as Step[]) : []),
        'target',
        'notice',
      ];
  const stepHead = (cur: Step) => {
    const at = flow.indexOf(cur);
    if (at < 0) return undefined;
    const done: StepDone[] = [];
    if (pg && flow.indexOf('partner') >= 0 && at > flow.indexOf('partner'))
      done.push({ label: copy.doneBundlePartner, value: pg.goal.name });
    if (flow.indexOf('mine') >= 0 && at > flow.indexOf('mine') && mineGoal)
      done.push({
        label: copy.doneBundleMine,
        value: mineGoal === NEW ? copy.bundleNewSaving : (mg?.goal.name ?? ''),
      });
    if (mineGoal === NEW && at > flow.indexOf('newName'))
      done.push({ label: copy.doneBundleNew, value: newName.trim() });
    return { index: at + 1, total: flow.length, done };
  };
  const heading = join ? copy.bundleJoinTitle : copy.bundleTitle;

  // 들어갈 묶음(상대가 만듦) → ‘같이 모을게요’ = 들어가기(이 저금을 고른 채로), 기다리는 묶음(내가 만듦) → 따로 하나 더 또는 나중에
  if (step === 'exist' && open) {
    const q = openJoin
      ? copy.bundleJoinQ(d.partnerName, bundleShownName(open.name))
      : copy.bundleWaitingQ(d.partnerName, bundleShownName(open.name));
    const pick = (v: string) => {
      track('bundle_open_answered', {
        choice: v === JOIN ? 'join' : v === SEPARATE ? 'separate' : 'later',
      });
      if (v === JOIN) {
        const qs = new URLSearchParams();
        if (given?.owner === 'mine' && !given.goal.bundle_id) qs.set('goal', given.goal.id);
        const str = qs.toString();
        return nav(`${togetherPaths.bundleJoin(open.id)}${str ? `?${str}` : ''}`, {
          replace: true,
        });
      }
      if (v === SEPARATE) {
        setSeparate(true);
        setTrail((t) => [...t, 'exist']);
        return firstStep(true);
      }
      back();
    };
    return (
      <FormScreen
        title={heading}
        onBack={back}
        primary={{ label: copy.next, disabled: !existPick }}
        onSubmit={() => existPick && pick(existPick)}
      >
        <FormSection title={q} aside={undefined}>
          <p className="hg-form__hint">{openJoin ? copy.bundleJoinHelp : copy.bundleWaitingHelp}</p>
          <SegChoice<string>
            label={q}
            value={existPick}
            onChange={setExistPick}
            variant="rows"
            items={
              openJoin
                ? [
                    { value: JOIN, label: copy.bundleAskYes },
                    { value: SEPARATE, label: copy.bundleSeparate },
                  ]
                : [
                    { value: SEPARATE, label: copy.bundleSeparate },
                    { value: '__later', label: copy.laterAnswer },
                  ]
            }
          />
        </FormSection>
      </FormScreen>
    );
  }
  if (step === 'partner')
    return (
      <FormScreen
        title={heading}
        onBack={prev}
        step={stepHead('partner')}
        primary={{ label: copy.next, disabled: partnerGoal === null }}
        onSubmit={() => {
          if (partnerGoal === MINE_ONLY) setPartnerGoal(null);
          go('mine');
        }}
      >
        <FormSection title={copy.bundlePartnerQ(d.partnerName)}>
          <SegChoice<string>
            label={copy.bundlePartnerQ(d.partnerName)}
            value={partnerGoal}
            onChange={setPartnerGoal}
            variant="rows"
            items={[
              ...partnerList.map((i) => ({ value: i.goal.id, label: i.goal.name })),
              { value: MINE_ONLY, label: copy.bundleFromMine },
            ]}
          />
        </FormSection>
      </FormScreen>
    );
  if (step === 'mine')
    return (
      <FormScreen
        title={heading}
        onBack={prev}
        step={stepHead('mine')}
        primary={{ label: copy.next, disabled: mineGoal === null }}
        onSubmit={() => {
          if (mineGoal !== NEW) return afterMine();
          // 새 저금 이름 처음 값: 고른 상대 저금(또는 들어가는 묶음) 이름
          setNewName(pg?.goal.name ?? bundleShownName(bundle?.name ?? ''));
          if (newMonthly === null) setNewMonthly(partnerMonthly(pg?.goal.id ?? joinPartnerGoal()));
          go('newName');
        }}
      >
        <FormSection
          title={
            join && bundle
              ? copy.bundleJoinQ(d.partnerName, bundleShownName(bundle.name))
              : copy.bundleMineQ
          }
        >
          {join && <p className="hg-form__hint">{copy.bundleMineQ}</p>}
          <SegChoice<string>
            label={copy.bundleMineQ}
            value={mineGoal}
            onChange={setMineGoal}
            variant="rows"
            items={[
              ...mineList.map((i) => ({ value: i.goal.id, label: i.goal.name })),
              { value: NEW, label: copy.bundleNewSaving },
            ]}
          />
        </FormSection>
      </FormScreen>
    );
  // 새 저금: 이름 + 매달 금액을 한 화면에
  if (step === 'newName') {
    const monthlyBad = newMonthly === null || newMonthly % 10_000 !== 0;
    return (
      <FormScreen
        title={heading}
        onBack={prev}
        step={stepHead('newName')}
        primary={{ label: copy.next, disabled: !newName.trim() || monthlyBad }}
        onSubmit={afterMine}
      >
        <FormSection title={copy.addNameQ}>
          <ShortText
            label={copy.addNameQ}
            value={newName}
            onChange={setNewName}
            max={20}
            placeholder={copy.addNamePlaceholder}
            autoFocus={false}
          />
        </FormSection>
        <FormSection title={copy.addMonthlyQ}>
          <FormAmount
            label={copy.addMonthlyQ}
            sheetTitle={copy.addMonthlyQ}
            value={newMonthly}
            onChange={setNewMonthly}
            quick={quickChips.monthly}
            quickSet
            below={
              newMonthly !== null && newMonthly % 10_000 !== 0 ? (
                <p className="hg-help">{copy.tenThousandUnit}</p>
              ) : undefined
            }
          />
        </FormSection>
      </FormScreen>
    );
  }
  // 목표 금액 + 기한을 한 화면에(기한은 목표 금액을 입력했을 때만)
  if (step === 'target') {
    const ym = dv ?? defaultDeadline();
    const err = tv && ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
    return (
      <FormScreen
        title={heading}
        onBack={prev}
        step={stepHead('target')}
        later={{
          label: copy.bundleNoTarget,
          onClick: () => {
            setTarget(null);
            setDeadline(null);
            setPctOnly(false);
            go('notice');
          },
        }}
        primary={{ label: copy.next, disabled: !tv || !!err }}
        onSubmit={() => {
          setDeadline(deadline === null ? null : ym);
          go('notice');
        }}
      >
        <FormSection title={copy.bundleTargetQ}>
          <FormAmount
            label={copy.bundleTargetQ}
            sheetTitle={copy.bundleTargetQ}
            value={tv}
            onChange={(x) => setTarget(x && x > 0 ? x : null)}
            allowZero={false}
            monthly={false}
            below={
              targetDefault !== null && pg ? (
                <p className="hg-form__hint">{copy.bundleTargetHelp}</p>
              ) : undefined
            }
          />
        </FormSection>
        {tv && (
          <FormSection
            title={copy.bundleDeadlineQ}
            aside={
              dv !== null || deadline === undefined ? (
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  onClick={() => setDeadline(null)}
                >
                  {copy.bundleNoDeadline}
                </button>
              ) : undefined
            }
          >
            {deadline === null ? (
              <button
                type="button"
                className="hg-btn hg-btn--link hg-form__quick"
                onClick={() => setDeadline(ym)}
              >
                {copy.bundleDeadlineQ}
              </button>
            ) : (
              <YearMonthField
                label={copy.bundleDeadlineQ}
                value={ym}
                onChange={(x) => setDeadline(x as YearMonth | null)}
                error={err}
              />
            )}
          </FormSection>
        )}
      </FormScreen>
    );
  }
  // 고지(G1): 숨겨 주지 못하는 것은 숨겨 준다고 말하지 않음. 퍼센트만은 목표 금액이 있을 때만
  const canPct = join ? bundle?.pct !== null : canPercentOnly(tv ?? null);
  return (
    <FormScreen
      title={heading}
      onBack={prev}
      step={stepHead('notice')}
      primary={{ label: join ? copy.bundleJoin : copy.bundleStart, loading: busy }}
      onSubmit={() => void submit()}
    >
      <FormSection title={copy.bundleNoticeQ}>
        <p className="hg-form__hint">{copy.bundleNotice}</p>
        {canPct ? (
          <>
            <Checkbox label={copy.percentOnly} checked={pctOnly} onChange={setPctOnly} />
            <p className="hg-form__hint">{copy.percentOnlyHelp}</p>
          </>
        ) : (
          <p className="hg-form__hint">{copy.percentOnlyNoTarget}</p>
        )}
      </FormSection>
    </FormScreen>
  );
}

/**
 * 묶음 알림 링크(`/salary/bundles/:id`, 서버 bundle_created·bundle_changed·bundle_achieved): 아직 내 저금을 넣지 않았으면
 * 들어가기(W-15 2~4단계), 달성을 처음 보면 W-12(묶음), 아니면 내 저금 W-10. 없어진 묶음은 저금 목록(W-13)
 */
export function BundleEntry() {
  const { id = '' } = useParams();
  const bundles = useBundles();
  const [seen, setSeen] = useState<boolean | null>(null);
  const b = bundles.data?.find((x) => x.id === id);
  const mine = b?.goals.find((g) => g.mine);
  useEffect(() => {
    if (!b || !mine) return;
    if (b.status !== 'achieved') return setSeen(false);
    void achieveBundle(b.id)
      .then(setSeen)
      .catch(() => setSeen(false));
  }, [b?.id, b?.status, mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (bundles.isLoading) return <QuestionSkeleton />;
  if (!b) return <Navigate to={savingPaths.list} replace />;
  if (!mine) return <Navigate to={togetherPaths.bundleJoin(id)} replace />;
  if (seen === null) return <QuestionSkeleton />;
  return (
    <Navigate to={seen ? togetherPaths.bundleAchieved(id) : savingPaths.item(mine.id)} replace />
  );
}
