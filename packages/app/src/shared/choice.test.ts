import { describe, expect, it } from 'vitest';
import { choiceVariant } from '@sweetwo/ui';

const it2 = (...labels: string[]) => labels.map((label) => ({ value: label, label }));
describe('고르기 모양 기준(A 테두리 버튼 / C 라디오 줄)', () => {
  it('짧은 2~3개는 버튼', () => {
    expect(choiceVariant(it2('전부', '일부'))).toBe('buttons');
    expect(choiceVariant(it2('나', '서연', '공동'))).toBe('buttons');
    expect(choiceVariant(it2('월급날 확인', '자동으로 나가요'))).toBe('buttons');
  });
  it('4개 이상, 설명 있음, 긴 글자는 줄', () => {
    expect(choiceVariant(it2('a', 'b', 'c', 'd'))).toBe('rows');
    expect(
      choiceVariant([
        { value: 'a', label: '모두', sub: '설명' },
        { value: 'b', label: '숨기기' },
      ]),
    ).toBe('rows');
    expect(choiceVariant(it2('월급날 확인', '자동으로 나가요', '목록에 안 넣어요'))).toBe('rows');
  });
});
