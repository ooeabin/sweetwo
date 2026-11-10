import { useEffect, useRef } from 'react';
import { session } from './session';

/**
 * Android 하드웨어 뒤로를 이 화면이 받음(2026-11-10, A-03 대기 = 취소, A-04·A-05 = 가입 취소).
 * on이 false면 받지 않음(시트가 열려 있을 때 등). 처리하면 브리지 기본 동작(웹뷰 뒤로)은 하지 않음
 */
export function useHardwareBack(fn: () => void, on = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const b = session.bridge;
    if (!on || !b?.onBack) return;
    return b.onBack(() => {
      ref.current();
      return true;
    });
  }, [on]);
}
