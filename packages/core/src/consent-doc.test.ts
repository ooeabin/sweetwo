import { describe, expect, it } from 'vitest';
import { parseConsentDoc } from './consent-doc';

describe('동의 문서(A-05 보기)', () => {
  it('frontmatter, 제목, 목록, 문단', () => {
    const md = `<!-- 복사본 -->
---
version: v1
title: 마케팅 정보 받기 동의
---

<!-- 설명 -->

## 보내는 때

- 한 달에 한 번까지
- 밤 9시부터 아침 8시까지는 안 보내요

선택 항목이라
그대로 쓸 수 있어요.
`;
    expect(parseConsentDoc(md)).toEqual({
      title: '마케팅 정보 받기 동의',
      version: 'v1',
      blocks: [
        { kind: 'h2', text: '보내는 때' },
        { kind: 'ul', items: ['한 달에 한 번까지', '밤 9시부터 아침 8시까지는 안 보내요'] },
        { kind: 'p', text: '선택 항목이라 그대로 쓸 수 있어요.' },
      ],
    });
  });
});
