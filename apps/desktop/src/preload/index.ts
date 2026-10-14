import { contextBridge, ipcRenderer } from 'electron';
import { CH } from '../shared/channels';

// 렌더러에 노출하는 것은 window.sweetwo 하나. 모양은 packages/app/src/platform.ts의 DesktopBridge와 같아야 한다.
// 토큰과 로그인 콜백은 노출하지 않는다(main 전용).
contextBridge.exposeInMainWorld('sweetwo', {
  version: process.versions.electron,
  onInvite: (cb: (code: string) => void) => {
    const handler = (_e: unknown, code: string) => cb(code);
    ipcRenderer.on(CH.invite, handler);
    return () => {
      ipcRenderer.removeListener(CH.invite, handler);
    };
  },
});
