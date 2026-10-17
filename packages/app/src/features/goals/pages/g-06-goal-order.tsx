import { propose, qk, updateGoal, type Goal } from '@sweetwo/api';
import { formatManWon, formatMonthDay, orderableGoals, proposalApplyOn } from '@sweetwo/core';
import { QuestionLayout, ReorderList } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { useGoalsData } from '../data';

const man = (v: number) => `${formatManWon(v)} 원`;

// G-06 우선순위 바꾸기(O-22 화면): 끌기, ↑↓, 비상금 맨 위 고정. 아래에 바뀌는 배분 미리보기.
// 연결된 부부 = goal_order 제안, 아니면 바로 저장 + Toast “순서를 바꿨어요” + ‘되돌리기’.
// 보류·달성·사용 완료 목표는 배분에 없어 목록에서 뺌.
// week = 첫 주 5일째 O-22(비상금·결혼 비용 빼고, 2개 이상일 때만): 저장 뒤 남은 목표의 O-23~25로, 순서가 그대로면 그냥 다음
export function G06GoalOrder({ week = false }: { week?: boolean }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const [order, setOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  if (d.loading || !d.view) return null;

  const movable = week
    ? orderableGoals(d.goals)
    : d.goals
        .filter(
          (g) => g.template !== 'emergency' && !['paused', 'achieved', 'used'].includes(g.status),
        )
        .sort((a, b) => a.priority - b.priority);
  const done = week ? '/goals/week/next' : '/goals';
  if (week && movable.length < 2) return <Navigate to={done} replace />;
  const ids = order ?? movable.map((g) => g.id);
  const reordered = (list: Goal[]) =>
    list.map((g) => (ids.includes(g.id) ? { ...g, priority: ids.indexOf(g.id) + 1 } : g));
  const after = d.viewOf(reordered(d.goals));
  const changed = ids.some((id, i) => movable[i]?.id !== id);
  const preview = (after?.lines ?? []).flatMap((l) => {
    const b = d.view?.lines.find((x) => x.id === l.id);
    return b && b.alloc !== l.alloc
      ? [copy.impactAlloc(l.name, formatManWon(b.alloc), man(l.alloc))]
      : [];
  });
  const lineOf = (id: string) => d.view?.lines.find((l) => l.id === id);

  const save = async () => {
    if (!changed) return nav(done);
    if (saving) return;
    setSaving(true);
    try {
      if (d.connected && d.base !== null) {
        await propose('goal_order', { order: ids }, proposalApplyOn(d.base));
        toast(copy.proposed(d.couple?.partnerName ?? ''));
      } else {
        const before = movable.map((g) => ({ id: g.id, priority: g.priority }));
        await Promise.all(ids.map((id, i) => updateGoal(id, { priority: i + 1 })));
        toast(copy.orderSaved, {
          label: copy.undo,
          onClick: () =>
            void Promise.all(before.map((b) => updateGoal(b.id, { priority: b.priority }))).then(
              () => qc.invalidateQueries({ queryKey: qk.goals }),
            ),
        });
      }
      await Promise.all([qk.goals, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })));
      nav(done);
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.orderTitle}
      help={
        d.connected && changed && d.base !== null
          ? proposalCopy.applyNote(formatMonthDay(proposalApplyOn(d.base)))
          : undefined
      }
      onBack={() => nav(week ? '/' : '/goals')}
      later={week ? { label: copy.weekClose, onClick: () => nav('/') } : undefined}
      primary={{
        label:
          d.connected && (!week || changed)
            ? copy.proposeTo(d.couple?.partnerName ?? '')
            : copy.orderOk,
        disabled: !week && d.connected && !changed,
        loading: saving,
      }}
      onSubmit={() => void save()}
    >
      <p className="hg-help" style={{ margin: 0 }}>
        {copy.orderFixed}
      </p>
      <ReorderList
        label={copy.orderTitle}
        items={ids.map((id) => {
          const g = movable.find((x) => x.id === id);
          const l = lineOf(id);
          return { id, label: g?.name ?? '', sub: l ? man(l.alloc) : undefined };
        })}
        onChange={setOrder}
        labels={{
          up: copy.orderUp,
          down: copy.orderDown,
          moved: copy.orderMoved,
          handle: copy.orderHandle,
        }}
      />
      {preview.length > 0 && (
        <section className="hg-card hg-stack" aria-live="polite" aria-label={copy.orderPreview}>
          <span className="hg-card__label">{copy.orderPreview}</span>
          {preview.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </section>
      )}
    </QuestionLayout>
  );
}
