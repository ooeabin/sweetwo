import { saveSpace } from './data';
import { PART6_START } from './flow';
import type { useStep } from './step';

/**
 * 파트 5 ‘나중에 할게요’(O-51, O-52): 규칙 확정 전 기본값으로 계산(분담 반반, 배우자 용돈 = 내 용돈,
 * 내 용돈 미입력이면 50만 원 가정 → core DEFAULT_ALLOWANCE). 할 일 카드는 split_deferred로 만든다.
 */
export const deferPart5 = (s: ReturnType<typeof useStep>) =>
  s.done(
    () => saveSpace({ split_deferred: true, split_mode: 'half', split_ratio: null }),
    () => PART6_START,
  );
