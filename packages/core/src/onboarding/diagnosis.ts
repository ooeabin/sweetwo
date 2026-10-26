// 투자 원칙(06 8장, 09 6-7)

/** 투자 원칙 답(O-53) */
export type InvestAnswer = 'keep' | 'some' | 'active' | 'unsure';
/**
 * 공동자금 중 투자 허용 비중(09 6-7): 원금은 지켜야 해요 0%, 조금은 괜찮아요 30%, 일부는 적극적으로 60%.
 * ‘잘 모르겠어요’는 가장 보수적인 0%로 봄([확인 필요] 기획서에 값 없음)
 */
export const INVEST_LIMIT: Record<InvestAnswer, number> = {
  keep: 0,
  some: 30,
  active: 60,
  unsure: 0,
};

/**
 * 투자 원칙 합의(06 8장): 둘 다 답함 = both, 한 명만 = one, 아무도 = null(아직 정하지 않았어요).
 * 혼자 쓰기는 내 답만으로 both. 허용 비중 = 답한 사람 중 보수적인 쪽
 */
export function investPrinciple(
  mine: InvestAnswer | null,
  partner: InvestAnswer | null,
  solo = false,
): { state: 'one' | 'both' | null; limit: number | null } {
  const answered = [mine, partner].filter((x): x is InvestAnswer => x !== null);
  const limit = answered.length ? Math.min(...answered.map((a) => INVEST_LIMIT[a])) : null;
  const state = !answered.length
    ? null
    : mine !== null && (partner !== null || solo)
      ? 'both'
      : 'one';
  return { state, limit };
}
