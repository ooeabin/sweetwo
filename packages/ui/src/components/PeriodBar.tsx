import type { ReactNode } from 'react';

// 날짜 없는 사람의 기간 막대(docs/design/components/PeriodBar.md, 2026-11-13 ADR 0009 G8). HubLine 문장 자리 안.
// 위 “들어온 돈 340만 원 / 필요한 돈 380만 원” → 8px 막대(채움 ink-2, 중립, 오렌지 아님) → 회색 “10월 3일부터”.
// 판정 문장 없음. 다 차면 보조 한 줄(full). 막대는 장식(aria-hidden), 화면 읽기는 부르는 쪽 label
export function PeriodBar({
  inLabel,
  needLabel,
  percent,
  since,
  full,
}: {
  inLabel: ReactNode;
  needLabel: ReactNode;
  /** 채움 0~100 */
  percent: number;
  since: ReactNode;
  /** 다 참: 보조 줄(“남는 돈은 저금에 넣을 수 있어요”) */
  full?: ReactNode;
}) {
  return (
    <span className="hg-periodbar">
      <span className="hg-periodbar__text">
        {inLabel} / {needLabel}
      </span>
      <span className="hg-periodbar__bar" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </span>
      <span className="hg-periodbar__since">{since}</span>
      {full && <span className="hg-periodbar__since">{full}</span>}
    </span>
  );
}
