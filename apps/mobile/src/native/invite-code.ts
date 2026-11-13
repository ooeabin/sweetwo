import { Capacitor, registerPlugin } from '@capacitor/core';

// 첫 실행 초대 코드(15 O-01, 18 P-01, 31 2장 ‘초대 코드 자동 입력’, 2026-11-13).
// - Android: Play 설치 리퍼러(웹사이트 L-07 스토어 링크의 referrer=invite_{코드})만. 클립보드는 읽지 않음
// - iOS: 클립보드를 이 함수가 불릴 때 한 번만 읽음(iOS가 ‘붙여넣기 허용’을 물음 = 사용자 동의). 글이 있을 때만 읽고,
//   6자리 코드 모양일 때만 돌려줌. 저장·전송하지 않음(앱이 시트로 묻고, 고르면 그 코드만 서버로)
// 이 기기에서 한 번만 묻는 것은 앱(packages/app prefs.inviteAutofillChecked)이 지킴
type Plugin = {
  installReferrer: () => Promise<{ referrer: string | null }>;
  readClipboardOnce: () => Promise<{ text: string | null }>;
};
const InviteCode = registerPlugin<Plugin>('InviteCode');

const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/** 리퍼러 글에서 invite_{코드}. utm 등 다른 값이 함께 와도 찾음 */
export function codeFromReferrer(raw: string | null): string | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    /* 그대로 */
  }
  const m = /(?:^|[&=?\s])invite_([A-Za-z0-9]{6})(?:$|[&\s])/.exec(text);
  const code = m?.[1]?.toUpperCase() ?? null;
  return code && CODE.test(code) ? code : null;
}

/** 클립보드 글에서 코드(L-07이 코드 6자만 복사). 앞뒤 공백만 허용 */
export function codeFromClipboard(raw: string | null): string | null {
  const code = raw?.trim().toUpperCase() ?? '';
  return CODE.test(code) ? code : null;
}

export async function firstRunInviteCode(): Promise<{
  code: string;
  source: 'clipboard' | 'referrer';
} | null> {
  try {
    if (Capacitor.getPlatform() === 'android') {
      const r = await InviteCode.installReferrer();
      const code = codeFromReferrer(r.referrer);
      return code ? { code, source: 'referrer' } : null;
    }
    const r = await InviteCode.readClipboardOnce();
    const code = codeFromClipboard(r.text);
    return code ? { code, source: 'clipboard' } : null;
  } catch {
    return null;
  }
}
