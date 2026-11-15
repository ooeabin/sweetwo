import { prefs } from '../auth';
import { onSessionReset } from '../../shared/session-reset';

// 시작한 사람의 O-60 뒤 흐름 이어하기(첫 저금 W-11a~e, from=onboarding, 그리고 끝의 초대 시트 O-07 /welcome).
// 2026-11-13 실구동: 중간에 앱을 닫으면 홈으로 떨어짐. 2026-11-16 r5: A-06 권장이 먼저 끼어 홈으로 가던 것도 고침.
// 흐름 화면을 열 때마다 지금 주소를 이 기기에 남기고(`sweetwo.firstSavingAt`, auth prefs), 저장·시트 닫기, 첫 화면에서 뒤로 나가면 지움.
// 다시 열면 auth routeAfterLogin이 A-06보다 먼저 남긴 주소로(입력값은 W-11 saving-draft 그대로). A-06은 흐름이 끝난 뒤 한 번.
// 계정 데이터라 로그아웃(onSessionReset)하면 지움

export const markFirstSaving = (path: string) => prefs.setFirstSavingAt(path);
export const clearFirstSaving = () => prefs.setFirstSavingAt(null);

/** 이어서 열 주소(W-11 from=onboarding 또는 /welcome), 없으면 null */
export const firstSavingPath = (): string | null => prefs.firstSavingAt();

onSessionReset(clearFirstSaving);
