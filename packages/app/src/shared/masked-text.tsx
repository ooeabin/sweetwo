import { Fragment, type ReactNode } from 'react';
import { sharedCopy } from './copy';
import { MASKED } from './mask';

// 금액 가리기(11 8장): 화면에는 “•••”, 화면 읽기는 “가려진 금액”(11 9장, 2026-11-12 QA 5구간 S5-12).

/** 화면 읽기 이름(aria-label)용 글자: ••• → 가려진 금액 */
export const spoken = (text: string) => text.split(MASKED).join(sharedCopy.maskedAmount);

/** 보이는 글자용: •••는 보이기만 하고 화면 읽기에는 “가려진 금액”. •••가 없으면 글자 그대로 */
export function speakMasked(text: string): ReactNode {
  if (!text.includes(MASKED)) return text;
  const parts = text.split(MASKED);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          <span aria-hidden="true">{MASKED}</span>
          <span className="hg-sr">{sharedCopy.maskedAmount}</span>
        </>
      )}
    </Fragment>
  ));
}
