// 파트너 합류 문구(docs/spec/18-partner-join.md, 15 A-07). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
/** 호칭이 있으면 “찬우님이”, 없으면 “파트너가”(2026-11-11 S3-29) */
const who = (name: string) => (name ? `${name}님이` : '파트너가');

export const copy = {
  // P-10 합류 축하(2026-11-11 D7) [확인 필요] 문구
  joinedTitle: (starter: string) => (starter ? `${starter}님과 연결됐어요` : '파트너와 연결됐어요'),
  joinedHelp: '이제 같이 모은 걸 같이 봐요', // [확인 필요] 2026-11-13 v2.2(예전 “이제 월급과 저금을 같이 봐요”)
  joinedWaitHelp: (starter: string) => `${who(starter)} 월급 계획을 만들면 알려 드릴게요`, // [확인 필요] 홈 대기 카드와 같음
  toHomeAfter: '홈으로 가기',
  // 합류가 끝난 초대(취소, 잡아 둔 24시간 지남, 2026-11-11 D1) [확인 필요]
  endedTitle: '초대가 취소됐거나 기한이 지났어요',
  endedHelp: '받은 코드를 다시 넣거나 혼자 시작할 수 있어요',
  startSolo: '혼자 시작하기',
  // P-11 알림 종류 골라 켜기(2026-11-13 v2.2, 18 P-11 표) [확인 필요]
  kindsTitle: '이런 알림을 보내 드려요',
  kinds: {
    care: '경조사 일주일 전',
    payday: '월급날 확인할 게 있을 때',
    achieved: '같이 모으기를 다 모았을 때',
    shared_change: (name: string) => `${name ? `${name}님이` : '파트너가'} 같이 쓰는 걸 바꿨을 때`,
    my_allowance: '내 용돈이 바뀌었을 때',
    progress_news: '진행 소식',
  },
  pushAllow: '알림 받기',
  // 대기 화면 ‘알려 주기’(18 v2.2, 24시간에 1번) [확인 필요]
  nudge: '알려 주기',
  nudgeSent: (starter: string) => `${starter ? `${starter}님` : '파트너'}에게 알렸어요`, // [확인 필요]
  nudgeTooSoon: '내일 다시 알릴 수 있어요', // [확인 필요]
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
  prefillTitle: (starter: string) => `${who(starter)} 미리 적어 둔 내 정보가 있어요`,
  prefillIncome: '월 수입', // [확인 필요] 항목명
  prefillOk: '확인하고 이어 쓸게요',
  prefillClear: '지우고 새로 입력할게요',

  // P-03 내 이름
  nameTitle: '내 이름이나 애칭을 알려 주세요',
  nameHelp: '파트너에게도 이 이름으로 보여요', // [확인 필요]
  namePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',

  // P-04 형태 확인(2026-11-13 v2.2, 18 ‘P-04 형태 확인’, 형태 이름 08 2장) [확인 필요]
  styleTitle: (starter: string) => `${who(starter)} 이렇게 골랐어요`,
  styleNames: {
    one_manager: '한 사람이 관리해요',
    together: '합쳐서 관리해요',
    living_saving: '생활비와 저금을 같이 해요',
    living_only: '생활비만 같이 해요',
    saving_only: '저금만 같이 해요',
    separate: '각자 따로 해요',
  },
  styleOk: '좋아요',
  styleSend: (starter: string) => `월급은 대부분 ${starter ? `${starter}님` : '파트너'}에게 보내요`,
  // P-05c 용돈(관리하지 않는 쪽, 18 v2.2) [확인 필요]
  allowanceTitle: '용돈은 얼마로 할까요?',
  allowanceHelp: (manager: string) => `나머지는 ${manager ? `${manager}님` : '파트너'}에게 보내요`,
  allowanceNote: (manager: string) =>
    `${manager ? `${manager}님` : '파트너'}도 용돈을 고칠 수 있어요. 고치면 알려 드려요`,
  allowanceOver: '월급보다 많이 정할 수 없어요', // [확인 필요] 0 ≤ 용돈 ≤ 월급
  // P-05 내 월급(O-31과 같음)
  salary: '한 달 실수령액은 얼마예요?',
  salaryHelp: '세금 떼고 통장에 들어오는 금액이에요', // [확인 필요] 2026-11-09 ‘들어오는 돈’ 대신
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '보통 들어오는 금액을 적어 주세요. 더 들어오면 그때 알려 주세요', // [확인 필요] O-31과 같음(2026-11-13)
  noSalary: '지금은 월급이 없어요',
  noSalaryJoin: '월급 없이 합류할게요', // [확인 필요] 각자 계열만(2026-11-13)
  payday: '월급날',
  paydayTitle: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayLastHint: '맨 아래에 ‘말일’도 있어요', // [확인 필요] 월급날 휠 아래
  paydayNone: '날짜가 정해져 있지 않아요', // [확인 필요] O-32와 같음(2026-11-13)
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
  splitChanged: (starter: string) => `${who(starter)} 방금 월급 계획을 바꿨어요`, // [확인 필요]
};
