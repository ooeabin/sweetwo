import { onSessionReset } from '../../shared/session-reset';

// 첫 저금 흐름(O-60 ‘첫 저금 만들기’ → W-11a~e, from=onboarding) 이어하기(2026-11-13 실구동: 중간에 앱을 닫으면 홈으로 떨어짐).
// 흐름 화면을 열 때마다 지금 주소를 이 기기에 남기고(`sweetwo.firstSavingAt`), 저장하거나 첫 화면에서 뒤로 나가면 지움.
// 다음 실행에 홈(/)으로 들어오면 OnboardingGate가 /onboarding/resume → 남긴 주소로(입력값은 W-11 saving-draft 그대로).
// 계정 데이터라 로그아웃하면 지움
const KEY = 'sweetwo.firstSavingAt';

export function markFirstSaving(path: string) {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    /* 기억 못 해도 이번 화면은 그대로 */
  }
}

export function clearFirstSaving() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 없어도 됨 */
  }
}

/** 이어서 열 첫 저금 흐름 주소(W-11 from=onboarding만), 없으면 null */
export function firstSavingPath(): string | null {
  try {
    const p = localStorage.getItem(KEY);
    return p && p.startsWith('/salary/items/new/') && p.includes('from=onboarding') ? p : null;
  } catch {
    return null;
  }
}

onSessionReset(clearFirstSaving);
