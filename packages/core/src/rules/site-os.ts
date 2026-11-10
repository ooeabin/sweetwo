// 웹사이트 앱 받기 버튼(docs/spec/28-website.md L-01 2번, L-02): 휴대폰은 그 기기 스토어 하나, 그 밖(PC, 모름)은 스토어 2개.
// 2026-11-10 데스크톱 앱을 없애 Mac·Windows 판정과 지원 OS 판정을 뺌(ADR 0008). iPad는 Mac처럼 알려 주기도 해 ‘그 밖’(스토어 2개).
export type SiteOs = 'ios' | 'android' | 'other';
/** 휴대폰(그 기기 스토어 하나) */
export const isPhoneOs = (os: SiteOs) => os === 'ios' || os === 'android';

export function detectSiteOs(ua: string): SiteOs {
  const s = ua || '';
  if (/Android/i.test(s)) return 'android';
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios';
  return 'other';
}
