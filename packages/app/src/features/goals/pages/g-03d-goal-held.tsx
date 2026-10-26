import { fetchAssets, qk } from '@sweetwo/api';
import { formatManWon, quickChips } from '@sweetwo/core';
import { AmountInput, ChoiceCards, Chip, QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { useAddStep } from '../add/step';

type Pick = 'assets' | 'new' | 'none';

// G-03d 이미 모아둔 돈(O-25와 같음): 가진 자산에서 고르기(여러 개, 보유액 = 합계) / 새로 입력할게요 / 없어요.
// 고를 수 있는 자산 = 내가 고칠 수 있고 아직 다른 목표에 없는 자산. 자산이 없으면 첫 선택지 숨김.
// 새로 입력한 돈은 기타 보유액으로 저장(자산으로 저장은 F-03 흐름과 묶을 때).
export function G03dGoalHeld() {
  const s = useAddStep('held');
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const myId = s.data.me?.id;
  const pickable = (assets.data ?? []).filter(
    (a) =>
      a.side === 'asset' &&
      !a.goal_id &&
      a.visibility !== 'private' &&
      (a.owner === 'joint' ||
        a.owner_user_id === myId ||
        (a.owner_user_id === null && a.created_by === myId)),
  );
  const saved = s.draft.held;
  const [pick, setPick] = useState<Pick | null>(
    saved === 'assets'
      ? 'assets'
      : typeof saved === 'number' || saved === 'new'
        ? 'new'
        : saved === 'none'
          ? 'none'
          : null,
  );
  const [amount, setAmount] = useState<number | null>(typeof saved === 'number' ? saved : null);
  const [ids, setIds] = useState<string[]>(s.draft.assetIds);
  if (assets.isLoading) return null;
  const total = pickable
    .filter((a) => ids.includes(a.id))
    .reduce((t, a) => t + (a.principal ?? a.amount), 0);

  const primary =
    pick === 'new'
      ? { label: copy.next, disabled: amount === null || amount <= 0 }
      : pick === 'assets'
        ? { label: copy.next, disabled: !ids.length }
        : undefined;
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.heldTitle}
      onBack={s.onBack}
      primary={primary}
      onSubmit={() => {
        if (pick === 'new' && amount) s.next({ held: amount, assetIds: [], assetTotal: 0 });
        if (pick === 'assets' && ids.length)
          s.next({ held: 'assets', assetIds: ids, assetTotal: total });
      }}
    >
      <ChoiceCards<Pick>
        label={copy.heldTitle}
        value={pick}
        onChange={setPick}
        onPick={(v) => v === 'none' && s.next({ held: 'none', assetIds: [], assetTotal: 0 })}
        options={[
          // 재기획: 자산과 연결하지 않음(22 G-03d)
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
