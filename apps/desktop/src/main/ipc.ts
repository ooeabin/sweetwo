import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { CH } from '../shared/channels';
import { cancelLogin, getAccessToken, reopenLogin, signOut, startLogin } from './auth';
import {
  clearPin,
  lockNow,
  lockStatus,
  setPin,
  setTouchId,
  unlockWithTouchId,
  clearPinVerified,
  setAutoLock,
  verifyPin,
} from './lock';
import { showNotice } from './notify';

// IPC 핸들러. 보낸 창이 우리 화면인지 확인하고, 인자는 Zod로 검사한다(docs/DEV_GUIDE.md ‘Electron 보안 체크리스트’).
function trusted(e: IpcMainInvokeEvent) {
  const url = e.senderFrame?.url ?? '';
  const dev = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith('file://') || (!!dev && url.startsWith(dev));
}

function handle<A extends z.ZodTypeAny>(channel: string, args: A, fn: (a: z.infer<A>) => unknown) {
  ipcMain.handle(channel, (e, ...raw: unknown[]) => {
    if (!trusted(e)) throw new Error('허용되지 않은 호출');
    return fn(args.parse(raw));
  });
}

const none = z.tuple([]);
const Provider = z.enum(['kakao', 'google', 'apple']);

const Notice = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().max(200).optional(),
});

export function registerIpc(getWindow: () => BrowserWindow | null) {
  handle(CH.authStart, z.tuple([Provider]), ([p]) => startLogin(p));
  handle(CH.authReopen, none, () => reopenLogin());
  handle(CH.authCancel, none, () => cancelLogin());
  handle(CH.authToken, none, () => getAccessToken());
  // 로그아웃하면 이 기기 PIN도 지운다(다음 로그인 때 새로 만들기)
  handle(CH.authSignOut, none, async () => {
    clearPin();
    await signOut('user');
  });
  handle(CH.lockStatus, none, () => lockStatus());
  handle(CH.lockSetPin, z.tuple([z.string().max(6)]), ([pin]) => setPin(pin));
  handle(CH.lockVerify, z.tuple([z.string().max(6)]), ([pin]) => verifyPin(pin));
  handle(CH.lockNow, none, () => lockNow());
  handle(CH.lockSetTouchId, z.tuple([z.boolean()]), ([on]) => setTouchId(on));
  handle(CH.lockTouchId, none, () => unlockWithTouchId());
  handle(CH.lockClear, none, () => clearPinVerified());
  handle(CH.lockSetAuto, z.tuple([z.number().int()]), ([m]) => setAutoLock(m));
  handle(CH.notifyShow, z.tuple([Notice]), ([n]) => showNotice(n, getWindow));
}
