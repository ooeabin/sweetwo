import { finishGoalUse, GoalUsedError, moveGoalSaved, qk } from '@sweetwo/api';
import { AmountInput, Button, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { useSplits } from '../../salary';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { useGoalsModel } from '../model';
import { addToGoalLine, mySplit } from '../freed';

type Step = 'ask' | 'amount' | 'rest' | 'restPick' | 'sendPick';
type Ask = keyof typeof copy.useOptions;
type Rest = keyof typeof copy.restOptions;
type Then = 'goal' | 'add' | 'split';

// G-05 사용 기록(22 G-05 사용 기록): “가전 바꾸기에 모은 400만 원, 썼나요?”
// 아직이에요 → 달성 유지 / 썼어요 → “얼마 썼어요?”(모은 돈 채움) → 모은 돈에서 꺼내 쓰기 + 사용 완료.
// 쓴 돈 < 모은 돈이면 “남은 20만 원은 어떻게 할까요?” 비상금에 넣기 / 다른 목표에 넣기 / 그대로 두기.
// 배우자가 먼저 기록했으면 “예빈님이 기록했어요” + 기록 보기. 매달 넣던 돈(?then=, ?m=)을 골랐으면 끝난 뒤 그곳으로.
export function G05Use() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const model = useGoalsModel();
  const splits = useSplits();
  const { masked } = useMask();
  const [step, setStep] = useState<Step>('ask');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [rest, setRest] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || model.loading || splits.isLoading) return null;
  const item = model.ready ? model.byId(id) : undefined;
  const row = d.goals.find((x) => x.id === id);
  if (!item || !row) return <Navigate to="/goals" replace />;
  const g = { name: row.name, held: item.saved, illustration: item.illustration, custom: item.custom };
  const m = (v: number) => money(v, masked);
  const detail = `/goals/${id}`;
  const then = params.get('then') as Then | null;
  const monthly = Number(params.get('m') ?? '0');
  const spent = amount === undefined ? g.held : amount;
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.goalRecords, qk.goalSaved, qk.splits].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  // 매달 넣던 돈으로 갈 다른 목표: 모으는 중인 목표(이 목표 빼고), 배우자 내 목표 빼고
  const targets = d.goals.filter(
    (x) =>
      x.id !== id &&
      ['active', 'delayed'].includes(x.status) &&
      (x.owner_user_id === null || x.owner_user_id === d.me?.id),
  );
  const finish = () => {
    if (then === 'goal' && monthly > 0) return setStep('sendPick');
    if (then === 'add' && monthly > 0) return nav(`/goals/new?freed=${monthly}`, { replace: true });
    if (then === 'split') return nav('/salary/split', { replace: true });
    nav(detail, { replace: true });
  };

  // 이미 사용 완료(먼저 기록한 사람이 있음)
  if (row.status === 'used' && step === 'ask')
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

  const run = async (act: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try {
      await act();
    } catch (e) {
      if (e instanceof GoalUsedError) await refresh();
      else toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'sendPick')
    return (
      <QuestionLayout title={copy.sendPick} onBack={() => nav(detail, { replace: true })}>
        <ChoiceCards<string>
          label={copy.sendPick}
          value={pick}
          onChange={setPick}
          onPick={(gid) =>
            void run(async () => {
              const split = mySplit(splits.data, d.me?.id, d.space?.salary_mode === 'joint');
              if (!split) return nav(detail, { replace: true });
              const undo = await addToGoalLine(split, gid, monthly);
              await refresh();
              const name = d.goals.find((x) => x.id === gid)?.name ?? '';
              toast(copy.sendDone(name, m(monthly)), {
                label: copy.undo,
                onClick: () => void undo().then(refresh),
              });
              nav(`/goals/${gid}`, { replace: true });
            })
          }
          options={targets.map((x) => ({ value: x.id, label: x.name }))}
        />
      </QuestionLayout>
    );

  if (step === 'restPick')
    return (
      <QuestionLayout title={copy.restPick} onBack={() => setStep('rest')}>
        <ChoiceCards<string>
          label={copy.restPick}
          value={pick}
          onChange={setPick}
          onPick={(gid) =>
            void run(async () => {
              await moveGoalSaved(id, gid);
              await refresh();
              toast(copy.restDone);
              finish();
            })
          }
          options={d.goals
            .filter((x) => x.id !== id && ['active', 'delayed', 'paused'].includes(x.status))
            .filter((x) => x.owner_user_id === null || x.owner_user_id === d.me?.id)
            .map((x) => ({ value: x.id, label: x.name }))}
        />
      </QuestionLayout>
    );

  if (step === 'rest') {
    const title = copy.restTitle(m(rest));
    const emergency = d.goals.find((x) => x.template === 'emergency' && x.id !== id);
    return (
      <QuestionLayout title={title}>
        <ChoiceCards<Rest>
          label={title}
          value={null}
          onChange={() => undefined}
          onPick={(r) =>
            r === 'keep'
              ? finish()
              : r === 'goal' || !emergency
                ? setStep('restPick')
                : void run(async () => {
                    await moveGoalSaved(id, emergency.id);
                    await refresh();
                    toast(copy.restDone);
                    finish();
                  })
          }
          options={(Object.keys(copy.restOptions) as Rest[]).map((k) => ({
            value: k,
            label: copy.restOptions[k],
          }))}
        />
      </QuestionLayout>
    );
  }

  if (step === 'amount')
    return (
      <QuestionLayout
        title={copy.useAmount}
        onBack={() => setStep('ask')}
        primary={{ label: copy.next, disabled: !spent, loading: saving }}
        onSubmit={() =>
          spent &&
          void run(async () => {
            const left = await finishGoalUse(id, spent);
            await refresh();
            if (left > 0) {
              setRest(left);
              setStep('rest');
            } else finish();
          })
        }
      >
        <AmountInput label={copy.useAmount} value={spent} onChange={setAmount} />
      </QuestionLayout>
    );

  const title = copy.useAsk(g.name, m(g.held));
  return (
    <QuestionLayout title={title} onBack={() => nav(detail)}>
      <ChoiceCards<Ask>
        label={title}
        value={ask}
        onChange={setAsk}
        onPick={(a) => (a === 'later' ? finish() : setStep('amount'))}
        options={(Object.keys(copy.useOptions) as Ask[]).map((k) => ({
          value: k,
          label: copy.useOptions[k],
        }))}
      />
    </QuestionLayout>
  );
}
