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
