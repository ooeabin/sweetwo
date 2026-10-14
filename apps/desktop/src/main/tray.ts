import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import trayIcon from '../../resources/tray.png?asset';

// 트레이(메뉴 막대) 뼈대. 메뉴 항목과 문구는 기획서 D 탭(데스크톱)이 정해지면 채운다.
let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null, quit: () => void) {
  const image = nativeImage.createFromPath(trayIcon).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('sweeTwo');
  const show = () => {
    const win = getWindow();
    if (!win) return;
    win.show();
    win.focus();
  };
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '스위투 열기', click: show },
      { type: 'separator' },
      { label: '종료', click: quit },
    ]),
  );
  tray.on('click', show);
  return tray;
}
