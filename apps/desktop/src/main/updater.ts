import type { BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';
import { CH, type UpdateState } from '../shared/channels';

// 데스크톱 자동 업데이트(29 기술·운영 5장, DEV_GUIDE ‘업데이트와 릴리스’): electron-updater, 채널 하나.
// 켤 때(10초 뒤)와 6시간마다 확인 → 백그라운드로 받음 → 서명 검증(electron-updater가 함) → 다음 실행 때 적용(끌 때 설치).
// S-19 ‘업데이트 확인’은 바로 확인, 받은 뒤 ‘다시 시작’은 지금 설치. 피드: download.sweetwo.kr/updates/{mac|win}
const SIX_HOURS = 6 * 3_600_000;

export function feedUrl(platform: NodeJS.Platform) {
  return `https://download.sweetwo.kr/updates/${platform === 'darwin' ? 'mac' : 'win'}`;
}

export function createUpdater(
  u: AppUpdater,
  getWindow: () => BrowserWindow | null,
  platform: NodeJS.Platform = process.platform,
) {
  let state: UpdateState = { status: 'idle' };
  const set = (s: UpdateState) => {
    state = s;
    getWindow()?.webContents.send(CH.updateEvent, s);
  };
  u.setFeedURL({ provider: 'generic', url: feedUrl(platform) });
  u.autoDownload = true;
  u.autoInstallOnAppQuit = true;
  u.on('checking-for-update', () => {
    if (state.status !== 'downloading' && state.status !== 'ready') set({ status: 'checking' });
  });
  u.on('update-not-available', () => set({ status: 'latest' }));
  u.on('update-available', (i: { version: string }) =>
    set({ status: 'downloading', version: i.version, percent: 0 }),
  );
  u.on('download-progress', (p: { percent: number }) =>
    set({
      status: 'downloading',
      version: state.status === 'downloading' ? state.version : '',
      percent: Math.floor(p.percent),
    }),
  );
  u.on('update-downloaded', (i: { version: string }) =>
    set({ status: 'ready', version: i.version }),
  );
  u.on('error', () => {
    if (state.status !== 'ready') set({ status: 'error' });
  });

  const check = async () => {
    if (state.status === 'downloading' || state.status === 'ready') return state;
    try {
      await u.checkForUpdates();
    } catch {
      set({ status: 'error' });
    }
    return state;
  };
  return {
    state: () => state,
    check,
    /** 받은 업데이트를 지금 설치하고 다시 켬 */
    install: () => {
      if (state.status === 'ready') u.quitAndInstall(false, true);
    },
    start: () => {
      setTimeout(() => void check(), 10_000);
      return setInterval(() => void check(), SIX_HOURS);
    },
  };
}
export type Updater = ReturnType<typeof createUpdater>;
