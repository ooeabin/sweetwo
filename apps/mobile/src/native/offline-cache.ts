import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { secureStore } from './store';

// 오프라인 조회용 기기 캐시(30 동기화 1장 ‘기기 = 캐시’, 모바일 키는 Keychain·Keystore).
// 무작위 AES-GCM 키(256비트)는 보안 저장소에, 암호문은 앱 데이터 폴더 파일 하나에(백업 제외 폴더 아님 → 키가 없으면 못 엶).
// 로그아웃하면 키와 파일을 모두 지움.
const FILE = 'offline-cache.bin';
const KEY = 'offline-cache-key';
const MAX = 20 * 1024 * 1024;

const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(create: boolean): Promise<CryptoKey | null> {
  let raw = await secureStore.get(KEY);
  if (!raw && create) {
    raw = b64(crypto.getRandomValues(new Uint8Array(32)));
    if (!(await secureStore.set(KEY, raw))) return null;
  }
  return raw
    ? crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
    : null;
}

export const offlineCache = {
  async load(): Promise<string | null> {
    try {
      const k = await key(false);
      if (!k) return null;
      const f = await Filesystem.readFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const all = unb64(String(f.data));
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: all.subarray(0, 12) },
        k,
        all.subarray(12),
      );
      return new TextDecoder().decode(plain);
    } catch {
      return null;
    }
  },
  async save(text: string): Promise<boolean> {
    if (text.length > MAX) return false;
    try {
      const k = await key(true);
      if (!k) return false;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)),
      );
      const all = new Uint8Array(12 + enc.length);
      all.set(iv);
      all.set(enc, 12);
      await Filesystem.writeFile({
        path: FILE,
        data: b64(all),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return true;
    } catch {
      return false;
    }
  },
  async clear() {
    await secureStore.remove(KEY);
    await Filesystem.deleteFile({ path: FILE, directory: Directory.Data }).catch(() => undefined);
  },
};
