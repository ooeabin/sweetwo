import type { BaseDay } from '@sweetwo/core';
import { DayChips } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from './copy';

// 결과 화면 공통 조각: ‘임시 플랜’ 배지 + 사유(플랜 단위), ‘추정’ 배지(값 단위)
export function TempNote({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p className="hg-row" style={{ gap: 'var(--space-2)', margin: 0 }}>
      <span className="hg-badge hg-badge--temp">{copy.tempPlan}</span>
      <span className="hg-help">{reason}</span>
    </p>
  );
}

export function EstTag({ show }: { show: boolean }) {
  return show ? <span className="hg-badge hg-badge--temp">{copy.estimated}</span> : null;
}

/** 기준일 줄 + ‘바꾸기’(O-63, O-66). 고르면 바로 저장(합류 전은 즉시 적용) */
export function BaseDayEditor({
  value,
  line,
  sub,
  onSave,
}: {
  value: BaseDay | null;
  line: (day: string) => string;
  sub?: string;
  onSave: (d: BaseDay) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
      <div className="hg-row" style={{ justifyContent: 'space-between' }}>
        <span className="hg-stack" style={{ gap: 0 }}>
          <span>{value === null ? '' : line(copy.dayText(value))}</span>
          {sub && <span className="hg-help">{sub}</span>}
        </span>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {copy.change}
        </button>
      </div>
      {open && (
        <DayChips
          label={copy.change}
          value={value}
          lastLabel={copy.paydayLast}
          onChange={(d) => {
            setOpen(false);
            void onSave(d);
          }}
        />
      )}
    </div>
  );
}
