// 기본 프로필(Avatar) 글자(2026-11-18): 닉네임 앞에서부터 최대 3자. docs/design/components/Avatar.md
// 한글, 영문, 숫자 모두 글자(그래핌) 수로 세고, 이모지 같은 조합 문자는 깨지지 않게 Intl.Segmenter를 쓴다.
// 공백은 빼고 센다. 영문은 대문자로 바꾸지 않고 그대로. 비면 빈 글자(화면은 사람 아이콘).

export const AVATAR_MAX_CHARS = 3;

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export function avatarInitials(name: string | null | undefined): string {
  const out: string[] = [];
  for (const { segment } of segmenter.segment(name ?? '')) {
    if (/^\s+$/u.test(segment)) continue;
    out.push(segment);
    if (out.length === AVATAR_MAX_CHARS) break;
  }
  return out.join('');
}

/** 글자 수(1·2·3, 없으면 0): 글자 크기 단계를 고르는 데 씀 */
export function avatarInitialCount(name: string | null | undefined): number {
  return [...segmenter.segment(avatarInitials(name))].length;
}
