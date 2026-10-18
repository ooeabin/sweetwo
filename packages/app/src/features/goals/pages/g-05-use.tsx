import {
  fetchAssets,
  GoalUsedError,
  moveGoalRest,
  qk,
  recordGoalUse,
  type GoalPaidFrom,
  type GoalUseResult,
} from '@sweetwo/api';
import { AmountInput, Button, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useGoalsData } from '../data';

type Step = 'ask' | 'amount' | 'from' | 'asset' | 'rest' | 'pick';
type Ask = keyof typeof copy.useOptions;
const FROM: GoalPaidFrom[] = ['goal_fund', 'living', 'personal'];
type Then = 'goal' | 'add' | 'allowance';
const THEN: Record<Then, string> = {
  goal: '/goals/order',
  add: '/goals/new',
  allowance: '/assets/money/allowance',
};

// G-05 사용 기록(22 G-05 사용 기록): “가전 바꾸기에 모은 400만 원, 썼나요?”
// 아직이에요 → 달성 유지 / 썼어요 → 얼마(보유액 채움) → 낸 곳(목표자금 통장, 생활비 통장·카드, 각자 돈) / 다른 자산으로 옮겼어요 → 자산 고르기.
// 생활비로 냈으면 이번 달 월급 나누기에 ‘목표자금 → 공동 생활비’ 줄(5초 안내 + 월급 나누기 보기). 남은 보유액은 비상금으로(‘다른 목표로’).
// 배우자가 먼저 기록했으면 “예빈님이 기록했어요” + 기록 보기. 보낼 곳(?then=)을 골랐으면 끝난 뒤 그곳으로.
export function G05Use() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const { masked } = useMask();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const [step, setStep] = useState<Step>('ask');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [from, setFrom] = useState<GoalPaidFrom | null>(null);
  const [asset, setAsset] = useState<string | null>(null);
  const [restTo, setRestTo] = useState<string | null>(null);
  const [result, setResult] = useState<GoalUseResult | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || assets.isLoading) return null;
  const g = d.view?.lines.find((x) => x.id === id);
  const row = d.goals.find((x) => x.id === id);
  if (!g || !row) return <Navigate to="/goals" replace />;
  const m = (v: number) => money(v, masked);
  const detail = `/goals/${id}`;
  const then = params.get('then') as Then | null;
  const finish = () => nav(then && then in THEN ? THEN[then] : detail, { replace: true });
  const spent = amount === undefined ? g.held : amount;
  const goalName = (gid: string | null) => d.goals.find((x) => x.id === gid)?.name ?? '';

  // 이미 사용 완료(먼저 기록한 사람이 있음)
  if (row.status === 'used' && !result)
    return (
      <QuestionLayout
        title={copy.partnerRecorded(d.couple?.partnerName ?? '')}
        onBack={() => nav(detail)}
      >
        <Button variant="secondary" onClick={() => nav(detail, { replace: true })}>
          {copy.seeRecord}
        </Button>
      </QuestionLayout>
    );

  const save = async (kind: 'spent' | 'moved', paidFrom: GoalPaidFrom, assetId: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await recordGoalUse({
        goalId: id,
        kind,
        amount: kind === 'spent' ? (spent ?? 0) : g.held,
        paidFrom,
        assetId,
        held: g.held,
      });
      setResult(r);
      if (r.rest > 0) setStep('rest');
      await Promise.all(
        [qk.goals, qk.goalRecords, qk.todos].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      await qc.invalidateQueries({ queryKey: ['monthly_plan'] });
      if (r.line > 0)
        toast(copy.useLine(m(r.line)), { label: copy.seeSplit, onClick: () => nav('/plan/split') });
      if (r.rest <= 0) finish();
    } catch (e) {
      if (e instanceof GoalUsedError) {
        await qc.invalidateQueries({ queryKey: qk.goals });
        return;
      }
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'rest' && result)
    return (
      <QuestionLayout
        title={copy.restMoved(m(result.rest), goalName(result.restGoal))}
        primary={{ label: copy.ok }}
        onSubmit={finish}
      >
        <Button variant="secondary" onClick={() => setStep('pick')}>
          {copy.restOther}
        </Button>
      </QuestionLayout>
    );

  if (step === 'pick' && result) {
    const others = d.goals.filter(
      (x) => x.id !== id && x.id !== result.restGoal && !['used', 'achieved'].includes(x.status),
    );
    return (
      <QuestionLayout title={copy.restPick} onBack={() => setStep('rest')}>
        <ChoiceCards<string>
          label={copy.restPick}
          value={restTo}
          onChange={setRestTo}
          onPick={(gid) =>
            result.use &&
            void moveGoalRest(result.use, gid)
              .then(() => qc.invalidateQueries({ queryKey: qk.goals }))
              .then(() => {
                toast(copy.restDone);
                finish();
              })
              .catch(() => toast(copy.loadFailed))
          }
          options={others.map((x) => ({ value: x.id, label: x.name }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'amount')
    return (
      <QuestionLayout
        title={copy.useAmount}
        onBack={() => setStep('ask')}
        primary={{ label: copy.next, disabled: !spent }}
        onSubmit={() => spent && setStep('from')}
      >
        <AmountInput label={copy.useAmount} value={spent} onChange={setAmount} />
      </QuestionLayout>
    );

  if (step === 'from') {
    const title = copy.useFrom(m(spent ?? 0));
    return (
      <QuestionLayout title={title} onBack={() => setStep('amount')}>
        <ChoiceCards<GoalPaidFrom>
          label={title}
          value={from}
          onChange={setFrom}
          onPick={(f) => void save('spent', f, null)}
          options={FROM.map((f) => ({ value: f, label: copy.paidFrom[f] }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'asset') {
    const list = (assets.data ?? []).filter((a) => a.side === 'asset' && a.goal_id !== id);
    return (
      <QuestionLayout title={copy.useAsset} onBack={() => setStep('ask')}>
        {list.length === 0 ? (
          <p className="hg-q__help">{copy.noAssets}</p>
        ) : (
          <ChoiceCards<string>
            label={copy.useAsset}
            value={asset}
            onChange={setAsset}
            onPick={(a) => void save('moved', 'goal_fund', a)}
            options={list.map((a) => ({ value: a.id, label: a.name, sub: m(a.amount) }))}
          />
        )}
      </QuestionLayout>
    );
  }

  const title = copy.useAsk(g.name, m(g.held));
  return (
    <QuestionLayout title={title} onBack={() => nav(detail)}>
      <ChoiceCards<Ask>
        label={title}
        value={ask}
        onChange={setAsk}
        onPick={(a) => (a === 'later' ? finish() : setStep(a === 'spent' ? 'amount' : 'asset'))}
        options={(Object.keys(copy.useOptions) as Ask[]).map((k) => ({
          value: k,
          label: copy.useOptions[k],
        }))}
      />
    </QuestionLayout>
  );
}
