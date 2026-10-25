import { saveSplit, updateGoal } from '@sweetwo/api';
import {
  addMonths,
  leftover,
  readWon,
  thisMonth,
  ymToDate,
  type SplitLineDraft,
} from '@sweetwo/core';
import { AmountInput, Button, List, ListRow, QuestionLayout, SectionHeader, ShortText } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { useSplits } from '../data';
import { emergencyGoalTarget, recommendedDraft } from '../split-draft';
import { useStep } from '../step';

const MAX_CUSTOM = 10;
// 직접 추가 줄 이름(최대 20자)
const NAME_MAX = 20;

type Edit = { index: number } | { add: true } | null;

// O-50 월급 분배표(17 온보딩 ②). 추천값이 채워진 목록을 고쳐서 확정. 줄을 누르면 금액(Q3), ‘+ 줄 추가’는 이름 + 금액.
// 남는 돈 = 수입 − 모든 줄, 음수면 “{n}이 모자라요”(막지 않음). 저장하면 비상금 목표 금액 = (고정지출 + 생활비) × 3, 기한 1년 뒤.
export function O50Split() {
  const s = useStep('o-50');
  const splits = useSplits();
  const [draft, setDraft] = useState<SplitLineDraft[] | null>(null);
  const [edit, setEdit] = useState<Edit>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  if (!s.ready || splits.isLoading) return null;
  const me = s.state.me;
  const goals = s.state.goals ?? [];
  if (!me) return null;

  const mine = splits.data?.find((x) => x.owner_user_id === me.id || x.owner_user_id === null);
  const saved: SplitLineDraft[] | null = mine?.split_line.length
    ? mine.split_line.map((l) => ({
        kind: l.kind,
        amount: l.amount,
        goalId: l.goal_id ?? undefined,
        userId: l.user_id ?? undefined,
        name: l.name ?? undefined,
      }))
    : null;
  const lines = draft ?? saved ?? recommendedDraft(me, goals);
  const income = me.monthly_income ?? 0;
  const left = leftover(income, lines);
  const goalName = (id?: string) => goals.find((g) => g.id === id)?.name ?? '';
  const nameOf = (l: SplitLineDraft) =>
    l.kind === 'saving'
      ? goalName(l.goalId)
      : l.kind === 'custom'
        ? (l.name ?? '')
        : copy.lineNames[l.kind];
  const payday = me.payday_last ? copy.paydayLast : me.payday ? `${me.payday}일` : '';

  const save = () =>
    s.done(async () => {
      await saveSplit(lines, s.state.space?.salary_mode === 'joint' ? undefined : me.id);
      const emergency = goals.find((g) => g.template === 'emergency');
      if (emergency) {
        await updateGoal(emergency.id, {
          target_amount: emergencyGoalTarget(lines),
          amount_estimated: false,
          deadline: ymToDate(addMonths(thisMonth(), 12)),
          deadline_estimated: false,
        });
      }
      await splits.refetch();
    });

  // 금액 고치기, 줄 추가(Q3 + Q5)
  if (edit) {
    const isAdd = 'add' in edit;
    const line = isAdd ? undefined : lines[edit.index];
    const title = isAdd ? copy.addLine.replace('+ ', '') : copy.lineAmount(line ? nameOf(line) : '');
    const v = amount ?? line?.amount ?? null;
    const valid = v !== null && v % 10_000 === 0 && (!isAdd || name.trim().length > 0);
    const close = () => {
      setEdit(null);
      setAmount(null);
      setName('');
    };
    return (
      <QuestionLayout
        chapter={s.chapter}
        title={title}
        onBack={close}
        primary={{ label: copy.next, disabled: !valid }}
        onSubmit={() => {
          if (v === null) return;
          setDraft(
            isAdd
              ? [...lines, { kind: 'custom', name: name.trim(), amount: v }]
              : lines.map((l, i) => (i === edit.index ? { ...l, amount: v } : l)),
          );
          close();
        }}
      >
        {isAdd && (
          <ShortText
            label={copy.newLineName}
            value={name}
            onChange={setName}
            max={NAME_MAX}
            placeholder={copy.newLinePlaceholder}
          />
        )}
        <AmountInput
          label={title}
          value={v}
          onChange={setAmount}
          monthly
          allowZero
        />
        {v !== null && v % 10_000 !== 0 && <p className="hg-help">{copy.tenThousandUnit}</p>}
        {!isAdd && line?.kind === 'custom' && (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(lines.filter((_, i) => i !== edit.index));
              close();
            }}
          >
            {copy.removeLine}
          </Button>
        )}
      </QuestionLayout>
    );
  }

  const row = (l: SplitLineDraft, i: number) => {
    const need = l.kind === 'saving' ? l.need : undefined;
    const sub =
      l.kind === 'fixed'
        ? copy.fixedSub
        : l.kind === 'living'
          ? copy.livingSub
          : need
            ? copy.needPerMonth(readWon(need))
            : undefined;
    return (
      <ListRow
        key={`${l.kind}-${l.goalId ?? l.userId ?? l.name ?? i}`}
        label={nameOf(l)}
        sub={sub}
        value={readWon(l.amount)}
        onClick={() => setEdit({ index: i })}
      />
    );
  };
  const indexed = lines.map((l, i) => ({ l, i }));
  const customs = lines.filter((l) => l.kind === 'custom').length;
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.splitTitle}
      help={copy.splitTableHelp}
      onBack={s.onBack}
      primary={{ label: copy.splitDone, loading: s.saving }}
      onSubmit={() => void save()}
    >
      <List>
        <ListRow label={copy.splitIncome(readWon(income))} value={payday} chevron={false} />
      </List>
      <SectionHeader title={copy.savingGroup} />
      <List label={copy.savingGroup}>
        {indexed.filter(({ l }) => l.kind === 'saving').map(({ l, i }) => row(l, i))}
      </List>
      <SectionHeader title={copy.spendGroup} />
      <List label={copy.spendGroup}>
        {indexed.filter(({ l }) => l.kind !== 'saving').map(({ l, i }) => row(l, i))}
      </List>
      {customs < MAX_CUSTOM && (
        <Button
          variant="ghost"
          onClick={() => {
            setEdit({ add: true });
            setAmount(0);
          }}
        >
          {copy.addLine}
        </Button>
      )}
      <div className="hg-stack" style={{ gap: 'var(--space-1)' }} aria-live="polite">
        <b>{left >= 0 ? copy.leftover(readWon(left)) : copy.short(readWon(-left))}</b>
        {left < 0 && <span className="hg-help">{copy.shortHelp}</span>}
      </div>
    </QuestionLayout>
  );
}
