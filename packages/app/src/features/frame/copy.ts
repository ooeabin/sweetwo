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
};
