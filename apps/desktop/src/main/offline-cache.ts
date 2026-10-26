import { app, safeStorage } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 오프라인 조회용 기기 캐시(30 동기화 1장 ‘기기 = 캐시’, 4장 오프라인). 마지막으로 받은 화면 데이터를
// OS 키체인 키(safeStorage)로 암호화해 파일 하나에 둠. 로그아웃하면 지움. 암호화를 못 쓰는 환경이면 저장하지 않음.
const MAX = 20 * 1024 * 1024;
const file = () => join(app.getPath('userData'), 'offline-cache.bin');

export const offlineCache = {
  load(): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(readFileSync(file()));
    } catch {
      return null;
    }
  },
  save(text: string): boolean {
    if (!safeStorage.isEncryptionAvailable() || text.length > MAX) return false;
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file(), safeStorage.encryptString(text), { mode: 0o600 });
    return true;
  },
  clear() {
    rmSync(file(), { force: true });
  },
};
