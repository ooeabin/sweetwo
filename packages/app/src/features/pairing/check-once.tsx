import { useState } from 'react';
import { copy } from './copy';

/** ‘말이 안 되는 값’ 한 번 확인(막지 않음). 온보딩 useConfirmOnce와 같은 규칙 */
export function useCheckOnce() {
  const [shown, setShown] = useState(false);
  return {
    check: (odd: boolean) => {
      if (!odd || shown) return true;
      setShown(true);
      return false;
    },
    reset: () => setShown(false),
    banner: shown ? (
      <div className="hg-banner hg-banner--info" role="alert">
        <span>{copy.checkValue}</span>
      </div>
    ) : null,
  };
}
