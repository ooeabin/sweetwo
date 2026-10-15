// 고정지출 분류(docs/spec/09-data-items.md 6-2). O-36 그룹 칩 8개(대출 그룹은 O-39, 부채에서 자동).
// 구독 이름 등은 바뀌므로 나중에 어드민 데이터(item_catalog)로 옮긴다. 지금은 기획서 표 그대로.
export type Burden = 'shared' | 'personal';
export interface FixedItemDef {
  name: string;
  burden: Burden;
}
export interface FixedGroupDef {
  key: string;
  name: string;
  items: FixedItemDef[];
}

const s = (name: string): FixedItemDef => ({ name, burden: 'shared' });
const p = (name: string): FixedItemDef => ({ name, burden: 'personal' });

export const fixedGroups: FixedGroupDef[] = [
  {
    key: 'housing',
    name: '주거',
    items: [s('월세'), s('관리비'), s('전세대출 이자'), s('주택담보대출 원리금')],
  },
  { key: 'utilities', name: '공과금', items: [s('전기요금'), s('가스요금'), s('수도요금')] },
  { key: 'telecom', name: '통신', items: [p('휴대폰'), s('인터넷·TV')] },
  {
    key: 'insurance',
    name: '보험',
    items: [
      p('실손보험'),
      p('건강보험(종신·암 등)'),
      s('자동차보험(월납)'),
      p('운전자보험'),
      s('어린이·태아보험'),
      s('반려동물보험'),
    ],
  },
  {
    key: 'subscription',
    name: '구독',
    items: [
      s('넷플릭스'),
      s('유튜브 프리미엄'),
      s('쿠팡 와우'),
      s('네이버플러스 멤버십'),
      s('배민클럽'),
      s('티빙'),
      s('디즈니+'),
      s('웨이브'),
      s('쿠팡플레이'),
      s('멜론'),
      s('스포티파이'),
      s('iCloud'),
      s('구글 원'),
      s('ChatGPT'),
      s('기타 구독'),
    ],
  },
  { key: 'transport', name: '교통', items: [s('대중교통 정기권'), s('월 주차비')] },
  { key: 'kids', name: '아이', items: [s('어린이집·유치원비'), s('학원비')] },
  { key: 'support', name: '정기 지원', items: [s('부모님 용돈'), s('기부·후원')] },
];
export const fixedGroupByKey = (k: string) => fixedGroups.find((g) => g.key === k);
