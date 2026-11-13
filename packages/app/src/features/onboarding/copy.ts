import { subject } from '@sweetwo/core';

// 온보딩 문구(① docs/spec/16-onboarding-1.md, ② 17-onboarding-2.md ‘온보딩 ② v2.2’, 질문 패턴 12). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에도 [확인 필요]인 것.
// 2026-11-13 v2.2(ADR 0009): O-06 초대 화면 없앰(초대는 첫 저금 직후 O-07 시트), O-11 4지선다, O-30 세 질문, O-55 알림 허용,
// O-60 ‘첫 저금 만들기’
export const copy = {
  next: '다음',
  later: '나중에 할게요',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',

  // O-03 (Q5)
  myNickname: '내 이름이나 애칭을 알려 주세요',
  myNicknameHelp: '파트너에게도 이 이름으로 보여요', // [확인 필요]
  nicknamePlaceholder: '이름이나 애칭',
  nameRequired: '이름을 넣어 주세요',

  // O-07 초대 코드 시트(첫 저금 직후, 2026-11-13). 코드 상자·보내기 버튼·공유 글·복사 토스트는 shared/invite-share(S-12와 같음)
  inviteAfterSaving: '같이 모을 사람을 초대할까요?', // [확인 필요] 16 O-07, 17 O-60 4번
  sendLater: '나중에 보낼게요', // [확인 필요] 보내기 전 ‘다음’ 대신
  inviteFailed: '지금은 코드를 만들 수 없어요',
  inviteFailedTitle: '초대 코드를 만들지 못했어요', // [확인 필요] 2026-11-11 S3-27 발급 실패 시트 제목

  // O-11 두 사람 사이(2026-11-13 4지선다) [확인 필요]
  relation: '두 사람은 어떤 사이예요?',
  relationChoices: {
    married: '결혼했어요',
    engaged: '결혼 준비 중이에요',
    dating: '연애 중이에요',
    living_together: '같이 살아요',
  },

  // O-30·O-30b·O-30c 관리 형태 세 질문(17 v2.2, 08 2장) [확인 필요]
  sharedLiving: '같이 쓰는 생활비가 있어요?',
  sharedLivingHelp: '월세, 장보기, 데이트비처럼 둘이 같이 내는 돈이에요',
  sharedLivingChoices: { yes: '네', no: '아니요' },
  sharedSaving: '같이 모으는 저금이 있어요?',
  sharedSavingChoices: { yes: '네', no: '아직 없어요' },
  manager: '누가 주로 관리해요?',
  managerChoices: {
    me: '제가 주로 해요',
    /** 합류 전 ‘파트너가 주로 해요’, 합류 뒤 “{파트너}가 주로 해요” */
    partner: (partner: string) => `${partner ? subject(partner) : '파트너가'} 주로 해요`,
    together: '둘이 같이 해요',
    each: '각자 자기 월급으로 해요',
  },

  // O-31 월급(17 O-31) + 공개 고지(5번, 08 6장)
  salary: '한 달 실수령액은 얼마예요?',
  salaryHelp: '세금 떼고 통장에 들어오는 금액이에요', // [확인 필요] 2026-11-09 ‘들어오는 돈’ 대신
  salaryVariable: '매달 금액이 달라요',
  salaryVariableHelp: '보통 들어오는 금액을 적어 주세요. 더 들어오면 그때 알려 주세요', // [확인 필요] 2026-11-13
  noSalary: '지금은 월급이 없어요',
  // 2026-11-10 S2-02: ‘지금은 월급이 없어요’ 확인(되돌릴 수 있는 확인 → Modal primary)
  noSalaryQ: '월급 없이 시작할까요?', // [확인 필요]
  noSalaryHelp: '월급이 생기면 설정에서 넣을 수 있어요', // [확인 필요]
  noSalaryYes: '월급 없이 시작할게요', // [확인 필요]
  noSalaryNo: '다시 적을게요', // [확인 필요]
  // 2026-11-10 S2-07: 10만 원 미만이나 1억 원 초과면 한 번 확인(막지 않음)
  checkSalary: (amount: string) => `한 달에 ${amount}이 맞나요?`, // [확인 필요]

  // O-32
  payday: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayLastHint: '맨 아래에 ‘말일’도 있어요', // [확인 필요] O-32 휠 아래
  paydayShortMonth: '짧은 달은 말일로 계산해요', // 2026-11-10 S2-24, 12 Q4 예외 문구. 29~31일을 고르면 휠 아래
  paydayNone: '날짜가 정해져 있지 않아요', // [확인 필요] 2026-11-13 ‘매달 금액이 달라요’일 때만

  // O-55 알림 허용(2026-11-13) [확인 필요]
  pushPayday: (date: string) => `${date} 월급날 아침에 알려 드릴까요?`,
  pushPaydayHelp: '경조사 일주일 전에도 알려 드려요',
  pushNoDate: '경조사와 큰돈 나갈 날 일주일 전에 알려 드릴까요?',
  pushAllow: '알림 받기',

  // O-60 준비 끝(2026-11-13 고친 점) [확인 필요]
  readyTitle: (name: string) => `${name}님, 준비가 끝났어요`,
  readyDone: {
    split: '월급을 추천값으로 나눠 뒀어요',
    firstCheck: (date: string) => `${date} 월급날에 처음 확인해요`,
    noDate: '돈이 들어오면 홈에서 알려 주세요',
    salary: '월급이 생기면 홈에서 알려 주세요',
  },
  readyGo: '첫 저금 만들기',
};
