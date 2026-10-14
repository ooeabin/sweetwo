import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

// 메인 프로세스: 창, 딥링크(sweetwo://), 단일 인스턴스. 보안 체크리스트는 docs/DEV_GUIDE.md ‘Electron 보안’.
const PROTOCOL = 'sweetwo';

if (!app.requestSingleInstanceLock()) app.quit();
app.setAsDefaultProtocolClient(PROTOCOL);

function createWindow() {
  const win = new BrowserWindow({
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
    },
  });
  win.once('ready-to-show', () => win.show());
  // 바깥 링크는 시스템 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
