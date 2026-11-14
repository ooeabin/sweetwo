import {
  achieveBundle,
  addSavingItem,
  BundleBlocked,
  createBundle,
  joinBundle,
  setBundleVisibility,
} from '@sweetwo/api';
import {
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
  AmountInput,
  Checkbox,
  ChoiceCards,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
  YearMonthInput,
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

type Step =
  'exist' | 'partner' | 'mine' | 'newName' | 'newMonthly' | 'target' | 'deadline' | 'notice';
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
        setNewName(bundles.data?.find((b) => b.id === bundleId)?.name ?? '');
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

  // 들어갈 묶음(상대가 만듦) → ‘같이 모을게요’ = 들어가기(이 저금을 고른 채로), 기다리는 묶음(내가 만듦) → 따로 하나 더 또는 나중에
  if (step === 'exist' && open)
    return (
      <QuestionLayout
        title={
          openJoin
            ? copy.bundleJoinQ(d.partnerName, open.name)
            : copy.bundleWaitingQ(d.partnerName, open.name)
        }
        help={openJoin ? copy.bundleJoinHelp : copy.bundleWaitingHelp}
        onBack={back}
      >
        <ChoiceCards<string>
          label={
            openJoin
              ? copy.bundleJoinQ(d.partnerName, open.name)
              : copy.bundleWaitingQ(d.partnerName, open.name)
          }
          value={null}
          onChange={() => undefined}
          onPick={(v) => {
            track('bundle_open_answered', {
              choice: v === JOIN ? 'join' : v === SEPARATE ? 'separate' : 'later',
            });
            if (v === JOIN) {
              const q = new URLSearchParams();
              if (given?.owner === 'mine' && !given.goal.bundle_id) q.set('goal', given.goal.id);
              const s = q.toString();
              return nav(`${togetherPaths.bundleJoin(open.id)}${s ? `?${s}` : ''}`, {
                replace: true,
              });
            }
            if (v === SEPARATE) {
              setSeparate(true);
              setTrail((t) => [...t, 'exist']);
              return firstStep(true);
            }
            back();
          }}
          options={
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
      </QuestionLayout>
    );
  if (step === 'partner')
    return (
      <QuestionLayout title={copy.bundlePartnerQ(d.partnerName)} onBack={prev}>
        <ChoiceCards<string>
          label={copy.bundlePartnerQ(d.partnerName)}
          value={partnerGoal}
          onChange={setPartnerGoal}
          onPick={(v) => {
            if (v === MINE_ONLY) setPartnerGoal(null);
            go('mine');
          }}
          options={[
            ...partnerList.map((i) => ({ value: i.goal.id, label: i.goal.name })),
            { value: MINE_ONLY, label: copy.bundleFromMine },
          ]}
        />
      </QuestionLayout>
    );
  if (step === 'mine')
    return (
      <QuestionLayout
        title={join && bundle ? copy.bundleJoinQ(d.partnerName, bundle.name) : copy.bundleMineQ}
        help={join ? copy.bundleMineQ : undefined}
        onBack={prev}
      >
        <ChoiceCards<string>
          label={copy.bundleMineQ}
          value={mineGoal}
          onChange={setMineGoal}
          onPick={(v) => {
            if (v !== NEW) return afterMine();
            // 새 저금 이름 처음 값: 고른 상대 저금(또는 들어가는 묶음) 이름
            setNewName(pg?.goal.name ?? bundle?.name ?? '');
            if (newMonthly === null)
              setNewMonthly(partnerMonthly(pg?.goal.id ?? joinPartnerGoal()));
            go('newName');
          }}
          options={[
            ...mineList.map((i) => ({ value: i.goal.id, label: i.goal.name })),
            { value: NEW, label: copy.bundleNewSaving },
          ]}
        />
      </QuestionLayout>
    );
  if (step === 'newName')
    return (
      <QuestionLayout
        title={copy.addNameQ}
        onBack={prev}
        primary={{ label: copy.next, disabled: !newName.trim() }}
        onSubmit={() => go('newMonthly')}
      >
        <ShortText
          label={copy.addNameQ}
          value={newName}
          onChange={setNewName}
          max={20}
          placeholder={copy.addNamePlaceholder}
        />
      </QuestionLayout>
    );
  if (step === 'newMonthly')
    return (
      <QuestionLayout
        title={copy.addMonthlyQ}
        onBack={prev}
        primary={{
          label: copy.next,
          disabled: newMonthly === null || newMonthly % 10_000 !== 0,
        }}
        onSubmit={afterMine}
      >
        <AmountInput
          label={copy.addMonthlyQ}
          value={newMonthly}
          onChange={setNewMonthly}
          quick={quickChips.monthly}
          quickSet
          monthly
          allowZero
        />
        {newMonthly !== null && newMonthly % 10_000 !== 0 && (
          <p className="hg-help">{copy.tenThousandUnit}</p>
        )}
      </QuestionLayout>
    );
  if (step === 'target')
    return (
      <QuestionLayout
        title={copy.bundleTargetQ}
        help={targetDefault !== null && pg ? copy.bundleTargetHelp : undefined}
        onBack={prev}
        primary={{ label: copy.next, disabled: !tv }}
        onSubmit={() => go('deadline')}
        later={{
          label: copy.bundleNoTarget,
          onClick: () => {
            setTarget(null);
            setPctOnly(false);
            go('notice');
          },
        }}
      >
        <AmountInput
          label={copy.bundleTargetQ}
          value={tv}
          onChange={(x) => setTarget(x && x > 0 ? x : null)}
        />
      </QuestionLayout>
    );
  if (step === 'deadline') {
    const ym = dv ?? defaultDeadline();
    const err = ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
    return (
      <QuestionLayout
        title={copy.bundleDeadlineQ}
        onBack={prev}
        primary={{ label: copy.next, disabled: !!err }}
        onSubmit={() => {
          setDeadline(ym);
          go('notice');
        }}
        later={{
          label: copy.bundleNoDeadline,
          onClick: () => {
            setDeadline(null);
            go('notice');
          },
        }}
      >
        <YearMonthInput
          label={copy.bundleDeadlineQ}
          value={ym}
          onChange={(x) => setDeadline(x as YearMonth | null)}
          error={err}
        />
      </QuestionLayout>
    );
  }
  // 고지(G1): 숨겨 주지 못하는 것은 숨겨 준다고 말하지 않음. 퍼센트만은 목표 금액이 있을 때만
  const canPct = join ? bundle?.pct !== null : canPercentOnly(tv ?? null);
  return (
    <QuestionLayout
      title={copy.bundleNoticeQ}
      help={copy.bundleNotice}
      onBack={prev}
      primary={{ label: join ? copy.bundleJoin : copy.bundleStart, loading: busy }}
      onSubmit={() => void submit()}
    >
      {canPct ? (
        <div className="hg-stack" style={{ gap: 'var(--space-1)' }}>
          <Checkbox label={copy.percentOnly} checked={pctOnly} onChange={setPctOnly} />
          <p className="hg-help" style={{ margin: 0 }}>
            {copy.percentOnlyHelp}
          </p>
        </div>
      ) : (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.percentOnlyNoTarget}
        </p>
      )}
    </QuestionLayout>
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
