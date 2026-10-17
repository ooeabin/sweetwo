import { Notification, type BrowserWindow } from 'electron';
import { CH, type OsNotice } from '../shared/channels';

// OS 알림(14 ‘채널: 푸시 = 데스크톱 앱 OS 알림’). 렌더러가 Realtime으로 받은 알림을 띄우고, 누르면 창을 앞으로 + id를 렌더러로.
// 이동할 화면은 렌더러가 id로 찾음(main은 경로를 받지 않음).
export function showNotice(n: OsNotice, getWindow: () => BrowserWindow | null) {
  if (!Notification.isSupported()) return;
  const note = new Notification({ title: n.title, body: n.body ?? '' });
  note.on('click', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(CH.notifyOpen, n.id);
  });
  note.show();
}
