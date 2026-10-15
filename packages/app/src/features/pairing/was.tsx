import type { ReactNode } from 'react';
import { copy } from './copy';

// 바뀐 값 강조(P-11, 다시 보기): 지금 값 + 바뀌었으면 취소선 그은 이전 값
export function Was({ now, before }: { now: ReactNode; before: ReactNode }) {
  return (
    <>
      {now}
      {before !== now && (
        <>
          {' '}
          <s className="hg-help" aria-label={copy.before}>
            {before}
          </s>
        </>
      )}
    </>
  );
}
