import { describe, expect, it } from 'vitest';
import { parseFaq, searchFaq } from './faq';

const md = `<!-- 설명 -->
## 시작하기

### 1. 계좌를 연결하지 않나요?

네, 계좌·카드 연동 없이
직접 입력해요.

## 둘이 쓰기

### 4. 배우자는 어떻게 초대하나요?

설정 › 부부 정보에서 초대 코드를 보내 주세요.
`;

describe('자주 묻는 질문', () => {
  it('묶음과 질문, 여러 줄 답', () => {
    expect(parseFaq(md)).toEqual([
      {
        title: '시작하기',
        items: [
          { n: 1, q: '계좌를 연결하지 않나요?', a: '네, 계좌·카드 연동 없이 직접 입력해요.' },
        ],
      },
      {
        title: '둘이 쓰기',
        items: [
          {
            n: 4,
            q: '배우자는 어떻게 초대하나요?',
            a: '설정 › 부부 정보에서 초대 코드를 보내 주세요.',
          },
        ],
      },
    ]);
  });
  it('검색: 모든 낱말, 없으면 빈 목록', () => {
    const g = parseFaq(md);
    expect(searchFaq(g, '초대 코드').map((i) => i.n)).toEqual([4]);
    expect(searchFaq(g, '광고')).toEqual([]);
    expect(searchFaq(g, '  ')).toEqual([]);
  });
});
