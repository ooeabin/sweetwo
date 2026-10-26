// 앱 기본 틀 문구(docs/spec/19-this-month.md ‘앱 기본 틀’, H-04 순자산, 공지 띠). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  tabMonth: '홈', // [확인 필요] 재기획 탭 이름(19 앱 기본 틀 3번)
  tabGoals: '목표',
  tabAssets: '우리 자산',
  tabCalendar: '캘린더',
  search: '검색',
  mask: '금액 가리기',
  noti: '알림',
  settings: '설정',
  add: '추가',
  me: '설정 열기', // [확인 필요] 아바타 버튼 이름(화면 읽기용)
  saved: '모두 저장됨',
  saving: '저장 중',
  stats: '이번 달 숫자', // [확인 필요] 숫자 타일 묶음 이름(화면 읽기용)
  // 공지 띠(AD-10)
  noticeOpen: '보기', // [확인 필요]
  noticeFold: '접기', // [확인 필요]
  noticeClose: '닫기', // [확인 필요]
  // H-04 순자산(F-01과 같은 표기)
  netWorth: '순자산',
  netWorthExpected: (amount: string) => `예상 ${amount}`,
  netWorthExpectedName: '예상 순자산',
  netWorthGain: (amount: string) => `안 판 수익 ${amount}`,
  netWorthChange: (amount: string) => `지난달보다 ${amount}`,
  netWorthGraph: '최근 6개월 순자산', // [확인 필요] 화면 읽기용
  netWorthEmpty: '자산을 적으면 여기에 보여요', // [확인 필요]
  netWorthSee: '우리 자산 보기', // [확인 필요]
  addGoal: '목표',
  addAsset: '가진 돈·대출',
  addCare: '챙길 날',
  cmdPlaceholder: '찾거나 바로 할 일을 입력해요',
  cmdEmpty: '찾는 게 없어요',
  cmdQuick: '바로 하기',
  cmdCheck: '월급 체크하기',
  cmdGoal: '목표 추가',
  cmdAsset: '가진 돈 추가',
  cmdMask: '금액 가리기',
  cmdUnmask: '금액 보이기',
  cmdLock: '잠그기',
  cmdGoals: '목표',
  cmdAssets: '가진 돈·대출',
  cmdCares: '챙길 날',
  offlineTitle: '연결이 끊겼어요',
  offlineBody: '다시 연결되면 이어서 볼 수 있어요',
  offlineCached: '오프라인',
  lastSaved: (at: string) => `마지막 저장 ${at}`,
  // 오프라인 입력 대기열(30 동기화 4장, 13 공통 상태 9·11번)
  pending: (n: number) => `대기 ${n}건`,
  sendAll: '한 번에 보내기', // [확인 필요] 7일 넘게 오프라인
  rejected: (n: number) => `보내지 못한 입력 ${n}건`,
  rejectedShow: '보기', // [확인 필요]
  retryInput: '다시 하기',
  discardInput: '버리기',
  rejectClosed: '지난 체크리스트라 바꿀 수 없어요', // [확인 필요]
  rejectGone: '지워진 항목이에요', // [확인 필요]
  rejectDenied: '바꿀 수 없는 항목이에요', // [확인 필요]
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictOffline: (partner: string) =>
    `오프라인일 때 바꾼 값이 ${partner}님이 나중에 바꾼 값과 달라요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
};
