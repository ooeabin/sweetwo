import { useState } from 'react';
import { copy } from './copy';

/** ‘말이 안 되는 값’ 한 번 확인(막지 않음). 처음 제출 때 안내를 띄우고, 다시 누르면 통과. */
export function useConfirmOnce(message: string = copy.checkValue) {
  const [shown, setShown] = useState(false);
  return {
    /** 이상값이면 안내를 띄우고 false(이번 제출은 멈춤) */
    check: (odd: boolean) => {
      if (!odd || shown) return true;
      setShown(true);
      return false;
    },
    reset: () => setShown(false),
    banner: shown ? (
      <div className="hg-banner hg-banner--info" role="alert">
        <span>{message}</span>
      </div>
    ) : null,
  };
}

/** 목표 칩: 이름표 + 이름 + “1/3”(질문이 1개뿐이면 순서 숨김) */
export function GoalChip({
  tag,
  name,
  index,
  total,
}: {
  tag?: string;
  name: string;
  index?: number;
  total?: number;
}) {
  return (
    <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
      {tag && <span className="hg-tag">{tag}</span>}
      <b>{name}</b>
      {index !== undefined && total !== undefined && total > 1 && (
        <span className="hg-help">
          {index}/{total}
        </span>
      )}
    </div>
  );
}
