import { Chip } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { copy } from './copy';

export interface NameChip {
  key: string;
  name: string;
}

/**
 * 추가 화면(W-11a 저축·투자, W-01e 지출)의 이름 칩 묶음(2026-11-27 사용자 결정, docs/spec/19 ‘이름 칩 표’·20 W-01e).
 * 맨 위 묶음(‘추천’ / ‘자주 쓰는 것’) 칩 + 끝 칩(‘직접 정하기’ 등)은 늘 보이고, 나머지 주제 묶음은 ‘더 보기’로 펼침.
 * 묶음 제목 13/400 slate(`hg-chipgroups__title`). 고른 칩이 접힌 묶음에 있으면 처음부터 펼침
 */
export function NameChipGroups({
  label,
  topTitle,
  top,
  groups,
  selected,
  onPick,
  tail,
}: {
  /** 화면 읽기 이름(칩 묶음 전체) */
  label: string;
  topTitle: string;
  top: NameChip[];
  groups: { title: string; chips: NameChip[] }[];
  /** 지금 고른 칩 key(없으면 null) */
  selected: string | null;
  onPick: (c: NameChip) => void;
  /** 맨 위 줄 끝에 붙는 칩(‘같이 쓰는 통장’, ‘직접 정하기’) */
  tail?: ReactNode;
}) {
  const shown = groups.filter((g) => g.chips.length > 0);
  const [open, setOpen] = useState(
    () => selected !== null && shown.some((g) => g.chips.some((c) => c.key === selected)),
  );
  const chip = (c: NameChip) => (
    <Chip key={c.key} small selected={selected === c.key} onClick={() => onPick(c)}>
      {c.name}
    </Chip>
  );
  return (
    <div className="hg-chipgroups" role="group" aria-label={label}>
      <p className="hg-chipgroups__title">{topTitle}</p>
      <div className="hg-form__chips">
        {top.map(chip)}
        {tail}
      </div>
      {open &&
        shown.map((g) => (
          <div key={g.title} role="group" aria-label={g.title}>
            <p className="hg-chipgroups__title" aria-hidden="true">
              {g.title}
            </p>
            <div className="hg-form__chips">{g.chips.map(chip)}</div>
          </div>
        ))}
      {shown.length > 0 && (
        <button
          type="button"
          className="hg-btn hg-btn--link hg-chipgroups__more"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          {open ? copy.chipLess : copy.chipMore}
        </button>
      )}
    </div>
  );
}
