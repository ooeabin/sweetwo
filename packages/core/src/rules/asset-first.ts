// 첫 자산 입력하기 동기(2026-11-18, docs/spec/19 H-04, 23 F-02 빈 상태): 홈 자산 관리 타일 문구 고르기,
// F-02 종류 칩, 내 것·파트너 것 개수. 금액은 다루지 않는다(파트너 금액은 알리지 않음).

export interface AssetCountItem {
  side: 'asset' | 'debt';
  owner: 'joint' | 'person';
  owner_user_id: string | null;
  created_by: string | null;
}
export interface AssetCountSum {
  side: 'asset' | 'debt';
  n: number;
}

/**
 * 내 것(내 명의, 공동, 합류 전 내가 대신 입력한 것. 자산·부채 모두)과 파트너가 입력한 자산 개수.
 * 파트너 개수는 서버가 공개 단계로 거른 행(‘모두’)과 묶음 합계(‘총액만’)만 센다. ‘숨기기’는 애초에 오지 않는다. 부채는 세지 않는다
 */
export function assetOwnership(
  items: readonly AssetCountItem[],
  sums: readonly AssetCountSum[],
  myId: string | null | undefined,
) {
  const mine = (a: AssetCountItem) =>
    a.owner === 'joint' ||
    a.owner_user_id === myId ||
    (a.owner_user_id === null && a.created_by === myId);
  return {
    mine: items.filter(mine).length,
    partner:
      items.filter((a) => !mine(a) && a.side === 'asset').length +
      sums.filter((s) => s.side === 'asset').reduce((t, s) => t + s.n, 0),
  };
}

export type AssetTileHint = 'value' | 'partner' | 'ask-two' | 'ask-me';

/**
 * 홈 자산 관리 타일 보조 문구 고르기. 내 것이 있으면 순자산 값(value),
 * 없으면 파트너가 입력했을 때 ‘파트너 소식’(partner, 우선), 아니면 궁금함 문구(둘이면 ask-two, 혼자·미합류는 ask-me)
 */
export function assetTileHint(x: {
  /** 연결된 두 사람(합류, 해제 대기 포함) */
  together: boolean;
  mine: number;
  partner: number;
}): AssetTileHint {
  if (x.mine > 0) return 'value';
  if (x.together && x.partner > 0) return 'partner';
  return x.together ? 'ask-two' : 'ask-me';
}

/** F-02 빈 상태 종류 칩(2026-11-18). 묶음·종류 키는 assetGroups와 같음, 이름은 칩 글자(저장할 때 이름으로) */
export interface FirstAssetChip {
  key: string;
  side: 'asset' | 'debt';
  grp: string;
  kind: string;
}
export const firstAssetChips: readonly FirstAssetChip[] = [
  { key: 'bank', side: 'asset', grp: 'cash', kind: 'bank' },
  { key: 'savings', side: 'asset', grp: 'deposit', kind: 'saving' },
  { key: 'stock', side: 'asset', grp: 'invest', kind: 'other' },
  { key: 'jeonse', side: 'asset', grp: 'real_estate', kind: 'deposit_money' },
  { key: 'car', side: 'asset', grp: 'etc', kind: 'car' },
  { key: 'creditLoan', side: 'debt', grp: 'credit', kind: 'credit_loan' },
  { key: 'mortgage', side: 'debt', grp: 'housing_loan', kind: 'mortgage' },
  { key: 'jeonseLoan', side: 'debt', grp: 'housing_loan', kind: 'jeonse_loan' },
  { key: 'studentLoan', side: 'debt', grp: 'student', kind: 'student_loan' },
  { key: 'cardInstallment', side: 'debt', grp: 'installment', kind: 'card_installment' },
];

/** 탭(자산·부채)별 칩. 끝에 ‘직접 고르기’ 칩은 화면이 더함(전체 추가 흐름을 종류 고르기부터 엶) */
export const firstAssetChipsOf = (side: 'asset' | 'debt'): FirstAssetChip[] =>
  firstAssetChips.filter((c) => c.side === side);
