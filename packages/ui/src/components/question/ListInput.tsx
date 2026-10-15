import { formatManWon, MAX_WON } from '@sweetwo/core';
import { cx } from '../cx';
import { IconButton } from '../IconButton';
import { Icon } from '../Icon';

// Q6 목록 입력(docs/spec/12-question-pattern.md Q6): 이름 + 금액 + 월. 항목 한도 10개, 완성 행만 합계.
export interface ListRowValue {
  name: string;
  amount: number | null;
  month: number | null;
}
export const emptyRow = (): ListRowValue => ({ name: '', amount: null, month: null });
export const isCompleteRow = (r: ListRowValue) =>
  r.name.trim() !== '' && !!r.amount && r.amount > 0 && r.month !== null;
const isBlank = (r: ListRowValue) => r.name.trim() === '' && r.amount === null && r.month === null;
/** 다음 버튼 활성: 완성 행 1개 이상, 미완성 행 없음 */
export const listReady = (rows: ListRowValue[]) =>
  rows.some(isCompleteRow) && rows.every((r) => isBlank(r) || isCompleteRow(r));

export function ListInput({
  label,
  rows,
  onChange,
  totalLabel,
  namePlaceholder = '이름',
  limit = 10,
  onRemoved,
}: {
  label: string;
  rows: ListRowValue[];
  onChange: (rows: ListRowValue[]) => void;
  totalLabel: (manText: string) => string;
  namePlaceholder?: string;
  limit?: number;
  /** 지운 행(Toast ‘되돌리기’용) */
  onRemoved?: (row: ListRowValue, index: number) => void;
}) {
  const done = rows.filter(isCompleteRow);
  const total = done.reduce((s, r) => s + (r.amount ?? 0), 0);
  const set = (i: number, patch: Partial<ListRowValue>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="hg-stack" role="group" aria-label={label} style={{ gap: 'var(--space-3)' }}>
      {rows.map((r, i) => {
        const partial = !isBlank(r) && !isCompleteRow(r);
        return (
          <div key={i} className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
            <select
              className={cx('hg-input', partial && r.month === null && 'is-error')}
              style={{ width: '6em', flex: 'none' }}
              aria-label={`${i + 1}번째 월`}
              value={r.month ?? ''}
              onChange={(e) => set(i, { month: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, k) => (
                <option key={k + 1} value={k + 1}>
                  {k + 1}월
                </option>
              ))}
            </select>
            <input
              className={cx('hg-input', partial && !r.name.trim() && 'is-error')}
              aria-label={`${i + 1}번째 이름`}
              placeholder={namePlaceholder}
              maxLength={20}
              value={r.name}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <input
              className={cx('hg-input', partial && !r.amount && 'is-error')}
              style={{ textAlign: 'right', width: '9em', flex: 'none' }}
              inputMode="numeric"
              aria-label={`${i + 1}번째 금액`}
              placeholder="0원"
              value={r.amount === null ? '' : `${r.amount.toLocaleString('ko-KR')}`}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '');
                set(i, { amount: d === '' ? null : Math.min(Number(d), MAX_WON) });
              }}
            />
            <IconButton
              icon="x"
              label={`${i + 1}번째 항목 삭제`}
              ghost
              small
              onClick={() => {
                if (rows.length === 1) onChange([emptyRow()]);
                else onChange(rows.filter((_, j) => j !== i));
                onRemoved?.(r, i);
              }}
            />
          </div>
        );
      })}
      {rows.some((r) => !isBlank(r) && !isCompleteRow(r)) && (
        <span className="hg-help is-error">금액을 넣어 주세요</span>
      )}
      <button
        type="button"
        className="hg-btn hg-btn--ghost hg-btn--sm"
        style={{ alignSelf: 'flex-start' }}
        disabled={rows.length >= limit}
        onClick={() => {
          if (!rows.some(isBlank)) onChange([...rows, emptyRow()]);
        }}
      >
        <Icon name="plus" size={16} />
        항목 추가
      </button>
      {rows.length >= limit && <span className="hg-help">{limit}개까지 넣을 수 있어요</span>}
      <p className="hg-q__help" aria-live="polite">
        {done.length ? totalLabel(formatManWon(total)) : '—'}
      </p>
    </div>
  );
}
