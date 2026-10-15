import { useEffect, useState } from 'react';

/** 좁은 창(768px 미만) */
export function useNarrow() {
  const q = '(max-width: 767px)';
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(q).matches,
  );
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}
