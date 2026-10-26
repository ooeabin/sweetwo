import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

// 보안 저장소(iOS Keychain, Android Keystore로 암호화). 이 기기에만(백업으로 다른 기기에 옮겨지지 않음).
// refresh token, 앱 잠금 PIN 해시와 틀린 횟수만 둔다. 실패하면 저장하지 않음(다음 실행 때 다시 로그인).
let ready: Promise<void> | null = null;
const init = () =>
  (ready ??= SecureStorage.setKeyPrefix('sweetwo.')
    .then(() => SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly))
    .catch(() => undefined));

export const secureStore = {
  async get(key: string): Promise<string | null> {
    await init();
    try {
      return await SecureStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<boolean> {
    await init();
    try {
      await SecureStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  async remove(key: string) {
    await init();
    await SecureStorage.removeItem(key).catch(() => undefined);
  },
};
