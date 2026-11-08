import type { Goal } from '@sweetwo/api';
import { dateToYm, leftover, readWon, savingNeed, type SplitLineDraft } from '@sweetwo/core';
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
import { goalLineName } from './check-line';

const MAX_CUSTOM = 10;
const NAME_MAX = 20; // 직접 추가 줄 이름

type Edit = { index: number } | { add: true } | null;

/**
 * 월급 계획 목록(O-50, W-01 같은 틀, 20 W-01·17 O-50). 수입 줄 → 저금 묶음(+ 저금 항목 추가) → 쓰는 돈 묶음 → ‘+ 줄 추가’,
 * 주 버튼 위에 남는 돈(음수면 “{n}이 모자라요”, 막지 않음). 줄을 누르면 같은 틀이 금액 입력(Q3)으로 바뀜.
 * 저금 줄 금액 입력 아래 ‘저금 항목 보기’ → W-10(onItem). 저금 줄 보조 글 = 진행 “120만 / 500만 원” + 월 필요액(기한이 있을 때)
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
  steps,
  noteOf,
  incomeSub,
  onIncome,
  notice,
  readOnly,
  savedOf,
  onItem,
  onAddItem,
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
  /** 고칠 수 없는 줄(파트너 내 목표 줄) */
  locked?: (l: SplitLineDraft) => boolean;
  /** 칸 막대(합류 P-06 5칸 등) */
  steps?: { total: number; now: number; fill?: number };
  /** 줄 오른쪽 회색 글(있으면 기본 보조 글 대신, 합류 P-06 “찬우님이 매달 95만 원 넣어요”, “95만 원 → 250만 원”) */
  noteOf?: (l: SplitLineDraft) => string | undefined;
  /** 수입 줄 아래 회색 글(합쳐서 “찬우 350만 원, 예빈 270만 원”) */
  incomeSub?: string;
  /** 수입 줄을 누르면(W-01 2번 → 설정 내 월급 S-11) */
  onIncome?: () => void;
  /** 목록 위 안내 한 줄(해제 대기 등) */
  notice?: ReactNode;
  /** 모든 줄 고치기 막음(연결 해제 대기, 20 예외) */
  readOnly?: boolean;
  /** 저금 항목 모은 돈(진행·월 필요액) */
  savedOf?: (goalId: string) => number;
  /** 저금 줄 금액 입력 아래 ‘저금 항목 보기’(W-10) */
  onItem?: (goalId: string) => void;
  /** 저금 묶음 아래 ‘+ 저금 항목 추가’(W-11a, W-01 3a) */
  onAddItem?: () => void;
}) {
  const [edit, setEdit] = useState<Edit>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const left = leftover(income, lines);
  const goalOf = (id?: string) => goals.find((g) => g.id === id);
  const goalName = goalLineName(goals, (id) => personName(id ?? undefined), joint);
  const nameOf = (l: SplitLineDraft) =>
    l.kind === 'saving'
      ? goalName(l.goalId)
      : l.kind === 'custom'
        ? (l.name ?? '')
        : l.kind === 'allowance' && joint
          ? `${personName(l.userId)} ${copy.lineNames.allowance}`
          : copy.lineNames[l.kind];
  /** 저금 줄 보조 글: 목표 금액이 있으면 “120만 / 500만 원”, 기한도 있으면 + “매달 250만 원이 필요해요”(06 5-2) */
  const savingSub = (l: SplitLineDraft) => {
    const g = goalOf(l.goalId);
    if (!g || g.target_amount === null) return undefined;
    const saved = l.goalId ? (savedOf?.(l.goalId) ?? 0) : 0;
    const need = savingNeed({
      target: g.target_amount,
      saved,
      deadline: g.deadline ? dateToYm(g.deadline) : null,
    });
    const progress = copy.itemProgress(readWon(saved), readWon(g.target_amount));
    return need ? `${progress}, ${copy.needPerMonth(readWon(need))}` : progress;
  };
  const paydayText = payday === 'last' ? copy.paydayLast : payday ? copy.payday(payday) : '';

  if (edit) {
    const isAdd = 'add' in edit;
    const line = isAdd ? undefined : lines[edit.index];
    const head = isAdd ? copy.addLineTitle : copy.lineAmount(line ? nameOf(line) : '');
    const v = amount ?? line?.amount ?? null;
    const renaming = !isAdd && line?.kind === 'custom';
    const newName = isAdd || renaming ? name : '';
    const valid =
      v !== null && v % 10_000 === 0 && (!(isAdd || renaming) || newName.trim().length > 0);
    const close = () => {
      setEdit(null);
      setAmount(null);
      setName('');
    };
    return (
      <QuestionLayout
        chapter={progress}
        steps={steps}
        title={head}
        onBack={close}
        primary={{ label: copy.ok, disabled: !valid }}
        onSubmit={() => {
          if (v === null) return;
          onChange(
            isAdd
              ? [...lines, { kind: 'custom', name: name.trim(), amount: v }]
              : lines.map((l, i) =>
                  i === edit.index
                    ? { ...l, amount: v, ...(renaming ? { name: newName.trim() } : {}) }
                    : l,
                ),
          );
          close();
        }}
      >
        {(isAdd || renaming) && (
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
        {!isAdd && line?.kind === 'saving' && line.goalId && onItem && (
          <Button variant="ghost" onClick={() => onItem(line.goalId ?? '')}>
            {copy.seeItem}
          </Button>
        )}
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
    const sub =
      l.kind === 'fixed'
        ? copy.fixedSub
        : l.kind === 'living'
          ? copy.livingSub
          : l.kind === 'saving'
            ? savingSub(l)
            : undefined;
    const fixed = readOnly || locked?.(l);
    return (
      <ListRow
        key={`${l.kind}-${l.goalId ?? l.userId ?? l.name ?? i}`}
        label={nameOf(l)}
        sub={noteOf?.(l) ?? sub}
        value={readWon(l.amount)}
        onClick={
          fixed
            ? undefined
            : () => {
                setEdit({ index: i });
                if (l.kind === 'custom') setName(l.name ?? '');
              }
        }
      />
    );
  };
  const indexed = lines.map((l, i) => ({ l, i }));
  const customs = lines.filter((l) => l.kind === 'custom').length;
  return (
    <QuestionLayout
      chapter={progress}
      steps={steps}
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
      {notice}
      <List>
        <ListRow
          label={copy.splitIncome(readWon(income))}
          sub={incomeSub}
          value={paydayText}
          chevron={!!onIncome}
          onClick={onIncome}
        />
      </List>
      <SectionHeader title={copy.savingGroup} />
      <List label={copy.savingGroup}>
        {indexed.filter(({ l }) => l.kind === 'saving').map(({ l, i }) => row(l, i))}
        {!readOnly && onAddItem && (
          <ListRow
            icon="plus"
            label={copy.addItem.replace(/^\+\s*/, '')}
            chevron={false}
            onClick={onAddItem}
          />
        )}
      </List>
      <SectionHeader title={copy.spendGroup} />
      <List label={copy.spendGroup}>
        {indexed.filter(({ l }) => l.kind !== 'saving').map(({ l, i }) => row(l, i))}
        {/* 줄 추가는 쓰는 돈 묶음 맨 아래 한 줄(+ 아이콘이 글자 앞 ‘+’를 대신) */}
        {!readOnly && customs < MAX_CUSTOM && (
          <ListRow
            icon="plus"
            label={copy.addLine.replace(/^\+\s*/, '')}
            chevron={false}
            onClick={() => {
              setEdit({ add: true });
              setAmount(0);
            }}
          />
        )}
      </List>
      {extra}
    </QuestionLayout>
  );
}

/** 저장된 월급 계획 줄 → 초안 */
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
