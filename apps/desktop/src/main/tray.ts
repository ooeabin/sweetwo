import { Menu, Tray, nativeImage } from 'electron';
import trayIcon from '../../resources/tray.png?asset';
import { toggleWidget } from './widget';

// 트레이 아이콘(26 트레이 위젯 창 1번): 누르면 위젯 창 열기·닫기. 오른쪽 클릭 “sweeTwo 열기” “위젯 설정” “sweeTwo 끝내기”.
// S-22에서 끄면 없앰(앱 창을 닫으면 앱도 끝남).
let tray: Tray | null = null;

export function createTray(o: { open: (path?: string) => void; quit: () => void }) {
  if (tray) return tray;
  const image = nativeImage.createFromPath(trayIcon).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('sweeTwo');
  const menu = Menu.buildFromTemplate([
    { label: 'sweeTwo 열기', click: () => o.open() },
    { label: '위젯 설정', click: () => o.open('/settings/widget') },
    { type: 'separator' },
    { label: 'sweeTwo 끝내기', click: o.quit },
  ]);
  // setContextMenu를 쓰면 macOS에서 왼쪽 클릭도 메뉴가 열려서, 오른쪽 클릭만 메뉴
  tray.on('click', () => toggleWidget(tray));
  tray.on('right-click', () => tray?.popUpContextMenu(menu));
  return tray;
}

export function destroyTray() {
  tray?.destroy();
  tray = null;
}

export const hasTray = () => !!tray;
