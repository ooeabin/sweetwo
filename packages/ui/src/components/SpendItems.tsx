import { formatManWon, formatWon } from '@sweetwo/core';
import { useId, type ReactNode } from 'react';

// 항목별 지출 입력(docs/design/components/SpendItems.md). 값은 정수 원, 비운 칸은 0.
export interface FixedItem {
  id: string;
  name: string;
  group: string;
  amount: number;
}
export interface VariableItem {
  id: string;
  name: string;
  amount: number | null;
  lastMonth?: number;
  prefilledFrom?: string;
}

const digits = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ''));
  return Number.isSafeInteger(n) ? n : 0;
};

export function AmountCell({
  id,
  value,
  onChange,
  onCommit,
  label,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** 칸을 벗어날 때(자동 저장) */
  onCommit?: () => void;
  label?: string;
}) {
  return (
    <span className="hg-spend__amt">
      <input
        id={id}
        className="hg-input"
        inputMode="numeric"
        aria-label={label}
        placeholder="0"
        value={value === null ? '' : value.toLocaleString('ko-KR')}
        onChange={(e) => onChange(e.target.value === '' ? null : digits(e.target.value))}
        onBlur={onCommit}
      />
    </span>
  );
}

export function SpendItems({
  fixed,
  variable,
  onChangeVariable,
  onCommitVariable,
  onAddItem,
  onEditFixed,
  fixedVisible = 3,
}: {
  fixed: FixedItem[];
  variable: VariableItem[];
  onChangeVariable: (id: string, amount: number | null) => void;
  /** 칸을 벗어날 때 저장(draft 자동 저장) */
  onCommitVariable?: (id: string) => void;
  onAddItem?: () => void;
  onEditFixed?: (id: string) => void;
  fixedVisible?: number;
}) {
  const uid = useId();
  const fixedSum = fixed.reduce((s, f) => s + f.amount, 0);
  const varSum = variable.reduce((s, v) => s + (v.amount ?? 0), 0);
  return (
    <div className="hg-spend">
      <Group id={`${uid}-f`} title="고정지출" sum={fixedSum}>
        {fixed.slice(0, fixedVisible).map((f) => (
          <div key={f.id} className="hg-spend__row is-fixed" onClick={() => onEditFixed?.(f.id)}>
            <span className="hg-spend__name">
              {f.name}
              <small>{f.group}</small>
            </span>
            <span className="hg-spend__val">{formatWon(f.amount)}</span>
          </div>
        ))}
        {fixed.length > fixedVisible && (
          <button type="button" className="hg-btn hg-btn--ghost hg-btn--sm hg-spend__add">
            고정지출 {fixed.length - fixedVisible}개 더 보기
          </button>
        )}
      </Group>
      <Group id={`${uid}-v`} title="변동 지출" sum={varSum}>
        {variable.map((v) => {
          const id = `${uid}-${v.id}`;
          return (
            <div key={v.id} className="hg-spend__row">
              <label className="hg-spend__name" htmlFor={id}>
                {v.name}
                <small>
                  {v.prefilledFrom ? (
                    <>
                      챙길 날에서 채웠어요<span className="hg-tag">{v.prefilledFrom}</span>
                    </>
                  ) : v.lastMonth !== undefined ? (
                    `지난달 ${formatManWon(v.lastMonth)}`
                  ) : null}
                </small>
              </label>
              <AmountCell
                id={id}
                value={v.amount}
                onChange={(a) => onChangeVariable(v.id, a)}
                onCommit={() => onCommitVariable?.(v.id)}
              />
            </div>
          );
        })}
        {onAddItem && (
          <button
            type="button"
            className="hg-btn hg-btn--ghost hg-btn--sm hg-spend__add"
            onClick={onAddItem}
          >
            <span className="hg-ico hg-ico--plus hg-ico--16" aria-hidden="true" />
            항목 추가
          </button>
        )}
      </Group>
      <div className="hg-spend__total" aria-live="polite">
        <span>이번 달 쓴 돈(용돈, 큰 지출 빼고)</span>
        <b>
          {formatManWon(fixedSum + varSum).replace('만', '')}
          <span className="hg-unit">만 원</span>
        </b>
      </div>
    </div>
  );
}

function Group({
  id,
  title,
  sum,
  children,
}: {
  id: string;
  title: string;
  sum: number;
  children: ReactNode;
}) {
  return (
    <div className="hg-spend__group" role="group" aria-labelledby={id}>
      <div className="hg-spend__ghead">
        <h3 id={id}>{title}</h3>
        <span>
          {formatManWon(sum).replace('만', '')}
          <span className="hg-unit">만 원</span>
        </span>
      </div>
      {children}
    </div>
  );
}
