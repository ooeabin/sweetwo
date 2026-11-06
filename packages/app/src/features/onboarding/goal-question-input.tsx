import {
  bands,
  quickChips,
  readWon,
  type AnnualItem,
  type Answers,
  type GoalQuestion,
  type GoalTemplate,
} from '@sweetwo/core';
import {
  AmountInput,
  ChoiceCards,
  emptyRow,
  ListInput,
  listReady,
  MonthChips,
  PercentSlider,
  ShortText,
  YearMonthInput,
  type ListRowValue,
} from '@sweetwo/ui';
import { copy } from './copy';

type Value = Answers[string];

/** 질문 하나의 지금 값(아직 안 고쳤으면 저장된 답, 비율은 처음 값) */
export const currentAnswer = (q: GoalQuestion, picked: Value, details: Answers): Value =>
  picked ?? details[q.id] ?? (q.type === 'percent' ? q.initial : undefined);

/** ‘다음’으로 저장할 값. null = 아직 못 넘어감. 고르면 바로 넘어가는 질문(선택, 월)은 ‘다음’이 없음 */
export function submitValue(q: GoalQuestion, v: Value): Value | null {
  switch (q.type) {
    case 'amount':
      return typeof v === 'number' && v > 0 ? v : null;
    case 'percent':
      return typeof v === 'number' ? v : null;
    case 'text':
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    case 'yearMonth':
      return typeof v === 'string' && v ? v : null;
    case 'list': {
      const rows = Array.isArray(v) ? (v as AnnualItem[]) : [];
      const ok = rows.filter((r) => r.name.trim() && r.amount && r.month);
      return ok.length && listReady(rows as unknown as ListRowValue[])
        ? ok.map((r) => ({ name: r.name.trim(), amount: r.amount, month: r.month }))
        : null;
    }
    default:
      return null;
  }
}
export const autoAdvances = (q: GoalQuestion) => q.type === 'choice' || q.type === 'month';

// 목표 템플릿 질문 입력 하나(O-23, G-03b). 저장과 다음 화면은 쓰는 쪽이 정한다.
export function GoalQuestionInput({
  q,
  t,
  value,
  details,
  onChange,
  onAnswer,
}: {
  q: GoalQuestion;
  t: Pick<GoalTemplate, 'kind'>;
  value: Value;
  details: Answers;
  /** 값을 고침(estimated = 구간으로 고른 값) */
  onChange: (v: Value) => void;
  /** 고르면 바로 다음(선택, 월, ‘잘 모르겠어요’ 구간) */
  onAnswer: (v: Value, estimated: boolean) => void;
}) {
  switch (q.type) {
    case 'amount':
      return (
        <AmountInput
          label={q.title}
          value={typeof value === 'number' ? value : null}
          onChange={(x) => onChange(x ?? undefined)}
          quick={quickChips[q.quick]}
          bands={q.band ? bands[q.band] : undefined}
          unsureLabel={copy.unsureLater}
          onBand={(b) => onAnswer(b.value, true)}
          monthly={t.kind({}) === 'monthly'}
          zeroLink={q.zero ? { label: q.zero, onClick: () => onAnswer(0, false) } : undefined}
        />
      );
    case 'percent': {
      const p = typeof value === 'number' ? value : q.initial;
      const price = typeof details.price === 'number' ? details.price : 0;
      return (
        <>
          <PercentSlider label={q.title} value={p} onChange={(x) => onChange(x)} left={`${p}%`} />
          <p className="hg-q__help" aria-live="polite">
            {copy.saveRatio(readWon(Math.round((price * p) / 100)))}
          </p>
        </>
      );
    }
    case 'text':
      return (
        <ShortText
          label={q.title}
          value={typeof value === 'string' ? value : ''}
          onChange={(x) => onChange(x)}
          max={q.max}
        />
      );
    case 'choice':
      return (
        <ChoiceCards
          label={q.title}
          value={typeof value === 'string' ? value : null}
          onChange={(x) => onChange(x)}
          onPick={(x) => onAnswer(x, false)}
          options={q.options}
        />
      );
    case 'yearMonth':
      return (
        <YearMonthInput
          label={q.title}
          value={typeof value === 'string' ? value : null}
          onChange={(x) => onChange(x ?? undefined)}
        />
      );
    case 'month':
      return (
        <MonthChips
          label={q.title}
          value={typeof value === 'number' ? value : null}
          onChange={(m) => {
            onChange(m);
            onAnswer(m, false);
          }}
        />
      );
    case 'list': {
      const rows: ListRowValue[] = Array.isArray(value)
        ? (value as AnnualItem[]).map((i) => ({ name: i.name, amount: i.amount, month: i.month }))
        : [emptyRow()];
      return (
        <ListInput
          label={q.title}
          rows={rows}
          onChange={(r) => onChange(r as unknown as AnnualItem[])}
          totalLabel={(m) => copy.yearTotal(m)}
        />
      );
    }
  }
}
