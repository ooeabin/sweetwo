import { app, BrowserWindow, screen, type Tray } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TraySnapshot,
  WIDGET_DEFAULTS,
  WidgetSettings,
  type TrayState,
  type TraySnapshot as Snapshot,
} from '@sweetwo/core';
import { CH } from '../shared/channels';
import { getAccessToken } from './auth';
import { lockStatus } from './lock';

// 트레이 위젯(26 트레이 위젯 창)과 위젯 설정(S-22, 기기마다). 앱 창이 보낸 마지막 값은 파일에 남겨 앱을 다시 켜도 보여 줌(오프라인).
// 위젯 창 = 작은 창, 같은 화면(렌더러)의 #/widget/tray. 아이콘 아래에 붙어 열리고 바깥을 누르거나 Esc로 닫힘.
const W = 340;
const H = 440;
const file = () => join(app.getPath('userData'), 'widget.json');

interface Saved {
  settings: WidgetSettings;
  snapshot: Snapshot | null;
}
let saved: Saved | null = null;
const load = (): Saved => {
  if (saved) return saved;
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Record<string, unknown>;
      const s = WidgetSettings.safeParse(raw.settings);
      const p = TraySnapshot.safeParse(raw.snapshot);
      saved = {
        settings: s.success ? s.data : WIDGET_DEFAULTS,
        snapshot: p.success ? p.data : null,
      };
      return saved;
    }
  } catch {
    /* 깨진 파일은 기본값 */
  }
  saved = { settings: WIDGET_DEFAULTS, snapshot: null };
  return saved;
};
const persist = () => {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file(), JSON.stringify(load()));
  } catch {
    /* 못 남겨도 이번 실행에는 적용 */
  }
};

let widgetWin: BrowserWindow | null = null;

export const widgetSettings = () => load().settings;

export async function trayState(): Promise<TrayState> {
  const s = load();
  return {
    signedIn: !!(await getAccessToken()),
    locked: lockStatus().locked,
    snapshot: s.snapshot,
    settings: s.settings,
  };
}

const broadcast = () => {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  void trayState().then((st) => widgetWin?.webContents.send(CH.widgetChanged, st));
};

export function updateSnapshot(s: Snapshot) {
  load().snapshot = s;
  persist();
  broadcast();
}

/** 로그아웃·다른 계정이면 위젯 값을 지움(26 예외) */
export function clearSnapshot() {
  load().snapshot = null;
  persist();
  broadcast();
}

export function setWidgetSettings(p: Partial<WidgetSettings>, onTray: (on: boolean) => void) {
  const s = load();
  const before = s.settings.tray;
  s.settings = { ...s.settings, ...p };
  persist();
  if (p.tray !== undefined && p.tray !== before) onTray(p.tray);
  broadcast();
  return s.settings;
}

function rendererUrl(hash: string) {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev ? `${dev}#${hash}` : `file://${join(__dirname, '../renderer/index.html')}#${hash}`;
}

/** 트레이 아이콘 아래에 위젯 창 열기·닫기 */
export function toggleWidget(tray: Tray | null) {
  if (widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible()) {
    widgetWin.hide();
    return;
  }
  if (!widgetWin || widgetWin.isDestroyed()) {
    widgetWin = new BrowserWindow({
      width: W,
      height: H,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: 'sweeTwo',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: [`--sweetwo-app-version=${app.getVersion()}`],
      },
    });
    widgetWin.on('blur', () => widgetWin?.hide());
    widgetWin.webContents.on('will-navigate', (e) => e.preventDefault());
    widgetWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    void widgetWin.loadURL(rendererUrl('/widget/tray'));
  }
  const b = tray?.getBounds();
  const area = screen.getDisplayNearestPoint(
    b ? { x: b.x, y: b.y } : screen.getCursorScreenPoint(),
  ).workArea;
  const x = b ? Math.round(b.x + b.width / 2 - W / 2) : area.x + area.width - W - 8;
  // 메뉴 막대가 위(macOS)면 아이콘 아래, 작업 표시줄이 아래(Windows)면 아이콘 위
  const top = b ? b.y < area.y + area.height / 2 : true;
  const y = b ? (top ? b.y + b.height + 4 : b.y - H - 4) : area.y + 8;
  widgetWin.setPosition(
    Math.min(Math.max(x, area.x + 4), area.x + area.width - W - 4),
    Math.min(Math.max(y, area.y), area.y + area.height - H),
  );
  widgetWin.show();
  widgetWin.focus();
  broadcast();
}

export const hideWidget = () => widgetWin?.hide();
