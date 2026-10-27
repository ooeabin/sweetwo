import { object } from '@sweetwo/core';

// 온보딩 문구(① docs/spec/16-onboarding-1.md, ② 17-onboarding-2.md, 질문 패턴 docs/spec/12-question-pattern.md). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // 온보딩 이어하기(16 ‘답은 화면마다 저장’, 12 Q 이어하기)
  resumeQ: '이어서 할까요?',
  resumeHelp: '멈춘 곳부터 이어서 해요. 적어 둔 답은 그대로예요', // [확인 필요]
  resumeGo: '이어서 할게요', // [확인 필요]
  next: '다음',
  unsure: '잘 모르겠어요',
  unsureLater: '잘 모르겠어요, 나중에 적을게요', // [확인 필요] 금액 칸 보조 링크(구간 골라 추정 + 할 일)
  checkValue: '입력한 값이 맞나요?',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  estimated: '추정',

  // O-03, O-05 (Q5)
  myNickname: '내 이름이나 애칭을 알려 주세요',
  myNicknameHelp: '배우자에게도 이 이름으로 보여요',
  nicknamePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',
  // O-06, O-07
  inviteNow: '같이 쓸 사람을 초대할까요?',
  inviteNowHelp: '목표와 월급을 둘이 같이 볼 수 있어요', // [확인 필요]
  inviteChoices: { now: '초대하기', later: '나중에 할게요' },
  inviteTitle: '이 코드를 보내 주세요',
  inviteValid: '7일 동안 쓸 수 있어요',
  copyLink: '링크 복사',
  sendKakao: '카톡으로 보내기',
  inviteFailed: '지금은 코드를 만들 수 없어요',
  copied: '복사했어요', // [확인 필요] 복사 토스트

  // O-10 온보딩 첫 화면(챕터 4개 안내), O-20·O-30·O-50 챕터 시작(Q7)
  overviewTitle: '2분이면 우리의 첫 목표가 생겨요', // [확인 필요]
  overviewHelp: '목표와 월급만 알려 주세요', // [확인 필요]
  overviewEditable:
    '입력하신 내용은 나중에 언제든 자유롭게 수정할 수 있으니, 편하게 작성해 주세요!',
  chapterStart: '시작할게요',
  edit: '수정',

  // O-11
  married: '결혼은 하셨나요?',
  marriedChoices: { married: '했어요', engaged: '준비 중이에요' },
  cancel: '취소',

  // O-12
  weddingDone: '결혼한 날은 언제예요?',
  weddingPlanned: '결혼 예정일은 언제예요?',
  undecided: '아직 미정이에요',
  skipDate: '건너뛸게요', // [확인 필요]
  whenPlanned: '언제쯤 예정이에요?',
  noDate: '없는 날짜예요',
  pastOnly: '오늘까지의 날짜를 넣어 주세요', // [확인 필요]
  futureOnly: '내일부터의 날짜를 넣어 주세요', // [확인 필요]

  // O-13
  birthYear: (me: string) => `${me}님은 몇 년생이에요?`, // [확인 필요]
  // O-21
  goalsTitle: '둘이 가장 먼저 이루고 싶은 건 뭐예요?',
  goalsHelp: '고른 순서가 우선순위가 돼요', // [확인 필요]
  autoEmergency: '비상금은 자동으로 들어가요',
  recommended: '추천',
  makeOwn: '+ 직접 만들기',
  picked: (n: number) => `${n}개 골랐어요`,
  onlyEmergency: '비상금만 먼저 모을게요',
  goalTabsLabel: '목표 분류',

  // O-23, O-24
  first: '1순위',
  saveRatio: (manText: string) => `${manText}을 모아요`,
  yearsLater: (n: number) => `${n}년 뒤`,
  monthlyNeed: (manText: string) => `매달 ${manText}씩 모으면 돼요`,
  needFormula: (left: string, months: number) => `${left} ÷ ${months}개월`,
  goalDeadline: '언제까지 모을까요?', // [확인 필요] O-24 질문 문구
  notBeforeThisYear: (y: number) => `${y}년부터 넣어 주세요`, // [확인 필요]
  yearTotal: (manText: string) => `1년에 모두 ${manText} 원`,

  // O-32, O-33
  payday: '월급날은 며칠이에요?',
  paydayLast: '말일',
  partnerIncome: (partner: string) => `${partner}님 수입은 한 달에 어느 정도예요?`,
  // O-36
  add: '추가', // [확인 필요]
  // O-51, O-52 (파트 5)
  later: '나중에 할게요',
  splitHelp: (amount: string) => `한 달 ${amount}을 두 분이 나눠 넣어요`,
  // 결과 카드 금액 아래 한 줄 [확인 필요]
  whoMine: (me: string) => `${me}님`,
  // O-64
  expected: (ym: string) => `${ym} 달성 예상`,
  // O-66
  myPayday: (me: string) => `${me}님 월급날`,
  // O-66 조건 요약 판 [확인 필요]
  start: '시작하기',

  // 재기획(ADR 0003) 온보딩 ②: O-30 월급 관리 방식, O-31 월급, O-50 월급 분배표, O-60 결과(17-onboarding-2.md)
  salaryMode: '월급을 어떻게 관리해요?', // [확인 필요]
  salaryModeHelp: '나중에 설정에서 바꿀 수 있어요', // [확인 필요]
  salaryModes: {
    separate: { label: '각자 월급을 따로 관리해요', sub: '분배표와 체크리스트가 사람마다 있어요' }, // [확인 필요]
    joint: { label: '합쳐서 같이 관리해요', sub: '둘의 월급을 한 분배표로 나눠요' }, // [확인 필요]
  },
  salary: '한 달에 월급이 얼마 들어와요?',
  salaryHelp: '세금 떼고 통장에 들어오는 돈이에요',
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '가장 적게 들어온 달 기준으로 적어 주세요', // [확인 필요]
  noSalary: '지금은 월급이 없어요',
  splitTitle: '월급을 이렇게 나눠 볼까요?',
  splitTableHelp: '금액을 눌러 바꿀 수 있어요', // [확인 필요]
  splitIncome: (man: string) => `월급 ${man}`,
  savingGroup: '저금',
  spendGroup: '쓰는 돈',
  lineNames: { fixed: '고정지출', living: '생활비', allowance: '용돈' },
  fixedSub: '월세·관리비·보험·통신·대출 상환처럼 매달 정해진 돈', // [확인 필요]
  livingSub: '식비·장보기처럼 쓰는 대로 나가는 돈', // [확인 필요]
  needPerMonth: (man: string) => `매달 ${man}이 필요해요`,
  addLine: '+ 줄 추가',
  newLineName: '줄 이름', // [확인 필요] 직접 추가 줄 이름 칸
  newLinePlaceholder: '예: 부모님 용돈',
  removeLine: '줄 지우기', // [확인 필요]
  lineAmount: (name: string) => `${name} 금액`,
  tenThousandUnit: '1만 원 단위로 넣어 주세요', // [확인 필요]
  leftover: (man: string) => `남는 돈 ${man}`,
  short: (man: string) => `${man}이 모자라요`,
  shortHelp: '쓰는 돈이나 저금을 줄여 주세요',
  splitDone: '이대로 할게요',
  resultTitle: (monthly: string, when: string, goal: string) =>
    `매달 ${monthly}씩 모으면 ${when}에 ${object(goal)} 이뤄요`, // [확인 필요]
  resultNoSaving: '분배표에서 저금을 정하면 언제 이룰지 알려 드려요',
  resultLate: (n: string) => `목표 기한보다 ${n} 늦어요`,
  resultOnTime: '목표 기한 안에 이뤄요',
  resultLateHelp: '분배표에서 저금을 늘리면 앞당길 수 있어요',
  resultTodo: (day: string) => `월급날(${day})에 분배표대로 보내고 체크해 주세요`, // [확인 필요]
  resultStart: '시작할게요',
  years: (n: number) => `${n}년`,
  months: (n: number) => `${n}개월`,
};
