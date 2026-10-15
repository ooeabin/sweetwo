import type { Won } from '../money';

// 변동 지출 기본 항목(docs/spec/09-data-items.md 6-3). 부부 공간마다 처음 한 번 넣는다. 켜기·끄기, 이름 바꾸기, 직접 추가는 부부 단위.
export const defaultSpendCategories: { key: string; name: string }[] = [
  { key: 'groceries', name: '장보기(식재료)' },
  { key: 'dining', name: '외식·배달' },
  { key: 'cafe', name: '카페·간식' },
  { key: 'household', name: '생활용품' },
  { key: 'transit', name: '대중교통·택시' },
  { key: 'fuel', name: '주유·충전' },
  { key: 'shopping', name: '쇼핑(옷·잡화)' },
  { key: 'beauty', name: '미용' },
  { key: 'medical', name: '병원·약' },
  { key: 'events', name: '경조사' },
  { key: 'gifts', name: '선물' },
  { key: 'travel', name: '여행' },
  { key: 'culture', name: '문화·취미' },
  { key: 'fitness', name: '운동' },
  { key: 'self_dev', name: '자기계발' },
  { key: 'baby', name: '육아용품' },
  { key: 'pet', name: '반려동물' },
  { key: 'etc', name: '기타' },
];

/** 이번 달 쓴 돈(용돈, 큰 지출 빼고) = 고정 + 변동 항목 합계. 비운 칸은 0 */
export function spendTotal(fixed: Won[], variable: (Won | null)[]) {
  const f = fixed.reduce((s, v) => s + v, 0);
  const v = variable.reduce<number>((s, x) => s + (x ?? 0), 0);
  return { fixed: f, variable: v, total: f + v };
}
