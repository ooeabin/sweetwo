import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { PROTOCOL, setupDeepLinks } from './deep-link';
import { createTray } from './tray';
import { handleAuthCallback } from './auth';
import { registerIpc } from './ipc';
import { startAutoLock } from './lock';

// 메인 프로세스: 창, 딥링크(sweetwo://), 단일 인스턴스, 트레이. 보안 저장소는 secure-store.ts(main 전용).
// 보안 체크리스트는 docs/DEV_GUIDE.md ‘Electron 보안’.
let win: BrowserWindow | null = null;
const getWindow = () => win;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // 개발 중(electron .)에는 실행 파일 경로를 같이 넘겨야 Windows에서 링크가 이 앱으로 온다.
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  const attachDeepLink = setupDeepLinks(getWindow, (link) => void handleAuthCallback(link));

  const createWindow = () => {
    win = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 375,
      show: false,
      title: 'sweeTwo',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // 렌더러가 앱 버전을 알도록(A-01 최소 지원 버전)
        additionalArguments: [`--sweetwo-app-version=${app.getVersion()}`],
      },
    });
    attachDeepLink(win);
    win.once('ready-to-show', () => win?.show());
    win.on('closed', () => (win = null));
    // 바깥 링크는 시스템 브라우저로, 앱 안 이동은 막는다.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      const dev = process.env.ELECTRON_RENDERER_URL;
      if (dev && url.startsWith(dev)) return;
      if (url.startsWith('file://')) return;
      e.preventDefault();
    });
    if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
    else void win.loadFile(join(__dirname, '../renderer/index.html'));
  };

  void app.whenReady().then(() => {
    registerIpc();
    startAutoLock();
    createWindow();
    if (process.env.SWEETWO_NO_TRAY !== '1') createTray(getWindow, () => app.quit());
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
