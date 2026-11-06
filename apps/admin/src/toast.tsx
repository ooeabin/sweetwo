import { TOAST_MS, Toast } from '@sweetwo/ui';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

// 어드민 결과 알림(2026-11-06 인터랙션 점검): 저장됨, 승인 요청됨, 오류 등은 화면 아래 가운데 Toast로 4초.
// 화면 안 작은 글(hg-help)로 띄우던 것을 바꿈. null을 주면 지금 알림을 지움.
type Show = (message: string | null) => void;
const Ctx = createContext<Show>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), TOAST_MS.plain);
    return () => window.clearTimeout(t);
  }, [msg]);
  const show = useCallback<Show>((text) => setMsg(text ? { text, key: Date.now() } : null), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="hg-toasts" aria-live="polite">
        {msg && <Toast key={msg.key} message={msg.text} />}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
