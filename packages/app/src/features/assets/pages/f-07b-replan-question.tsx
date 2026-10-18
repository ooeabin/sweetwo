import { quickChips } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { replanPath, useReplan } from '../replan/draft';
import { replanQuestions } from './f-07a-replan';

type Q = 'income' | 'fixed' | 'living';

// F-07b 바뀐 부분의 온보딩 질문(지금 값 채움): 이직·수입 변화 → 내 수입(O-31), 이사 → 고정지출(O-36), 출산 → 생활비(O-37).
export function F07bReplanQuestion() {
  const { q = 'income' } = useParams();
  const nav = useNavigate();
  const d = useAssetsData();
  const r = useReplan();
  if (d.loading || !d.me || !d.space || !d.couple) return null;
  const k = q as Q;
  const qs = replanQuestions(r.kinds);
  const i = qs.indexOf(k);
  if (i < 0) return <Navigate to={replanPath.start} replace />;
  const now: Record<Q, number | null> = {
    income: d.me.monthly_income,
    fixed: d.space.fixed_total,
    living: d.space.living_budget,
  };
  const title: Record<Q, string> = {
    income: copy.replanIncome(d.couple.myName),
    fixed: copy.replanFixed,
    living: copy.replanLiving,
  };
  const value = r[k] ?? now[k];
  const next = () => {
    if (r[k] === null) r.set({ [k]: now[k] });
    const n = qs[i + 1];
    nav(n ? replanPath.question(n) : replanPath.compare('general'));
  };
  return (
    <QuestionLayout
      title={title[k]}
      onBack={() => nav(i > 0 ? replanPath.question(qs[i - 1] ?? 'income') : replanPath.start)}
      primary={{ label: copy.next, disabled: value === null }}
      onSubmit={() => value !== null && next()}
    >
      <AmountInput
        label={title[k]}
        value={value}
        onChange={(v) => r.set({ [k]: v })}
        quick={quickChips.small}
        monthly
        allowZero={k !== 'income'}
      />
    </QuestionLayout>
  );
}
