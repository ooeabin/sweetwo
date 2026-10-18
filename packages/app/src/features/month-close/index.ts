// month-close 기능. 밖으로 내보낼 것만 여기서 export.
import { copy as closeCopy } from './copy';
export { W04jSpendEntry } from './pages/w-04j-spend-entry';
export { CloseRoute } from './close-route';
export { useCloseData } from './data';
export { closeSummaryProps } from './summary';
export { W04pBundle } from './pages/w-04p-bundle';
export { W04Missed } from './pages/w-04-missed';
/** 부부 대화 카드 전체(W-04i, 설정 S-01 다시 보기) */
export const TALK_CARDS: readonly string[] = closeCopy.cards;
