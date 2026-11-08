// 홈 문구(docs/spec/19-this-month.md). 기획서 “ ” 안 문장 그대로. [확인 필요]는 기획서에 문구가 없거나 확인 중인 것.
export const copy = {
  noSavedYet: '아직 모은 돈이 없어요', // [확인 필요] 0%일 때 진행 칸 대신(2026-11-03)
  // H-01 기다리는 화면
  waitTitle: (starter: string) => `${starter}님이 시작하고 있어요`,
  waitCard: (starter: string) => `${starter}님이 월급 계획을 만들면 알려 드릴게요`, // [확인 필요] 2026-11-08,
  // 오늘 띠
  add: '추가',
  check: '월급 체크하기',
  // H-02 저금 항목(2026-11-08 ADR 0007)
  savings: '저금 항목',
  toSplit: '월급 계획', // [확인 필요] 제목 줄 오른쪽 → W-01
  goalAmount: (saved: string, target: string) => `${saved} / ${target}`,
  achieved: '달성',
  suggestSaving: '모으고 싶은 돈이 있으면 저금 항목으로 만들어 보세요', // [확인 필요]
  suggestAdd: '추가하기', // [확인 필요]
  // H-03 이번 달 월급
  progress: (total: number, done: number) => `${total}개 중 ${done}개 완료`,
  partnerProgress: (name: string, total: number, done: number) =>
    `${name}님 ${total}개 중 ${done}개`,
  inviteNow: '초대하기', // 2026-11-03 할 일 띠 초대 버튼
  homeTitle: '홈', // 2026-11-03 넓은 창 제목 줄(다른 메뉴와 같음)
  allDone: (label: string) => `${label} 체크를 다 했어요`,
  savedThisMonth: (amount: string) => `저금 ${amount}을 보냈어요`, // [확인 필요] 19 홈 상태 변형 1번,
  editSplit: '월급 계획 고치기',
  noSalary: '월급이 생기면 월급 계획을 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // H-04 우리 자산
  assets: '우리 자산',
  // H-05 다가오는 일정
  upcoming: '다가오는 일정',
  moreCalendar: '캘린더', // 다가오는 일정 오른쪽 링크(제목과 같은 말이라 2026-11-03 바꿈)
  noUpcoming: '30일 안에 일정이 없어요', // [확인 필요]
  monthShort: (m: number) => `${m}월`,
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요]
  // H-06 할 일 한 줄(19 ‘할 일 한 줄 순서’)
  open: '열기', // [확인 필요] 할 일 이동 버튼
  close: '닫기',
  unlinkWait: '연결 해제를 기다리고 있어요', // [확인 필요]
  unlinkOn: (date: string) => `${date}에 해제돼요`, // [확인 필요]
  unlinkCheck: '확인하기',
  mailBounced: '알림 메일이 전달되지 않았어요',
  mailBouncedSub: '알림 이메일 주소를 확인해 주세요',
  mailCheck: '확인하기', // [확인 필요]
  // 18 ‘합류 뒤’ 모바일 첫 홈 띠 [확인 필요]
  pcAlso: 'PC에서도 같은 계정으로 쓸 수 있어요',
  pcSend: '데스크톱 앱 받기 링크 보내기',
  pcSent: '알림 이메일로 링크를 보냈어요',
  pcFailed: '지금은 보낼 수 없어요. 잠시 뒤 다시 해 주세요',
};
