// 앱 기본 틀 문구(docs/spec/19-this-month.md ‘앱 기본 틀’, 메뉴 서랍, 공지 띠). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  tabMonth: '홈', // [확인 필요] 재기획 탭 이름(19 앱 기본 틀 3번)
  tabSalary: '월급', // 2026-11-08 ADR 0007 목표 자리
  tabAssets: '자산 관리',
  tabCalendar: '캘린더',
  search: '검색',
  mask: '금액 가리기',
  noti: '알림',
  notiNew: '알림, 새 알림 있음', // [확인 필요] 2026-11-11 새 알림 점이 있을 때 종 이름(화면 읽기용)
  settings: '설정',
  add: '추가',
  // 2026-11-09 좁은 창 홈 머리 ☰와 메뉴 서랍(19 앱 기본 틀 11번) [확인 필요]
  menu: '메뉴',
  menuList: '메뉴 목록', // [확인 필요] 2026-11-11 서랍 안 줄 묶음 nav 이름(화면 읽기용, 대화상자 ‘메뉴’와 다르게)
  home: '홈으로',
  close: '닫기',
  drawer: {
    home: '홈',
    salary: '월급',
    assets: '자산 관리',
    calendar: '캘린더',
    me: '내 정보',
    settings: '설정',
    couple: '우리 둘',
    invite: '초대하기',
    notice: '공지',
    inquiry: '문의',
    help: '도움말',
  },
  version: (v: string) => `버전 ${v}`, // [확인 필요] 서랍 맨 아래
  me: '설정 열기', // [확인 필요] 아바타 버튼 이름(화면 읽기용)
  saved: '모두 저장됨',
  saving: '저장 중',
  stats: '이번 달 숫자', // [확인 필요] 숫자 타일 묶음 이름(화면 읽기용)
  // 공지 띠(AD-10)
  noticeOpen: '보기', // [확인 필요]
  noticeFold: '접기', // [확인 필요]
  noticeClose: '닫기', // [확인 필요]
  addSaving: '저금', // [확인 필요] 2026-11-09
  addAsset: '자산·부채',
  addCare: '경조사',
  cmdPlaceholder: '찾거나 바로 할 일을 입력해요',
  cmdEmpty: '찾는 게 없어요',
  // 검색 아래 키 안내(넓은 창, 2026-11-03)
  cmdKeyMove: '이동', // [확인 필요]
  cmdKeyOpen: '열기', // [확인 필요]
  cmdKeyClose: '닫기', // [확인 필요]
  cmdQuick: '바로 하기',
  cmdCheck: '월급 체크하기',
  cmdSaving: '저금 추가', // [확인 필요] 2026-11-09
  cmdAsset: '자산 추가',
  cmdMask: '금액 가리기',
  cmdUnmask: '금액 보이기',
  cmdLock: '잠그기',
  cmdSavings: '저금',
  cmdAssets: '자산·부채',
  cmdCares: '경조사',
  offlineTitle: '연결이 끊겼어요',
  offlineBody: '다시 연결되면 이어서 볼 수 있어요',
  offlineCached: '오프라인',
  lastSaved: (at: string) => `마지막 저장 ${at}`,
  // 자산 순위 줄(23 F-01 0번, 2026-11-04. 2026-11-11 홈 순위 줄 1a는 없앰)
  rankQ: '우리 자산은 상위 몇 %일까요?', // [확인 필요]
  rankCheck: '확인하기', // [확인 필요] 앞에 ‘광고’ 표시
  rankAd: '광고',
  rankSeen: (pct: number, open = false) =>
    open ? `우리 자산 상위 ${pct}% 안이에요` : `우리 자산 상위 ${pct}%예요`, // [확인 필요]
  rankSeenMore: (month: number) => `${month}월 기준, 자세히 보기`, // [확인 필요]
  rankStale: (pct: number) => `지난번엔 상위 ${pct}%였어요`, // [확인 필요]
  rankRefresh: '새로 확인하기', // [확인 필요]
  rankEmpty: '자산을 적으면 상위 몇 %인지 알려 드려요', // [확인 필요]
  rankAdClosed: '광고를 끝까지 보면 볼 수 있어요', // [확인 필요]
};
