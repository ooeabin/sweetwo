// 온보딩 문구(① docs/spec/16-onboarding-1.md, ② 17-onboarding-2.md, 질문 패턴 docs/spec/12-question-pattern.md). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것(기획서에도 [확인 필요]).
// 2026-11-10 QA 2구간: O-10 첫 화면, O-12 결혼한 날·예정일, O-13 출생연도, 이어하기 질문 화면과 없앤 화면 문구를 지움
export const copy = {
  next: '다음',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',

  // O-03 (Q5)
  myNickname: '내 이름이나 애칭을 알려 주세요',
  myNicknameHelp: '파트너에게도 이 이름으로 보여요', // [확인 필요]
  nicknamePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',
  // O-06, O-07
  inviteNow: '같이 쓸 사람을 초대할까요?',
  inviteNowHelp: '월급과 저금을 둘이 같이 볼 수 있어요', // [확인 필요] 2026-11-08
  // 2026-11-10 S2-17: 선택지는 대답이라 해요체(버튼 말투 규칙)
  inviteChoices: { now: '지금 초대할게요', later: '나중에 할게요' }, // [확인 필요] now
  inviteTitle: '이 코드를 보내 주세요',
  copyLink: '링크 복사',
  tapToCopy: '눌러서 복사', // [확인 필요] 코드 상자 아래
  sendLater: '나중에 보낼게요', // [확인 필요] 보내기 전 ‘다음’ 대신
  // 2026-11-10 S2-05: 기기 공유 창(카카오톡 등)으로 보냄
  sendKakao: '카톡으로 보내기',
  /** 공유 글(2026-11-10 S2-05) */
  shareText: (name: string, code: string, link: string) =>
    `${name}님이 sweeTwo에 초대했어요. 초대 코드 ${code} ${link}`, // [확인 필요]
  inviteFailed: '지금은 코드를 만들 수 없어요',
  copied: '복사했어요', // [확인 필요] 복사 토스트

  // O-60 준비 끝(2026-11-02 다시 둠) [확인 필요]
  readyTitle: (name: string) => `${name}님, 준비가 끝났어요`,
  readyDone: {
    split: '월급을 추천값으로 나눠 뒀어요',
    checklist: (day: string) => `${day} 월급 체크리스트를 만들었어요`,
    goal: '첫 저금은 체크리스트에서 추가해요', // [확인 필요] 2026-11-10 S2-20
    salary: '월급이 생기면 홈에서 알려 주세요',
  },
  readyGo: '홈으로 가기',

  // O-11
  married: '두 사람은 어떤 사이예요?',
  // [확인 필요] 제목을 결혼 여부에서 관계로 바꾸면서 답도 ‘결혼’을 넣어 다듬음, 세 번째 답 추가(2026-11-02)
  marriedChoices: {
    married: '결혼했어요',
    engaged: '결혼 준비 중이에요',
    undecided: '아직 안 정했어요',
  },

  // O-32
  payday: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayLastHint: '맨 아래에 ‘말일’도 있어요', // [확인 필요] O-32 휠 아래
  paydayShortMonth: '짧은 달은 말일로 계산해요', // 2026-11-10 S2-24, 12 Q4 예외 문구. 29~31일을 고르면 휠 아래

  // 온보딩 ②: O-30 월급 관리 방식, O-31 월급(17-onboarding-2.md)
  salaryMode: '월급을 어떻게 관리해요?', // [확인 필요]
  salaryModeHelp: '나중에 바꿀 수 있어요', // [확인 필요]
  salaryModes: {
    separate: {
      label: '각자 월급을 따로 관리해요',
      sub: '월급 계획과 체크리스트가 사람마다 있어요',
    }, // [확인 필요]
    joint: { label: '합쳐서 같이 관리해요', sub: '둘의 월급을 한 월급 계획으로 나눠요' }, // [확인 필요]
  },
  salary: '한 달 실수령액은 얼마예요?',
  salaryHelp: '세금 떼고 통장에 들어오는 금액이에요', // [확인 필요] 2026-11-09 ‘들어오는 돈’ 대신
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '가장 적게 들어온 달 기준으로 적어 주세요', // [확인 필요]
  noSalary: '지금은 월급이 없어요',
  // 2026-11-10 S2-02: ‘지금은 월급이 없어요’ 확인(되돌릴 수 있는 확인 → Modal primary)
  noSalaryQ: '월급 없이 시작할까요?', // [확인 필요]
  noSalaryHelp: '월급이 생기면 설정에서 넣을 수 있어요', // [확인 필요]
  noSalaryYes: '월급 없이 시작할게요', // [확인 필요]
  noSalaryNo: '다시 적을게요', // [확인 필요]
  // 2026-11-10 S2-07: 10만 원 미만이나 1억 원 초과면 한 번 확인(막지 않음)
  checkSalary: (amount: string) => `한 달에 ${amount}이 맞나요?`, // [확인 필요]
};
