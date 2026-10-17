import { adjustPlan } from '@sweetwo/api';
import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { useMonthView } from '../../month';
import { copy } from '../copy';

type Role = 'living' | 'goal_fund' | 'emergency';
const ROLES: Role[] = ['living', 'goal_fund', 'emergency'];

// W-01a 이번 달만 바꾸기(Q3 + 미리보기): 통장 줄 하나의 이번 달 금액. 차이는 빠지는 곳(목표자금, 목표자금을 바꾸면 공동 생활비)이 받고
// 바로 아래 미리보기. 제안 아님: 즉시 적용 + 토스트 ‘되돌리기’(06 1장). 기본 배분은 F-05·목표에서
export function W01aAdjust() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const param = useParams().role;
  const role = ROLES.find((r) => r === param);
  const v = useMonthView();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  if (!v) return null;
  if (!role || !v.planId || !v.adjust.can(role)) return <Navigate to="/plan" replace />;
  const counter = v.adjust.counterOf(role) as Role;
  const amountOf = (r: Role) =>
    r === 'living' ? v.parts.living : r === 'goal_fund' ? v.parts.goalFund : v.parts.emergency;
  const before = amountOf(role);
  const cBefore = amountOf(counter);
  const amount = value === undefined ? before : value;
  const cAfter = amount === null ? cBefore : cBefore - (amount - before);
  const name = copy.roles[role] ?? role;
  const cName = copy.roles[counter] ?? counter;
  const planId = v.planId;

  const refresh = () => qc.invalidateQueries({ queryKey: ['monthly_plan'] });
  const save = async () => {
    if (saving || amount === null || cAfter < 0 || amount === before) return;
    setSaving(true);
    try {
      await adjustPlan(planId, role, amount, counter);
      await refresh();
      toast(copy.adjusted, {
        label: copy.undo,
        onClick: () => void adjustPlan(planId, role, before, counter).then(refresh),
      });
      nav('/plan', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuestionLayout
      title={copy.editTitle(name)}
      help={copy.editHelp}
      onBack={() => nav('/plan')}
      primary={{
        label: copy.editSave,
        disabled: amount === null || cAfter < 0 || amount === before,
        loading: saving,
      }}
      onSubmit={() => void save()}
    >
      <AmountInput
        label={copy.editTitle(name)}
        value={amount}
        onChange={setValue}
        quick={quickChips.small}
        allowZero
      />
      <p className="hg-q__help" aria-live="polite" style={{ margin: 0 }}>
        {cAfter < 0 ? copy.editTooMuch(cName) : copy.editFrom(cName, m(cBefore), m(cAfter))}
      </p>
    </QuestionLayout>
  );
}
