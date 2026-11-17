// Checkbox 줄(docs/design/components/Selection.md ‘Checkbox 줄’, 2026-11-10): 체크 상자 + 글자, 줄 전체가 누르는 곳.
// 체크하면 브랜드 오렌지(hg-checkbox is-on, 어드민은 잉크). 동의 묶음(ConsentCard)과 따로, 질문 화면의 켜고 끄는 한 줄(O-31 ‘매달 금액이 달라요’).
// 2026-11-17 어드민: disabled, 표 칸 안에서는 글자를 화면 읽기에만(hideLabel)
export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  hideLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="hg-checkrow"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={checked ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
      <span className={hideLabel ? 'hg-sr' : undefined}>{label}</span>
    </button>
  );
}
