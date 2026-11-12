// 자산 관리 마지막 본 하위 탭(23 F-01·F-02 1번 ‘마지막 본 탭 기억’). 기기에만.
// 사이드바 탭, 메뉴 서랍, 홈 자산 관리 타일, Ctrl(⌘)+3, F-04에서 항목이 없을 때 이 탭으로 들어감(2026-11-12 QA 8구간 S8-10)
const KEY = 'sweetwo.assets-tab';
export type AssetsTab = 'overview' | 'items';

export const lastAssetsTab = () => {
  try {
    return localStorage.getItem(KEY) === 'items' ? '/assets/items' : '/assets';
  } catch {
    return '/assets';
  }
};

export const rememberAssetsTab = (t: AssetsTab) => {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* 기억 못 해도 됨 */
  }
};
