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
};
