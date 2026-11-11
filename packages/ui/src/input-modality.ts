// 손가락·마우스로 누른 뒤에는 포커스 테두리를 그리지 않는다(2026-11-11 사용자 결정: 누른 뒤 테두리가 남는 게 이상함).
// 브라우저의 :focus-visible만으로는 부족하다: iPad·iPhone(WKWebView)은 눌러도 버튼에 포커스가 안 가서
// 시트·대화상자·서랍이 닫히며 포커스를 돌려줄 때(element.focus()) 테두리가 그려진다.
// 마지막 입력이 손가락·마우스면 <html data-input="pointer">, 키보드면 "keyboard". CSS(bundle.css 끝)가 pointer일 때 테두리를 숨긴다.
const NAV_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Escape',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function trackInputModality(root: HTMLElement = document.documentElement): () => void {
  const pointer = () => {
    if (root.dataset.input !== 'pointer') root.dataset.input = 'pointer';
  };
  const key = (e: KeyboardEvent) => {
    // 글자 입력(입력 칸에 적기)은 바꾸지 않음: 손가락으로 칸을 누르고 적는 중에 테두리가 생기지 않게
    if (!NAV_KEYS.has(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const typing =
      t instanceof HTMLElement && (t.isContentEditable || t.matches('input, textarea, select'));
    // 칸에서 띄어쓰기·Enter·화살표는 적는 중(화면 키보드 포함). Tab·Esc만 키보드 이동으로 봄
    if (typing && e.key !== 'Tab' && e.key !== 'Escape') return;
    if (root.dataset.input !== 'keyboard') root.dataset.input = 'keyboard';
  };
  window.addEventListener('pointerdown', pointer, true);
  window.addEventListener('keydown', key, true);
  return () => {
    window.removeEventListener('pointerdown', pointer, true);
    window.removeEventListener('keydown', key, true);
  };
}
