import { onSessionReset, resetSessionState } from '../../shared/session-reset';
import { prefs } from './prefs';
import { session } from './session';
import { useAuthStore } from './store';

// 로그아웃은 모두 이 함수로(DEV_GUIDE ‘로그아웃’, 2026-11-10 1구간 검토 S1-03·S1-14).
// 직접 로그아웃, PIN 잊음, PIN 5번 틀림, 만료, 다른 계정으로 로그인, 계정 삭제, 가입 취소가 같은 길을 지난다.
// - 서버 세션: 이 기기 푸시 토큰 해제 → 브리지(모바일) 또는 supabase-js(웹) 로그아웃
// - 이 기기: 쿼리 캐시, 상점(가입 중 값 등), 기기 오프라인 캐시, 돌아갈 화면, 리다이렉트 중 제공자
// - 다른 계정으로 바뀌면(accountChange) ‘최근 사용’ 방법과 이 기기 PIN도. PIN 잊음(forgetPin)도 PIN을 지움
export interface SignOutOptions {
  /** 다른 계정으로 로그인하려고: 최근 사용 방법, 이 기기 PIN, 마지막 계정 기록도 지움 */
  accountChange?: boolean;
  /** ‘PIN을 잊었어요’: 이 기기 PIN을 지우고 로그인 뒤 새로 정함 */
  forgetPin?: boolean;
  /** 세션 만료: 같은 계정으로 다시 로그인하면 하던 화면으로 돌아가게 돌아갈 화면은 남김 */
  keepReturnTo?: boolean;
}

/** 서버 세션은 그대로 두고 이 기기에 남은 계정 데이터만 비움(브리지가 이미 로그아웃한 경우: 만료, PIN 5번 틀림) */
export function clearLocalSession(o: SignOutOptions = {}) {
  resetSessionState();
  prefs.setPendingProvider(null);
  if (!o.keepReturnTo) prefs.setReturnTo(null);
  if (o.forgetPin || o.accountChange) prefs.setPinAsked(false);
  if (o.accountChange) {
    prefs.setLastProvider(null);
    prefs.setLastUser(null);
  }
  void session.bridge?.cache?.clear().catch(() => undefined);
}

/** 로그아웃 하나. 실패해도(오프라인 등) 이 기기 데이터는 지운다 */
export async function signOut(o: SignOutOptions = {}) {
  const b = session.bridge;
  if ((o.forgetPin || o.accountChange) && b?.lock.reset)
    await b.lock.reset().catch(() => undefined);
  await session.signOut().catch(() => undefined);
  clearLocalSession(o);
}

// 가입 도중 값(A-04 이메일 등)도 로그아웃하면 비움
onSessionReset(() => useAuthStore.getState().clearSignup());
