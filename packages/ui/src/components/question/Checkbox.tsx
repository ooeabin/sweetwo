// Checkbox 줄(docs/design/components/Selection.md ‘Checkbox 줄’, 2026-11-10): 체크 상자 + 글자, 줄 전체가 누르는 곳.
// 체크하면 브랜드 오렌지(hg-checkbox is-on). 동의 묶음(ConsentCard)과 따로, 질문 화면의 켜고 끄는 한 줄(O-31 ‘매달 금액이 달라요’)
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="hg-checkrow"
      onClick={() => onChange(!checked)}
    >
      <span className={checked ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
