// 배우자 합류 문구(docs/spec/18-partner-join.md, 15 A-07). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // P-11 합류 직후 푸시 허용(모바일, 1회) [확인 필요] 문구
  pushTitle: '알림을 받을까요?',
  pushHelp: '배우자가 체크하거나 바꾸면 바로 알려 드려요',
  pushAllow: '알림 받기',
  later: '나중에 할게요',
  next: '다음',
  retry: '다시 시도',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  estimated: '추정',

  // P-01 / A-07
  invited: (inviter: string) => `${inviter}님이 초대했어요`,
  invitedHelp: '둘이 같이 쓰는 공간에 합류해요',
  codeLabel: '초대 코드',
  // P-01 코드 직접 입력(O-01 ‘초대받았어요’)
  codeTitle: '받은 초대 코드를 넣어 주세요',
  codeHelp: '배우자가 보낸 6자리 코드예요',
  joinAs: (provider: string) => `${provider} 계정으로 합류해요`,
  otherAccount: '다른 계정',
  join: '합류하기',
  toMonth: '이번 달로',
  cancel: '취소',
  errors: {
    expired: '초대가 만료됐어요. 새 코드를 요청해 주세요',
    invalid: '코드를 다시 확인해 주세요',
    locked: '10분 뒤에 다시 입력해 주세요',
    already_connected: '이미 부부 공간이 연결돼 있어요',
    own_code: '내가 만든 초대 코드예요',
    used: '이미 합류가 끝난 초대예요',
    unavailable: '사용할 수 없는 초대예요',
  },
  hasRecords: '이미 시작한 기록이 있어요',
  hasRecordsHelp: '수입·자산 같은 내 정보만 옮겨요',
  // P-02a 혼자 쓰던 기록 옮기기
  moveTitle: '내 정보만 옮겨요',
  paydayDay: (d: number) => `${d}일`,
  moveSalary: (amount: string, day: string) => `월급 ${amount}, 월급날 ${day}`,
  moveVisLabel: (name: string) => `${name} 공개 범위`,
  moveVis: { all: '모두 보여 주기', sum: '금액만 보여 주기' } as Record<string, string>,
  moveNone: '옮길 정보가 없어요',
  moveSkip: '안 옮겨요',
  moveSkipCounts: (goals: number, splits: number, lists: number) =>
    `목표 ${goals}개, 분배표 ${splits}개, 체크리스트 ${lists}개`, // [확인 필요]
  moveKeep: '30일 보관 후 지워져요',
  moveCopy: '사본 내려받기',

  // P-02b
  prefillTitle: (starter: string) => `${starter}님이 미리 적어 둔 내 정보가 있어요`,
  prefillIncome: '월 수입', // [확인 필요] 항목명
  prefillOk: '확인하고 이어 쓸게요',
  prefillClear: '지우고 새로 입력할게요',

  // P-03 내 이름
  nameTitle: '내 이름이나 애칭을 알려 주세요',
  nameHelp: '배우자에게도 이 이름으로 보여요',
  namePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',

  // P-03a 출생연도
  birthYear: (me: string) => `${me}님은 몇 년생이에요?`, // [확인 필요]

  // P-04 관리 방식 확인
  modeTitle: (starter: string) => `${starter}님이 고른 월급 관리 방식이에요`, // [확인 필요]
  modeHelp: '바꾸면 두 분 모두에게 적용돼요', // [확인 필요]
  modes: {
    separate: { label: '각자 월급을 따로 관리해요', sub: '분배표와 체크리스트가 사람마다 있어요' }, // [확인 필요]
    joint: { label: '합쳐서 같이 관리해요', sub: '둘의 월급을 한 분배표로 나눠요' }, // [확인 필요]
  },

  // P-05 내 월급(O-31과 같음)
  salary: '한 달에 월급이 얼마 들어와요?',
  salaryHelp: '세금 떼고 통장에 들어오는 돈이에요',
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '가장 적게 들어온 달을 기준으로 적어 주세요',
  noSalary: '지금은 월급이 없어요',
  payday: '월급날',
  paydayLast: '말일',
  checkValue: '입력한 값이 맞나요?',

  // P-06 월급 분배표
  splitTitle: '내 월급을 이렇게 나눠 볼까요?', // [확인 필요]
  splitJointTitle: '같이 쓰는 분배표예요', // [확인 필요]
  splitHelp: '금액을 눌러 바꿀 수 있어요',
  splitJointHelp: (me: string) => `${me}님 월급을 더해 다시 채웠어요`, // [확인 필요]
  splitDone: '이대로 할게요',
  partnerPuts: (starter: string, amount: string) => `${starter}님이 매달 ${amount} 넣어요`, // [확인 필요]
  incomes: (a: string, b: string) => `${a}, ${b}`, // [확인 필요] 합쳐서 수입 줄 아래
  personIncome: (name: string, amount: string) => `${name} ${amount}`,
  changed: (before: string, after: string) => `${before} → ${after}`,
  splitChanged: (starter: string) => `${starter}님이 방금 분배표를 바꿨어요`, // [확인 필요]
};
