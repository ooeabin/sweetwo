import { formatManWon, formatYm, thisMonth, ymToDate, type YearMonth } from '@sweetwo/core';
import { AmountInput, QuestionLayout, ShortText, YearMonthInput } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { copy } from '../copy';
import { useGoalsData } from '../data';
import { useGoalChange } from '../goal-change';

type Field = 'amount' | 'deadline' | 'name';

// 목표 수정(22 목표 수정): 숫자 한 화면 입력. 목표 금액 Q3, 기한 Q4(늘리기·줄이기 모두, 이번 달 이전만 안 됨), 이름 Q5.
// 영향 미리보기(예상 달성, 상태, 월 필요액 전 → 후. 매달 넣는 돈은 그대로라 이 목표만 바뀜).
// ‘저장’ = 바로 반영 + Toast “기한을 바꿨어요” + ‘되돌리기’. 우리 목표면 상대 알림·활동 기록(서버). 저장 → G-02
export function G02GoalEdit() {
  const { id = '', field = 'amount' } = useParams();
  const nav = useNavigate();
  const d = useGoalsData();
  const change = useGoalChange(d);
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [ym, setYm] = useState<YearMonth | null | undefined>(undefined);
  const [name, setName] = useState<string | undefined>(undefined);
  const back = () => nav(`/goals/${id}`);

  if (d.loading) return null;
  const g = d.goals.find((x) => x.id === id);
  const f = field as Field;
  if (!g || !['amount', 'deadline', 'name'].includes(f)) return <Navigate to="/goals" replace />;
  // 내 목표는 주인만(22 ‘목표 종류’)
  if (g.owner_user_id && g.owner_user_id !== d.me?.id)
    return <Navigate to={`/goals/${id}`} replace />;

  const curAmount = amount === undefined ? g.target_amount : amount;
  const curYm =
    ym === undefined ? ((g.deadline?.slice(0, 7) as YearMonth | undefined) ?? null) : ym;
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

  // 영향 미리보기: 이 목표만
  const before = d.view?.lines.find((l) => l.id === id);
  const after = f === 'name' ? null : d.viewWith(id, patch)?.lines.find((l) => l.id === id);
  const man = (v: number) => `${formatManWon(v)} 원`;
  const impact: string[] = [];
  if (before && after && changed) {
    const ex = (v: YearMonth | null) => (v ? formatYm(v) : copy.planUnknown);
    if (before.expected !== after.expected)
      impact.push(copy.impactExpected(ex(before.expected), ex(after.expected)));
    if (before.status !== after.status && before.status && after.status)
      impact.push(copy.impactStatus(copy.status[before.status], copy.status[after.status]));
    if (before.need !== after.need && before.need !== null && after.need !== null)
      impact.push(copy.impactNeed(formatManWon(before.need), man(after.need)));
  }

  const submit = async () => {
    if (!changed || err) return back();
    const ok = await change.send(
      g,
      f === 'amount'
        ? { item: 'goal_amount', value: curAmount ?? 0 }
        : f === 'deadline'
          ? { item: 'goal_deadline', value: ymToDate(curYm as YearMonth) }
          : { item: 'goal_name', value: curName.trim() },
    );
    if (ok) back();
  };

  const title =
    f === 'amount'
      ? copy.editAmount
      : f === 'name'
        ? copy.editName
        : g.kind === 'yearly'
          ? copy.editYearly
          : copy.editDeadline;

  return (
    <QuestionLayout
      title={title}
      onBack={back}
      primary={{
        label: copy.save,
        disabled:
          !!err ||
          (f === 'amount' && !curAmount) ||
          (f === 'deadline' && !curYm) ||
          (f === 'name' && !curName.trim()),
        loading: change.busy,
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
