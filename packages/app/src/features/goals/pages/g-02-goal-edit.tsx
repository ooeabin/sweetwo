import { qk, updateGoal } from '@sweetwo/api';
import {
  formatYm,
  formatManWon,
  formatMonthDay,
  proposalApplyOn,
  thisMonth,
  ymToDate,
  type YearMonth,
} from '@sweetwo/core';
import { AmountInput, QuestionLayout, ShortText, YearMonthInput } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { proposalCopy } from '../../proposals';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { useGoalChange } from '../goal-change';

type Field = 'amount' | 'deadline' | 'name';

// 목표 수정(22 목표 수정): 숫자 한 화면 입력. 목표 금액 Q3, 기한 Q4, 이름 Q5(바로 저장).
// 금액·기한은 영향 미리보기(월 배분, 상태, 예상 달성 전 → 후, 배분이 바뀌는 다른 목표) 뒤
// 연결된 부부는 “{배우자}님께 제안하기”(내 열린 제안은 그 값으로 채우고 새 제안이 대체), 아니면 “저장”.
// 바로 저장했는데 저축 가능 금액이 더 모자라지면 G-04.
export function G02GoalEdit() {
  const { id = '', field = 'amount' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsData();
  const change = useGoalChange(d);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [ym, setYm] = useState<YearMonth | null | undefined>(undefined);
  const [name, setName] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const back = () => nav(`/goals/${id}`);

  if (d.loading) return null;
  const g = d.goals.find((x) => x.id === id);
  const f = field as Field;
  if (!g || !['amount', 'deadline', 'name'].includes(f)) return <Navigate to="/goals" replace />;

  // 내 열린 제안 값으로 채움
  const mineOpen = d.openProposals.find(
    (p) =>
      p.target_id === id &&
      p.proposer === d.me?.id &&
      p.item === (f === 'amount' ? 'goal_amount' : 'goal_deadline'),
  );
  const sent = (k: string) => {
    const a = mineOpen?.after;
    return a && typeof a === 'object' && !Array.isArray(a) ? a[k] : undefined;
  };
  const sentAmount = sent('target_amount');
  const sentDeadline = sent('deadline');
  const curAmount =
    amount === undefined ? (typeof sentAmount === 'number' ? sentAmount : g.target_amount) : amount;
  const curYm =
    ym === undefined
      ? (((typeof sentDeadline === 'string' ? sentDeadline : g.deadline)?.slice(0, 7) as
          YearMonth | undefined) ?? null)
      : ym;
  const curName = name ?? g.name;

  const err =
    f === 'deadline' && curYm && curYm < thisMonth() ? copy.notBeforeThisMonth : undefined;
  const patch =
    f === 'amount'
      ? { target_amount: curAmount }
      : f === 'deadline' && curYm
        ? { deadline: ymToDate(curYm) }
        : {};
  const changed =
    f === 'amount'
      ? curAmount !== null && curAmount !== g.target_amount
      : f === 'deadline'
        ? !!curYm && ymToDate(curYm) !== g.deadline?.slice(0, 10)
        : !!curName.trim() && curName.trim() !== g.name;

  // 영향 미리보기
  const before = d.view?.lines.find((l) => l.id === id);
  const afterView = f === 'name' ? null : d.viewWith(id, patch);
  const after = afterView?.lines.find((l) => l.id === id);
  const man = (v: number) => `${formatManWon(v)} 원`;
  const impact: string[] = [];
  if (before && after && changed) {
    if (before.alloc !== after.alloc)
      impact.push(copy.impactAlloc(g.name, formatManWon(before.alloc), man(after.alloc)));
    if (before.status !== after.status && before.status && after.status)
      impact.push(copy.impactStatus(copy.status[before.status], copy.status[after.status]));
    const ex = (v: YearMonth | null) => (v ? formatYm(v) : copy.planUnknown);
    if (before.expected !== after.expected)
      impact.push(copy.impactExpected(ex(before.expected), ex(after.expected)));
    for (const o of afterView?.lines ?? []) {
      const b = d.view?.lines.find((l) => l.id === o.id);
      if (o.id === id || !b || b.alloc === o.alloc) continue;
      const diff = o.alloc - b.alloc;
      impact.push(copy.impactOther(o.name, `${diff > 0 ? '+' : '−'}${man(Math.abs(diff))}`));
    }
  }

  const propose = d.connected && f !== 'name';
  const submit = async () => {
    if (!changed || err) return back();
    if (f === 'name') {
      if (saving) return;
      setSaving(true);
      try {
        await updateGoal(g.id, { name: curName.trim() });
        await qc.invalidateQueries({ queryKey: qk.goals });
        toast(copy.saved);
        back();
      } catch {
        toast(copy.loadFailed);
      } finally {
        setSaving(false);
      }
      return;
    }
    const ok = await change.send(
      g,
      f === 'amount'
        ? { item: 'goal_amount', value: curAmount ?? 0 }
        : { item: 'goal_deadline', value: ymToDate(curYm as YearMonth) },
    );
    // 바로 바꿨는데 저축 가능 금액이 더 모자라지면 G-04
    if (ok)
      nav(
        !d.connected && (afterView?.shortfall ?? 0) > (d.view?.shortfall ?? 0)
          ? '/goals/adjust'
          : `/goals/${id}`,
      );
  };

  const title =
    f === 'amount'
      ? copy.editAmount
      : f === 'name'
        ? copy.editName
        : g.kind === 'yearly'
          ? copy.editYearly
          : copy.editDeadline;
  const help =
    propose && changed && d.base !== null
      ? proposalCopy.applyNote(formatMonthDay(proposalApplyOn(d.base)))
      : undefined;

  return (
    <QuestionLayout
      title={title}
      help={help}
      onBack={back}
      primary={{
        label: propose ? copy.proposeTo(d.couple?.partnerName ?? '') : copy.save,
        disabled:
          !!err ||
          (f === 'amount' && !curAmount) ||
          (f === 'deadline' && !curYm) ||
          (f === 'name' && !curName.trim()),
        loading: saving || change.busy,
      }}
      onSubmit={() => void submit()}
    >
      {f === 'amount' && <AmountInput label={title} value={curAmount} onChange={setAmount} />}
      {f === 'deadline' && (
        <YearMonthInput
          label={title}
          value={curYm}
          onChange={(v) => setYm((v as YearMonth | null) ?? null)}
          error={err}
        />
      )}
      {f === 'name' && (
        <ShortText
          label={title}
          value={curName}
          onChange={setName}
          max={20}
          error={curName.trim() ? undefined : copy.nameRequired}
        />
      )}
      {impact.length > 0 && (
        <section className="hg-card hg-stack" aria-live="polite" aria-label={copy.impact}>
          <span className="hg-card__label">{copy.impact}</span>
          {impact.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </section>
      )}
    </QuestionLayout>
  );
}
