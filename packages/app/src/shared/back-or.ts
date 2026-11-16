import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 머리 ‹: 온 곳으로 돌아감(기록이 있으면 back), 바로 열렸으면 fallback(기본 위 화면, 2026-11-16 IA PR-1)
 */
export function useBackOr(fallback: string) {
  const nav = useNavigate();
  return useCallback(() => (window.history.length > 1 ? nav(-1) : nav(fallback)), [nav, fallback]);
}
