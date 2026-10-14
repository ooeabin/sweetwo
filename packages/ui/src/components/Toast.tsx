// 잠깐 떴다 사라지는 알림. 4초, 행동이 있으면 6초(docs/design/components/Toast.md). 위치와 쌓기는 app의 ToastHost가 맡는다.
export function Toast({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="hg-toast" role="status">
      {message}
      {action && (
        <button type="button" className="hg-btn hg-btn--link" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export const TOAST_MS = { plain: 4000, withAction: 6000 } as const;
