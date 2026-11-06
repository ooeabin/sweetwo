import { webAuth } from '@sweetwo/api';
import { paths } from './flow';
import { prefs } from './prefs';
import { session } from './session';

/**
 * 가입한 소셜로 다시 로그인(S-18b 계정 삭제, S-18 내보내기 본인 확인). 끝나면 returnTo로 돌아옴.
 * 앱(데스크톱·모바일)은 브라우저 로그인 후 A-03이 이어 받음 → 돌아올 화면을 nav로 넘김.
 */
export async function reauthenticate(returnTo: string): Promise<{ wait?: string }> {
  const p = prefs.lastProvider();
  if (!p) throw new Error('no_provider');
  prefs.setReturnTo(returnTo);
  if (session.bridge) {
    const r = await session.bridge.auth.start(p);
    if (!r.ok) throw new Error('browser_open_failed');
    return { wait: paths.wait };
  }
  prefs.setPendingProvider(p);
  await webAuth.start(p, `${window.location.origin}${paths.callback}`);
  return {};
}
