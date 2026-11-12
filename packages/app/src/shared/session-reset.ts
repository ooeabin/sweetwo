// 로그아웃하면 비울 것들(2026-11-10 1구간 검토 S1-03). 계정 데이터를 쥔 곳(쿼리 캐시, zustand 상점, 기기 캐시)이
// 여기에 지우는 함수를 등록하고, 로그아웃 함수(features/auth sign-out.ts) 하나가 모두 부른다.
const fns = new Set<() => void>();

/** 로그아웃 때 부를 함수 등록. 돌려준 함수로 해제 */
export function onSessionReset(fn: () => void): () => void {
  fns.add(fn);
  return () => void fns.delete(fn);
}

/** 등록된 것을 모두 비움(하나가 실패해도 나머지는 계속) */
export function resetSessionState() {
  for (const fn of fns) {
    try {
      fn();
    } catch {
      /* 다음 것 계속 */
    }
  }
}

// 계정 값을 담은 기기 저장소 키(2026-11-12 QA 11구간 S11-08). 화면 파일이 아직 안 불렸어도 지워지게 여기 한 곳에 둠.
// 기기 설정(‘최근 사용’ 방법, 금액 가리기, 보기 선택, 닫은 공지 등)은 남김(DEV_GUIDE ‘로그아웃’).
const ACCOUNT_KEYS = [
  'sweetwo.exportedAt', // S-18 내보낸 시각(분석 exported_data)
  'sweetwo.onboardingSeenAt', // 온보딩 마지막 본 시각(분석)
  'sweetwo.onboardingStartedAt', // 온보딩 시작 시각(분석)
  'sweetwo.pushAsked', // P-11 푸시 물음 1회(다음 계정도 물어봄)
];
const ACCOUNT_PREFIXES = ['sweetwo.split-notice.', 'sweetwo.made-notice.']; // W-02 안내 본 표시(월급 계획·체크리스트 id)

/** 위 키를 기기 저장소에서 지움 */
export function clearAccountStorage() {
  try {
    for (const k of ACCOUNT_KEYS) localStorage.removeItem(k);
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && ACCOUNT_PREFIXES.some((p) => k.startsWith(p))) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 저장소를 못 쓰면 남길 것도 없음 */
  }
}
onSessionReset(clearAccountStorage);
