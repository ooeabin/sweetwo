import { Icon } from '@sweetwo/ui';
import { useState } from 'react';

/** ‘말이 안 되는 값’ 한 번 확인(막지 않음). 처음 제출 때 안내를 띄우고, 다시 누르면 통과. */
export function useConfirmOnce() {
  const [shown, setShown] = useState<string | null>(null);
  return {
    /** 이상값이면 message 안내를 띄우고 false(이번 제출은 멈춤) */
    check: (odd: boolean, message: string) => {
      if (!odd || shown) return true;
      setShown(message);
      return false;
    },
    reset: () => setShown(null),
    banner: shown ? (
      <div className="hg-banner hg-banner--check" role="alert">
        <Icon name="circle-alert" />
        <span>{shown}</span>
      </div>
    ) : null,
  };
}
