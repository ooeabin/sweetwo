import { readWon, splitShares, type SplitMode, type Won } from '@sweetwo/core';
import { ChoiceCards, PercentSlider } from '@sweetwo/ui';
import { copy } from './copy';

// 분담 방식 고르기(O-52 선택지·슬라이더). P-08 ‘다르게 해볼래요’, G-08 ‘다르게 해볼래요’에서 제안으로 보낼 안을 고른다.
export interface SplitPick {
  mode: SplitMode | null;
  /** 직접 정할 때 내 몫 % */
  myPct: number;
}

export function SplitPicker({
  label,
  value,
  onChange,
  total,
  myName,
  partnerName,
  myIncome,
  partnerIncome,
  partnerUnknown,
}: {
  label: string;
  value: SplitPick;
  onChange: (v: SplitPick) => void;
  total: Won;
  myName: string;
  partnerName: string;
  myIncome: Won;
  partnerIncome: Won;
  partnerUnknown: boolean;
}) {
  const shares = (m: SplitMode) =>
    splitShares({ total, mode: m, myIncome, partnerIncome, myRatio: value.myPct });
  const preview = (m: SplitMode) => {
    const x = shares(m);
    return (
      <span className="hg-row" style={{ gap: 'var(--space-4)' }}>
        <span>
          <span className="hg-help">{myName}</span> <b>{readWon(x.me)}</b>
        </span>
        <span>
          <span className="hg-help">{partnerName}</span> <b>{readWon(x.partner)}</b>
        </span>
      </span>
    );
  };
  const cx = shares('custom');
  return (
    <>
      <ChoiceCards<SplitMode>
        label={label}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        options={[
          { value: 'half', label: copy.splitModes.half, detail: preview('half') },
          {
            value: 'income',
            label: copy.splitModes.income,
            disabled: partnerUnknown,
            detail: partnerUnknown ? undefined : preview('income'),
          },
          { value: 'custom', label: copy.splitModes.custom },
        ]}
      />
      {value.mode === 'custom' && (
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <PercentSlider
            label={copy.splitModes.custom}
            value={value.myPct}
            onChange={(myPct) => onChange({ ...value, myPct })}
            left={copy.splitPct(myName, value.myPct)}
            right={copy.splitPct(partnerName, 100 - value.myPct)}
          />
          <div className="hg-row" style={{ justifyContent: 'space-between' }}>
            <b>{readWon(cx.me)}</b>
            <b>{readWon(cx.partner)}</b>
          </div>
        </div>
      )}
    </>
  );
}
