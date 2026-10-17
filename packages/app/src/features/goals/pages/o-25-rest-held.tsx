import { fetchAssets, linkAssets, qk, updateGoal } from '@sweetwo/api';
import { formatManWon, orderableGoals, quickChips, type Answers } from '@sweetwo/core';
import { AmountInput, ChoiceCards, Chip, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { GoalChip } from '../../onboarding';
import { copy } from '../copy';
import { restPath, useRest } from '../week/rest';

type Pick = 'assets' | 'new' | 'none';

// O-25 이미 모아둔 돈(첫 주 5일째, G-03d와 같은 선택): 가진 자산에서 고르기(여러 개, 목표에 연결) / 새로 입력할게요(기타 보유액) / 없어요.
// 고를 수 있는 자산 = 내가 고칠 수 있고 아직 다른 목표에 없는 자산, 없으면 첫 선택지 숨김. 답하면 details._held
export function O25RestHeld() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const { d } = useRest();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const [pick, setPick] = useState<Pick | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  if (d.loading || assets.isLoading) return null;
  const goal = d.goals.find((g) => g.id === id);
  if (!goal) return <Navigate to={restPath.next} replace />;
  const myId = d.me?.id;
  const pickable = (assets.data ?? []).filter(
    (a) =>
      a.side === 'asset' &&
      !a.goal_id &&
      a.visibility !== 'private' &&
      (a.owner === 'joint' ||
        a.owner_user_id === myId ||
        (a.owner_user_id === null && a.created_by === myId)),
  );
  const total = pickable
    .filter((a) => ids.includes(a.id))
    .reduce((t, a) => t + (a.principal ?? a.amount), 0);
  const rank = orderableGoals(d.goals).findIndex((g) => g.id === id) + 1;

  const save = async (p: Pick) => {
    if (saving) return;
    setSaving(true);
    try {
      const details = { ...((goal.details ?? {}) as Answers), _held: true };
      if (p === 'assets') await linkAssets(ids, goal.id);
      await updateGoal(goal.id, {
        details: details as never,
        ...(p === 'new' && amount ? { other_held: amount } : {}),
      });
      await Promise.all(
        [qk.goals, qk.assets, qk.goalAssetSums].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      nav(restPath.next);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.weekHeldTitle}
      onBack={() => nav(-1)}
      later={{ label: copy.weekClose, onClick: () => nav('/') }}
      primary={
        pick === 'new'
          ? { label: copy.next, disabled: amount === null || amount <= 0, loading: saving }
          : pick === 'assets'
            ? { label: copy.next, disabled: !ids.length, loading: saving }
            : undefined
      }
      onSubmit={() => pick && pick !== 'none' && void save(pick)}
    >
      <GoalChip tag={rank > 0 ? copy.weekRank(rank) : undefined} name={goal.name} />
      <ChoiceCards<Pick>
        label={copy.weekHeldTitle}
        value={pick}
        onChange={setPick}
        onPick={(v) => v === 'none' && void save('none')}
        options={[
          ...(pickable.length ? [{ value: 'assets' as const, label: copy.heldAssets }] : []),
          { value: 'new', label: copy.heldNew },
          { value: 'none', label: copy.heldNone },
        ]}
      />
      {pick === 'assets' && (
        <>
          <div
            className="hg-row"
            role="group"
            aria-label={copy.heldAssets}
            style={{ gap: 'var(--space-2)' }}
          >
            {pickable.map((a) => (
              <Chip
                key={a.id}
                selected={ids.includes(a.id)}
                onClick={() =>
                  setIds((x) => (x.includes(a.id) ? x.filter((i) => i !== a.id) : [...x, a.id]))
                }
              >
                {a.name} {formatManWon(a.principal ?? a.amount)}
              </Chip>
            ))}
          </div>
          <p className="hg-q__help" aria-live="polite">
            {copy.heldAssetsTotal(`${formatManWon(total)} 원`)}
          </p>
        </>
      )}
      {pick === 'new' && (
        <AmountInput
          label={copy.heldAmount}
          value={amount}
          onChange={setAmount}
          quick={quickChips.small}
          embedded
        />
      )}
    </QuestionLayout>
  );
}
