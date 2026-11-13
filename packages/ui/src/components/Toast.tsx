import type { ReactNode } from 'react';

// 잠깐 떴다 사라지는 알림. 4초, 행동이 있으면 6초(docs/design/components/Toast.md). 위치와 쌓기는 app의 ToastHost가 맡는다.
// 행동 버튼(‘되돌리기’)을 누르면 토스트를 닫는 것도 ToastHost가 맡는다(2026-11-12).
export function Toast({
  message,
  action,
}: {
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="hg-toast" role="status">
      <span className="hg-toast__msg">{message}</span>
      {action && (
        <button type="button" className="hg-btn hg-btn--link" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export const TOAST_MS = { plain: 4000, withAction: 6000 } as const;
