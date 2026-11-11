// 파트너 합류 문구(docs/spec/18-partner-join.md, 15 A-07). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // P-11 합류 직후 푸시 허용(모바일, 1회) [확인 필요] 문구
  pushTitle: '알림을 받을까요?',
  pushHelp: '파트너가 체크하거나 바꾸면 바로 알려 드려요', // [확인 필요]
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
  // P-01 코드 직접 입력(O-01 ‘코드 입력하기’)
  codeTitle: '받은 초대 코드를 넣어 주세요',
  codeHelp: '파트너가 보낸 6자리 코드예요', // [확인 필요]
  joinAs: (provider: string) => `${provider} 계정으로 합류해요`,
  otherAccount: '다른 계정',
  join: '합류하기',
  toHome: '홈으로 가기', // 2026-11-10 ‘이번 달로’ 대신(15 A-07 7번 ‘홈으로’, 주 버튼 말투)
  reenterCode: '코드 다시 입력하기', // [확인 필요] 로그인 전 합류 불가(2026-11-10)
  toStart: '처음으로', // [확인 필요] 로그인 전 합류 불가 보조 버튼
  // 초대 정보를 못 불러옴(13 공통 상태 6·7번)
  offlineTitle: '연결이 끊겼어요',
  offlineHelp: '다시 연결되면 이어서 볼 수 있어요',
  errorTitle: '잠시 문제가 생겼어요',
  errorHelp: '다시 시도해 주세요',
  cancel: '취소',
  errors: {
    expired: '초대가 만료됐어요. 새 코드를 요청해 주세요',
    invalid: '코드를 다시 확인해 주세요',
    locked: '10분 뒤에 다시 입력해 주세요',
    already_connected: '이미 우리 둘 공간이 연결돼 있어요', // [확인 필요]
    own_code: '내가 만든 초대 코드예요',
    used: '이미 합류가 끝난 초대예요',
    unavailable: '사용할 수 없는 초대예요',
  },
  hasRecords: '이미 시작한 기록이 있어요',
  hasRecordsHelp: '수입·자산 같은 내 정보만 옮겨요',
  // P-02a 혼자 쓰던 기록 옮기기
  moveTitle: '내 정보만 옮겨요',
  paydayDay: (d: number) => `${d}일`,
  moveVisLabel: (name: string) => `${name} 공개 범위`,
  moveVis: { all: '모두 보여 주기', sum: '금액만 보여 주기', private: '숨기기' } as Record<
    string,
    string
  >, // 2026-11-09 3단계
  moveNone: '옮길 정보가 없어요',
  moveDo: '옮겨요', // [확인 필요] 옮길 항목 묶음 이름(2026-11-03)
  moveSalaryLabel: '월급',
  moveDay: (day: string) => `월급날 ${day}`,
  moveSkipItems: { goals: '저금', splits: '월급 계획', lists: '체크리스트' }, // 2026-11-08 [확인 필요]
  moveCount: (n: number) => `${n}개`,
  moveSkip: '안 옮겨요',
  moveKeep: '30일 보관 후 지워져요',
  moveCopy: '사본 내려받기',

  // P-02b
  prefillTitle: (starter: string) => `${starter}님이 미리 적어 둔 내 정보가 있어요`,
  prefillIncome: '월 수입', // [확인 필요] 항목명
  prefillOk: '확인하고 이어 쓸게요',
  prefillClear: '지우고 새로 입력할게요',

  // P-03 내 이름
  nameTitle: '내 이름이나 애칭을 알려 주세요',
  nameHelp: '파트너에게도 이 이름으로 보여요', // [확인 필요]
  namePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',

  // P-04 관리 방식 확인
  modeTitle: (starter: string) => `${starter}님이 고른 월급 관리 방식이에요`, // [확인 필요]
  modeHelp: '바꾸면 두 분 모두에게 적용돼요', // [확인 필요]
  modes: {
    separate: {
      label: '각자 월급을 따로 관리해요',
      sub: '월급 계획과 체크리스트가 사람마다 있어요',
    }, // [확인 필요]
    joint: { label: '합쳐서 같이 관리해요', sub: '둘의 월급을 한 월급 계획으로 나눠요' }, // [확인 필요]
  },
  // P-04 다른 방식을 고르면 결과 한 줄 + 확인 Modal(2026-11-09 round 3) [확인 필요]
  modeResult: {
    joint: (starter: string) => `${starter}님 월급 계획이 두 분의 월급 계획 하나가 돼요`,
    separate: () => '월급 계획과 체크리스트가 사람마다 따로 생겨요',
  },
  modeConfirmTitle: '월급 관리 방식을 바꿀까요?',
  modeConfirmBody: (starter: string) => `${starter}님에게도 바로 적용되고 알림이 가요`,
  modeConfirmOk: '바꿀게요',
  modeConfirmCancel: '다시 고를게요',

  // P-05 내 월급(O-31과 같음)
  salary: '한 달 실수령액은 얼마예요?',
  salaryHelp: '세금 떼고 통장에 들어오는 금액이에요', // [확인 필요] 2026-11-09 ‘들어오는 돈’ 대신
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '가장 적게 들어온 달을 기준으로 적어 주세요',
  noSalary: '지금은 월급이 없어요',
  payday: '월급날',
  paydayTitle: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayLastHint: '맨 아래에 ‘말일’도 있어요', // [확인 필요] 월급날 휠 아래
  checkValue: '입력한 값이 맞나요?',

  // P-06 월급 계획
  splitTitle: '내 월급을 이렇게 나눠 볼까요?', // [확인 필요]
  splitJointTitle: '같이 쓰는 월급 계획이에요', // [확인 필요]
  splitHelp: '눌러서 금액을 바꿔요',
  splitJointHelp: (me: string) => `${me}님 월급을 더해 다시 채웠어요`, // [확인 필요]
  splitDone: '이대로 저장하기',
  partnerPuts: (starter: string, amount: string) => `${starter}님이 매달 ${amount} 넣어요`, // [확인 필요]
  incomes: (a: string, b: string) => `${a}, ${b}`, // [확인 필요] 합쳐서 수입 줄 아래
  personIncome: (name: string, amount: string) => `${name} ${amount}`,
  changed: (before: string, after: string) => `${before} → ${after}`,
  splitChanged: (starter: string) => `${starter}님이 방금 월급 계획을 바꿨어요`, // [확인 필요]
};
