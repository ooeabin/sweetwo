import { useCallback, useEffect, useState } from 'react';
import type { WidgetSettings } from '../platform';

// S-22 위젯 설정 중 기기마다 저장하는 값(‘위젯에 금액 보이기’, 기본 끔). 저장은 브리지 window.sweetwo.widget.settings가
// 이 기기에만 둠(앱 코드는 Capacitor를 모름). 브라우저·옛 앱은 브리지가 없어 null(위젯이 없는 곳).
const bridge = () => (typeof window !== 'undefined' ? window.sweetwo?.widget?.settings : undefined);

/** 이 기기에서 위젯 설정을 쓸 수 있는지(모바일 앱 + 위젯 브리지가 있을 때만 S-10에 ‘위젯’ 줄) */
export const widgetSettingsAvailable = () => !!bridge();

/** 위젯 설정 읽기·쓰기. value null = 아직 읽는 중이거나 브리지 없음 */
export function useWidgetSettings() {
  const [value, setValue] = useState<WidgetSettings | null>(null);
  useEffect(() => {
    let alive = true;
    void bridge()
      ?.get()
      .then((v) => alive && setValue(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const save = useCallback(async (next: WidgetSettings) => {
    await bridge()?.set(next);
    setValue(next);
  }, []);
  return { value, save };
}
