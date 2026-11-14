import { BottomSheet, ChoiceCards, ListRow } from '@sweetwo/ui';
import { useState } from 'react';

// 휴대폰 기본 드롭다운 대신: 줄(이름 + 오른쪽 지금 값 ›) → 누르면 아래 시트에서 하나 고름(2026-11-03, P-02a와 같은 방식).
// 줄은 hg-list 안에 둠. 고르면 시트가 닫히고 바로 onChange.
export function SheetSelect<V extends string | number>({
  label,
  rowLabel,
  value,
  options,
  nameOf,
  subOf,
  onChange,
  disabled,
}: {
  /** 시트 제목, 선택 묶음 이름(화면 읽기) */
  label: string;
  /** 줄 왼쪽 이름. 없으면 고른 값 이름이 줄 이름 */
  rowLabel?: string;
  value: V;
  options: readonly V[];
  nameOf: (v: V) => string;
  /** 선택지 아래 한 줄 설명(없으면 없음) */
  subOf?: (v: V) => string | undefined;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const key = (v: V) => String(v);
  const byKey = new Map(options.map((o) => [key(o), o]));
  return (
    <>
      <ListRow
        label={rowLabel ?? nameOf(value)}
        value={rowLabel ? nameOf(value) : undefined}
        onClick={disabled ? undefined : () => setOpen(true)}
      />
      {open && (
        <BottomSheet title={label} onClose={() => setOpen(false)}>
          <ChoiceCards<string>
            label={label}
            value={key(value)}
            onChange={(k) => {
              const v = byKey.get(k);
              if (v !== undefined && v !== value) onChange(v);
            }}
            onPick={() => setOpen(false)}
            options={options.map((o) => ({ value: key(o), label: nameOf(o), sub: subOf?.(o) }))}
          />
        </BottomSheet>
      )}
    </>
  );
}
