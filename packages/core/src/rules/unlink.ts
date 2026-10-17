// 연결 해제 자산 정리 안(docs/spec/25-settings.md S-12b, 08 부부·제안·권한 3장).
// 서버 unlink_ratio, unlink_share와 같은 결과.

/** 내 분담 몫 %: 반반 50 / 버는 만큼 월 실수령 비율(반올림, 둘 중 하나가 없으면 50) / 직접은 내 몫 */
export function splitPercent(
  mode: string | null,
  myIncome: number | null,
  partnerIncome: number | null,
  myRatio: number,
): number {
  if (mode === 'income') {
    if (myIncome && partnerIncome && myIncome > 0 && partnerIncome > 0)
      return Math.round((myIncome * 100) / (myIncome + partnerIncome));
    return 50;
  }
  if (mode === 'custom') return myRatio;
  return 50;
}

/** 기본 몫: 금액 × % ÷ 100, 1만 원 단위 반올림, 0 ~ 금액 */
export function unlinkShare(amount: number, pct: number): number {
  return Math.min(Math.max(Math.round((amount * pct) / 1_000_000) * 10_000, 0), amount);
}

export type UnlinkItem = {
  assetId: string;
  name: string;
  amount: number;
  mine: number;
  side: 'asset' | 'debt';
};

/** 합계(요청자, 상대). side를 주면 그 쪽(자산 또는 부채)만 */
export function unlinkTotals(
  items: UnlinkItem[],
  side?: 'asset' | 'debt',
): { mine: number; theirs: number } {
  let mine = 0;
  let theirs = 0;
  for (const i of items) {
    if (side && i.side !== side) continue;
    mine += i.mine;
    theirs += i.amount - i.mine;
  }
  return { mine, theirs };
}
