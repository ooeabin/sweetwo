import { onSessionReset } from '../../shared/session-reset';

// W-11 저금 추가 중 입력값(20 W-11 ‘중간에 닫으면 입력값을 기기에 두고 다시 열면 이어서’). 기기 localStorage `sweetwo.savingDraft`.
// 계정 데이터라 로그아웃하면 지움(2026-11-12 QA 7구간 S7-06, shared/session-reset)
export const SAVING_DRAFT_KEY = 'sweetwo.savingDraft';
export type SavingDraft = {
  name: string;
  monthly: number | null;
  target: number | null;
  deadline: string | null;
  /** 이미 모은 금액 칸을 켰는지, 그 금액 */
  hasStart: boolean;
  start: number | null;
  /** W-11e “은행에서 자동으로 나가요?”(2026-11-13): null = 아직 안 고름. autoDay null = 월급날, 31 = 말일 */
  auto: boolean | null;
  autoDay: number | null;
};
export const EMPTY_DRAFT: SavingDraft = {
  name: '',
  monthly: null,
  target: null,
  deadline: null,
  hasStart: false,
  start: null,
  auto: null,
  autoDay: null,
};
export const readDraft = (): SavingDraft => {
  try {
    const v = JSON.parse(
      localStorage.getItem(SAVING_DRAFT_KEY) ?? 'null',
    ) as Partial<SavingDraft> | null;
    return { ...EMPTY_DRAFT, ...(v ?? {}) };
  } catch {
    return EMPTY_DRAFT;
  }
};
export const writeDraft = (d: SavingDraft | null) => {
  try {
    if (d) localStorage.setItem(SAVING_DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(SAVING_DRAFT_KEY);
  } catch {
    /* 기억 못 해도 이번 화면은 그대로 */
  }
};
onSessionReset(() => writeDraft(null));
