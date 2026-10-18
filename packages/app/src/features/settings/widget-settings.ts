import { WIDGET_DEFAULTS, WidgetSettings } from '@sweetwo/core';
import { useCallback, useEffect, useState } from 'react';

/** 위젯 설정(S-22, 기기마다 데스크톱 main이 기억). 웹이면 null */
export function useWidgetSettings() {
  const bridge = typeof window !== 'undefined' ? window.sweetwo?.widget : undefined;
  const [s, setS] = useState<WidgetSettings | null>(null);
  useEffect(() => {
    if (!bridge) return;
    void bridge.settings().then((raw) => {
      const p = WidgetSettings.safeParse(raw);
      setS(p.success ? p.data : WIDGET_DEFAULTS);
    });
  }, [bridge]);
  const save = useCallback(
    async (p: Partial<WidgetSettings>) => {
      if (!bridge) return;
      const raw = await bridge.setSettings(p);
      const r = WidgetSettings.safeParse(raw);
      if (r.success) setS(r.data);
    },
    [bridge],
  );
  return { settings: s, save, desktop: !!bridge };
}
