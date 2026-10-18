// 웹사이트 다운로드 버튼(docs/spec/28-website.md L-01 2번, L-02): 접속 OS를 알아서 하나만.
// 지원: macOS 12 이상, Windows 10 64비트 이상. 브라우저가 macOS 버전을 10_15_7로 고정해 알려 주는 일이 많아
// 11 이하 판정은 알 수 있을 때(10_14 이하)만.
export type SiteOs = 'mac' | 'win' | 'mobile' | 'unsupported' | 'unknown';

export function detectSiteOs(ua: string): SiteOs {
  const s = ua || '';
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(s)) return 'mobile';
  const mac = /Mac OS X (\d+)[_.](\d+)/.exec(s);
  if (mac) {
    const major = Number(mac[1]);
    const minor = Number(mac[2]);
    if (major === 10 && minor < 15) return 'unsupported';
    return 'mac';
  }
  if (/Macintosh/.test(s)) return 'mac';
  const win = /Windows NT (\d+)\.(\d+)/.exec(s);
  if (win) {
    if (Number(win[1]) < 10) return 'unsupported'; // Windows 7, 8, 8.1
    // 64비트: Win64·x64·WOW64(64비트 OS의 32비트 브라우저). 셋 다 없으면 32비트 Windows
    if (!/Win64|x64|WOW64/i.test(s)) return 'unsupported';
    return 'win';
  }
  return 'unknown';
}

/** L-02 ?os= 값: 맞으면 그 값, 아니면 접속 OS(Mac, Windows일 때만) */
export function installOs(param: string | null, ua: string): 'mac' | 'win' | null {
  if (param === 'mac' || param === 'win') return param;
  const os = detectSiteOs(ua);
  return os === 'mac' || os === 'win' ? os : null;
}
