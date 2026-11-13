import { Button as UiButton, type ButtonProps } from '@sweetwo/ui';
import { useState } from 'react';

// 어드민 버튼(2026-11-06 인터랙션 점검): onAct가 Promise를 돌려주면 끝날 때까지 버튼 안 로딩(aria-busy)
// + 두 번 누르기 막음. onAct 없이 onClick만 쓰면 디자인 Button 그대로.
export function Button({ onAct, ...rest }: ButtonProps & { onAct?: () => unknown }) {
  const [busy, setBusy] = useState(false);
  if (!onAct) return <UiButton {...rest} />;
  return (
    <UiButton
      {...rest}
      aria-busy={busy || rest['aria-busy'] || undefined}
      onClick={() => {
        if (busy) return;
        const r = onAct();
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          setBusy(true);
          void (r as Promise<unknown>).finally(() => setBusy(false));
        }
      }}
    />
  );
}
