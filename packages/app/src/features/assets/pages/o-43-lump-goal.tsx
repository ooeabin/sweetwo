import { qk, updateAsset } from '@sweetwo/api';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { LUMP, useWeek, weekPath } from '../week/week';

// O-43 목돈 넣을 목표(Q1): ‘결혼 후 남은 목돈’ 자산을 고른 목표에 연결(목표 보유액에 들어감).
// 목표 목록 / 아직 정하지 않았어요. 비상금 → 주거 순으로 ‘추천’ 하나.
export function O43LumpGoal() {
  const w = useWeek('assets');
  const qc = useQueryClient();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lump = w.itemOf(LUMP);
  if (!lump?.id) return <Navigate to={weekPath.assets} replace />;
  if (w.d.loading) return null;
  const goals = w.d.goals.filter((g) => !['paused', 'achieved', 'used'].includes(g.status));
  const recommend =
    goals.find((g) => g.template === 'emergency') ?? goals.find((g) => g.template === 'home');
  const total = 2 + w.draft.picks.length;

  const pick = async (g: string) => {
    if (saving || !lump.id) return;
    setSaving(true);
    try {
      if (g !== 'none') {
        await updateAsset(lump.id, { goal_id: g });
        await qc.invalidateQueries({ queryKey: qk.goalAssetSums });
      }
      await w.finish();
      toast(copy.weekAssetsDone);
      w.nav('/', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      steps={{ total, now: total - 1 }}
      title={copy.weekLumpGoal}
      onBack={() => w.nav(weekPath.asset(w.draft.picks.length))}
      later={{ label: copy.weekClose, onClick: w.close }}
    >
      <ChoiceCards<string>
        label={copy.weekLumpGoal}
        value={value}
        onChange={setValue}
        onPick={(g) => void pick(g)}
        options={[
          ...goals.map((g) => ({
            value: g.id,
            label: g.name,
            tag: g.id === recommend?.id ? copy.weekRecommend : undefined,
          })),
          { value: 'none', label: copy.weekLumpNone },
        ]}
      />
    </QuestionLayout>
  );
}
