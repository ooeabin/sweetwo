import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { AppUpdater } from 'electron-updater';
import { createUpdater, feedUrl } from './updater';

vi.mock('electron', () => ({}));

function fake() {
  const e = new EventEmitter() as EventEmitter & Record<string, unknown>;
  e.setFeedURL = vi.fn();
  e.checkForUpdates = vi.fn(async () => {
    e.emit('checking-for-update');
    e.emit('update-available', { version: '1.2.0' });
    e.emit('download-progress', { percent: 42.7 });
    e.emit('update-downloaded', { version: '1.2.0' });
    return null;
  });
  e.quitAndInstall = vi.fn();
  return e;
}

describe('자동 업데이트(S-19)', () => {
  it('피드 주소: OS마다', () => {
    expect(feedUrl('darwin')).toBe('https://download.sweetwo.kr/updates/mac');
    expect(feedUrl('win32')).toBe('https://download.sweetwo.kr/updates/win');
  });

  it('확인 → 받는 중(%) → 다 받음 → 다시 시작이면 설치, 창에 상태를 보냄', async () => {
    const u = fake();
    const sent: unknown[] = [];
    const win = { webContents: { send: (_c: string, s: unknown) => sent.push(s) } };
    const up = createUpdater(u as unknown as AppUpdater, () => win as never, 'darwin');
    expect(u.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://download.sweetwo.kr/updates/mac',
    });
    expect(up.state()).toEqual({ status: 'idle' });
    expect(await up.check()).toEqual({ status: 'ready', version: '1.2.0' });
    expect(sent).toContainEqual({ status: 'downloading', version: '1.2.0', percent: 42 });
    // 다 받은 뒤 다시 확인해도 그대로
    await up.check();
    expect(u.checkForUpdates).toHaveBeenCalledTimes(1);
    up.install();
    expect(u.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('최신이면 latest, 실패하면 error(설치 안 함)', async () => {
    const u = fake();
    u.checkForUpdates = vi.fn(async () => {
      u.emit('update-not-available', {});
      return null;
    });
    const up = createUpdater(u as unknown as AppUpdater, () => null, 'win32');
    expect(await up.check()).toEqual({ status: 'latest' });
    u.checkForUpdates = vi.fn(async () => {
      throw new Error('net');
    });
    expect(await up.check()).toEqual({ status: 'error' });
    up.install();
    expect(u.quitAndInstall).not.toHaveBeenCalled();
  });
});
