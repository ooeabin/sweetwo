import { qk, saveSplit, updateGoal } from '@sweetwo/api';
import { QuestionLayout, ReorderList, SectionHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { toDraft, useSplits } from '../../salary';
import { copy } from '../copy';
import { useGoalsModel } from '../model';

// G-06 우선순위 바꾸기(22): 끌기, ↑↓, 비상금 맨 위 고정. 묶음(우리 목표 / 내 목표)마다 따로, 묶음을 넘어 옮기지 않음.
// 저장 = 바로 반영 + 내 분배표 저금 줄 순서도 같이 + Toast ‘되돌리기’. 상대 분배표 줄 순서·상대 알림은 부부 단계에서.
export function G06GoalOrder({ week = false }: { week?: boolean }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const splits = useSplits();
  const [ours, setOurs] = useState<string[] | null>(null);
  const [mine, setMine] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  if (!d.ready || !splits.data) return null;
  void week;

  const movable = (list: typeof d.groups.ours) =>
    list.filter((i) => i.goal.template !== 'emergency');
  const oursIds = ours ?? movable(d.groups.ours).map((i) => i.goal.id);
  const mineIds = mine ?? d.groups.mine.map((i) => i.goal.id);
  const all = [...movable(d.groups.ours), ...d.groups.mine];
  const name = (id: string) => all.find((i) => i.goal.id === id)?.goal.name ?? '';
  const changed = ours !== null || mine !== null;
  const labels = {
    up: copy.orderUp,
    down: copy.orderDown,
    moved: copy.orderMoved,
    handle: copy.orderHandle,
  };

  const apply = async (o: string[], m: string[]) => {
    const prio = new Map([
      ...o.map((id, i) => [id, i + 1] as const),
      ...m.map((id, i) => [id, i + 1] as const),
    ]);
    await Promise.all([...prio].map(([id, p]) => updateGoal(id, { priority: p })));
    // 분배표 저금 줄 순서: 비상금 → 우리 목표 → 내 목표. 합쳐서면 공동 하나, 각자면 두 사람 분배표 모두(22 G-06)
    const targets = splits.data.filter((s) =>
      d.joint ? s.owner_user_id === null : s.owner_user_id !== null,
    );
    for (const split of targets) {
      const lines = toDraft(split.split_line);
      const rank = (gid?: string) => {
        const g = d.byId(gid ?? '')?.goal;
        if (!g) return 0;
        if (g.template === 'emergency') return 0;
        return (g.owner_user_id === null ? 1000 : 2000) + (prio.get(g.id) ?? g.priority);
      };
      const saving = lines
        .filter((l) => l.kind === 'saving')
        .sort((a, b) => rank(a.goalId) - rank(b.goalId));
      const next = [...saving, ...lines.filter((l) => l.kind !== 'saving')];
      if (next.every((l, i) => l === lines[i])) continue;
      await saveSplit(next, split.owner_user_id ?? undefined);
    }
    await Promise.all([qk.goals, qk.splits].map((k) => qc.invalidateQueries({ queryKey: k })));
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const before = [
      movable(d.groups.ours).map((i) => i.goal.id),
      d.groups.mine.map((i) => i.goal.id),
    ] as const;
    try {
      await apply(oursIds, mineIds);
      toast(copy.orderSaved, { label: copy.undo, onClick: () => void apply(before[0], before[1]) });
      nav('/goals');
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  const list = (ids: string[], set: (x: string[]) => void, title: string) =>
    ids.length > 0 && (
      <section className="hg-stack" aria-label={title}>
        {!d.solo && <SectionHeader title={title} />}
        <ReorderList
          label={title}
          items={ids.map((id) => ({ id, label: name(id) }))}
          onChange={set}
          labels={labels}
        />
      </section>
    );
  return (
    <QuestionLayout
      title={copy.orderTitle}
      help={copy.orderFixed}
      onBack={() => nav('/goals')}
      primary={{ label: copy.orderOk, disabled: !changed, loading: saving }}
      onSubmit={() => void save()}
    >
      {list(oursIds, setOurs, copy.groups.ours)}
      {list(mineIds, setMine, copy.groups.mine)}
    </QuestionLayout>
  );
}
