import type { Goal } from '@sweetwo/api';
import { emergencyMonthly, goalNeed, leftover, readWon, type SplitLineDraft } from '@sweetwo/core';
import {
  AmountInput,
  Button,
  List,
  ListRow,
  QuestionLayout,
  SectionHeader,
  ShortText,
  type ChapterProgress,
} from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { copy } from './copy';
import { toAllocGoal } from './split-draft';

const MAX_CUSTOM = 10;
const NAME_MAX = 20; // 직접 추가 줄 이름

type Edit = { index: number } | { add: true } | null;

/**
 * 월급 분배표 목록(O-50, W-01 같은 틀, 20 W-01·17 O-50). 수입 줄 → 저금 묶음 → 쓰는 돈 묶음 → ‘+ 줄 추가’,
 * 주 버튼 위에 남는 돈(음수면 “{n}이 모자라요”, 막지 않음). 줄을 누르면 같은 틀이 금액 입력(Q3)으로 바뀜.
 */
export function SplitEditor({
  lines,
  onChange,
  income,
  payday,
  goals,
  personName,
  joint,
  title,
  help,
  primaryLabel,
  primaryDisabled,
  saving,
  progress,
  onBack,
  onSave,
  extra,
  locked,
}: {
  lines: SplitLineDraft[];
  onChange: (lines: SplitLineDraft[]) => void;
  income: number;
  payday: number | 'last' | null;
  goals: Goal[];
  personName: (id: string | undefined) => string;
  joint: boolean;
  title: string;
  help?: string;
  primaryLabel: string;
  /** 바뀐 게 없으면 비활성(W-01) */
  primaryDisabled?: boolean;
  saving?: boolean;
  progress?: ChapterProgress;
  onBack?: () => void;
  onSave: () => void;
  /** 목록 아래 글자 링크(W-01 ‘추천값으로 다시 채우기’) */
  extra?: ReactNode;
  /** 고칠 수 없는 줄(배우자 내 목표 줄) */
  locked?: (l: SplitLineDraft) => boolean;
}) {
  const [edit, setEdit] = useState<Edit>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const left = leftover(income, lines);
  const sum = (k: SplitLineDraft['kind']) =>
    lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const goalOf = (id?: string) => goals.find((g) => g.id === id);
  const nameOf = (l: SplitLineDraft) =>
    l.kind === 'saving'
      ? (goalOf(l.goalId)?.name ?? '')
      : l.kind === 'custom'
        ? (l.name ?? '')
        : l.kind === 'allowance' && joint
          ? `${personName(l.userId)} ${copy.lineNames.allowance}`
          : copy.lineNames[l.kind];
  /** 저금 줄 오른쪽 회색 “매달 {n}이 필요해요”(금액이 정해진 목표만, 비상금은 (고정 + 생활) × 3 ÷ 12) */
  const needOf = (l: SplitLineDraft) => {
    const g = goalOf(l.goalId);
    if (!g) return null;
    if (g.template === 'emergency') return emergencyMonthly(sum('fixed'), sum('living')) || null;
    return goalNeed(toAllocGoal(g));
  };
  const paydayText = payday === 'last' ? copy.paydayLast : payday ? copy.payday(payday) : '';

  if (edit) {
    const isAdd = 'add' in edit;
    const line = isAdd ? undefined : lines[edit.index];
    const head = isAdd ? copy.addLineTitle : copy.lineAmount(line ? nameOf(line) : '');
    const v = amount ?? line?.amount ?? null;
    const valid = v !== null && v % 10_000 === 0 && (!isAdd || name.trim().length > 0);
    const close = () => {
      setEdit(null);
      setAmount(null);
      setName('');
    };
    return (
      <QuestionLayout
        chapter={progress}
        title={head}
        onBack={close}
        primary={{ label: copy.next, disabled: !valid }}
        onSubmit={() => {
          if (v === null) return;
          onChange(
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
        <AmountInput label={head} value={v} onChange={setAmount} monthly allowZero />
        {v !== null && v % 10_000 !== 0 && <p className="hg-help">{copy.tenThousandUnit}</p>}
        {!isAdd && line?.kind === 'custom' && (
          <Button
            variant="ghost"
            onClick={() => {
              onChange(lines.filter((_, i) => i !== edit.index));
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
    const need = l.kind === 'saving' ? needOf(l) : null;
    const sub =
      l.kind === 'fixed'
        ? copy.fixedSub
        : l.kind === 'living'
          ? copy.livingSub
          : need
            ? copy.needPerMonth(readWon(need))
            : undefined;
    const fixed = locked?.(l);
    return (
      <ListRow
        key={`${l.kind}-${l.goalId ?? l.userId ?? l.name ?? i}`}
        label={nameOf(l)}
        sub={sub}
        value={readWon(l.amount)}
        onClick={fixed ? undefined : () => setEdit({ index: i })}
      />
    );
  };
  const indexed = lines.map((l, i) => ({ l, i }));
  const customs = lines.filter((l) => l.kind === 'custom').length;
  return (
    <QuestionLayout
      chapter={progress}
      title={title}
      help={help}
      onBack={onBack}
      primary={{ label: primaryLabel, loading: saving, disabled: primaryDisabled }}
      onSubmit={onSave}
      summary={
        <>
          <span>{left >= 0 ? copy.leftover(readWon(left)) : copy.short(readWon(-left))}</span>
          {left < 0 && <span className="hg-help">{copy.shortHelp}</span>}
        </>
      }
    >
      <List>
        <ListRow label={copy.splitIncome(readWon(income))} value={paydayText} chevron={false} />
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
      {extra}
    </QuestionLayout>
  );
}

/** 저장된 분배표 줄 → 초안 */
export const toDraft = (
  rows: {
    kind: SplitLineDraft['kind'];
    amount: number;
    goal_id: string | null;
    user_id: string | null;
    name: string | null;
  }[],
): SplitLineDraft[] =>
  rows.map((l) => ({
    kind: l.kind,
    amount: l.amount,
    goalId: l.goal_id ?? undefined,
    userId: l.user_id ?? undefined,
    name: l.name ?? undefined,
  }));
