import { qk } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { useSplits } from '../../salary';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { addToGoalLine, mySplit } from '../freed';

type Send = keyof typeof copy.sendOptions;

// G-05 매달 넣던 돈(22 화면별 정의): “매달 넣던 25만 원은 어디로 보낼까요?” 다른 목표 / 새 목표 만들기 / 월급 계획에서 정할게요.
// 2026-11-04 사용 기록을 없애서 고르면 바로 그곳으로: 다른 목표 → “어느 목표에 더할까요?” → 그 저금 줄에 더함 + Toast ‘되돌리기’,
// 새 목표 → G-03a(만든 목표 줄에 그 금액), 월급 계획에서 정할게요 → 남는 돈으로 두고 W-01.
export function G05Send() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const splits = useSplits();
  const { masked } = useMask();
  const [v, setV] = useState<Send | null>(null);
  const [step, setStep] = useState<'send' | 'pick'>('send');
  const [pick, setPick] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const monthly = Number(params.get('m') ?? '0');
  const detail = `/goals/${id}`;
  const m = (x: number) => money(x, masked);
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.goalRecords, qk.goalSaved, qk.splits].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );

  if (step === 'pick') {
    if (d.loading || splits.isLoading) return <QuestionSkeleton />;
    // 모으는 중인 목표(이 목표 빼고), 파트너 내 목표 빼고
    const targets = d.goals.filter(
      (x) =>
        x.id !== id &&
        ['active', 'delayed'].includes(x.status) &&
        (x.owner_user_id === null || x.owner_user_id === d.me?.id),
    );
    return (
      <QuestionLayout title={copy.sendPick} onBack={() => setStep('send')}>
        <ChoiceCards<string>
          label={copy.sendPick}
          value={pick}
          onChange={setPick}
          onPick={(gid) => {
            if (saving) return;
            setSaving(true);
            void (async () => {
              try {
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
              } catch {
                toast(copy.loadFailed);
              } finally {
                setSaving(false);
              }
            })();
          }}
          options={targets.map((x) => ({ value: x.id, label: x.name }))}
        />
      </QuestionLayout>
    );
  }

  const title = copy.sendTitle(m(monthly));
  return (
    <QuestionLayout title={title} onBack={() => nav(detail)}>
      <ChoiceCards<Send>
        label={title}
        value={v}
        onChange={setV}
        onPick={(s) => {
          if (s === 'goal' && monthly > 0) return setStep('pick');
          if (s === 'add' && monthly > 0)
            return nav(`/goals/new?freed=${monthly}`, { replace: true });
          if (s === 'split') return nav('/salary/split', { replace: true });
          nav(detail, { replace: true });
        }}
        options={(Object.keys(copy.sendOptions) as Send[]).map((k) => ({
          value: k,
          label: copy.sendOptions[k],
        }))}
      />
    </QuestionLayout>
  );
}
