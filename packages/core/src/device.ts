// 로그인된 기기 이름(25 S-15): 세션의 브라우저 정보로 “컴퓨터 앱(Mac)”, “휴대폰 앱(iOS)”, “Chrome(Windows)”처럼
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? '';
  const os = /Mac|iPhone|iPad/.test(s)
    ? /iPhone|iPad/.test(s)
      ? 'iOS'
      : 'Mac'
    : /Windows/.test(s)
      ? 'Windows'
      : /Android/.test(s)
        ? 'Android'
        : /Linux/.test(s)
          ? 'Linux'
          : '';
  const app = /sweeTwo|Electron/i.test(s);
  const mobile = os === 'iOS' || os === 'Android';
  // 모바일 앱 웹뷰는 capacitor.config appendUserAgent로 sweeTwo가 붙음 [확인 필요] ‘휴대폰 앱’
  const browser = app
    ? mobile
      ? '휴대폰 앱'
      : '컴퓨터 앱'
    : /Edg\//.test(s)
      ? 'Edge'
      : /Chrome\//.test(s)
        ? 'Chrome'
        : /Firefox\//.test(s)
          ? 'Firefox'
          : /Safari\//.test(s)
            ? 'Safari'
            : '알 수 없는 기기';
  return os ? `${browser}(${os})` : browser;
}
