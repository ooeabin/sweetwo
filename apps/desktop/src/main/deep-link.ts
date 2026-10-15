import { app, type BrowserWindow } from 'electron';
import { CH } from '../shared/channels';
import { findDeepLink, parseDeepLink, type DeepLink } from './deep-link-parse';

// sweetwo:// 링크를 받는다. macOS는 open-url, Windows와 Linux는 두 번째 실행의 argv로 온다.
// 로그인 콜백(code, state)은 main에서만 다룬다(렌더러로 보내지 않음). 초대만 렌더러로.
export const PROTOCOL = 'sweetwo';

type AuthCallback = Exclude<DeepLink, { kind: 'invite' }>;

export function setupDeepLinks(
  getWindow: () => BrowserWindow | null,
  onAuthCallback: (cb: AuthCallback) => void,
) {
  let pendingInvite: string | undefined;

  const focus = () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  };

  const handle = (raw: string | undefined) => {
    if (!raw) return;
    const link = parseDeepLink(raw);
    if (!link) return; // 허용 목록 밖은 버림
    focus();
    if (link.kind !== 'invite') return onAuthCallback(link);
    const win = getWindow();
    if (!win || win.webContents.isLoading()) pendingInvite = link.code;
    else win.webContents.send(CH.invite, link.code);
  };

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handle(url);
  });
  app.on('second-instance', (_e, argv) => {
    const url = findDeepLink(argv);
    if (url) handle(url);
    else focus();
  });
  // 첫 실행 인자로 온 링크(Windows)는 앱이 준비된 뒤 처리
  void app.whenReady().then(() => handle(findDeepLink(process.argv)));

  return (win: BrowserWindow) => {
    win.webContents.on('did-finish-load', () => {
      if (pendingInvite) {
        win.webContents.send(CH.invite, pendingInvite);
        pendingInvite = undefined;
      }
    });
  };
}
