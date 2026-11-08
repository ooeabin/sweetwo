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
