import { app, safeStorage } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// main 프로세스 전용 보안 저장소. refresh token 같은 값을 OS 키체인(safeStorage)으로 암호화해 파일에 둔다.
// 렌더러에는 노출하지 않는다(docs/DEV_GUIDE.md ‘데스크톱 로그인과 딥링크’). 로그인 단계에서 토큰 갱신이 이걸 쓴다.
export type SecureKey = 'refresh-token' | 'app-lock' | 'app-lock-auto';

type Store = Partial<Record<SecureKey, string>>; // key → base64(암호문)
const file = () => join(app.getPath('userData'), 'secure-store.json');

function load(): Store {
  try {
    return JSON.parse(readFileSync(file(), 'utf8')) as Store;
  } catch {
    return {}; // 처음 실행이거나 파일이 깨졌으면 빈 저장소(다시 로그인)
  }
}
function save(s: Store) {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(file(), JSON.stringify(s), { mode: 0o600 });
}

export const secureStore = {
  get(key: SecureKey): string | null {
    const v = load()[key];
    if (!v || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(v, 'base64'));
    } catch {
      return null;
    }
  },
  /** 암호화를 못 쓰는 환경이면 저장하지 않고 false(다음 실행 때 다시 로그인) */
  set(key: SecureKey, value: string): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const s = load();
    s[key] = safeStorage.encryptString(value).toString('base64');
    save(s);
    return true;
  },
  remove(key: SecureKey) {
    save(Object.fromEntries(Object.entries(load()).filter(([k]) => k !== key)));
  },
};
