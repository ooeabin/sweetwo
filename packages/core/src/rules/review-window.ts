import { addDays } from '../date';

/**
 * 월급 전 확인 기간(07 4장): 다음 기준일 3일 전(= 기간 끝 2일 전) ~ 기간 끝(기준일 전날). W-05가 열리는 기간(2026-11-12 D3).
 * v2.2에서는 손 줄이 남았을 때만 열림(pay-confirm.ts reviewDue)
 */
export const inReviewWindow = (today: string, cycleEnd: string) =>
  today >= addDays(cycleEnd, -2) && today <= cycleEnd;
