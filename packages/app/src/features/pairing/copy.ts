// 배우자 합류 문구(docs/spec/18-partner-join.md, 15 A-07). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  next: '다음',
  retry: '다시 시도',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  estimated: '추정',

  // P-01 / A-07
  invited: (inviter: string) => `${inviter}님이 초대했어요`,
  invitedHelp: '둘이 같이 쓰는 공간에 합류해요',
  codeLabel: '초대 코드', // [확인 필요] 화면 읽기용
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

  // P-02b
  prefillTitle: (starter: string) => `${starter}님이 미리 적어 둔 내 정보가 있어요`,
  prefillIncome: '월 수입', // [확인 필요] 항목명
  prefillOk: '확인하고 이어 쓸게요',
  prefillClear: '지우고 새로 입력할게요',

  // P-03
  nicknameOk: (name: string) => `‘${name}’이 맞나요?`,
  nicknameLabel: '호칭', // [확인 필요] 화면 읽기용
  right: '맞아요',
  nameRequired: '이름을 넣어 주세요',

  // P-04
  profileTitle: '출생연도와 일하는 방식이 맞나요?',
  profileAsk: '출생연도와 일하는 방식을 알려주세요', // [확인 필요] 비어 있을 때
  profileLine: (year: number, work: string) => `${year}년생 ${work}`,
  fix: '고칠게요',
  birthYearLabel: '출생연도', // [확인 필요]
  workLabel: '일하는 방식', // [확인 필요]
  works: {
    regular: '정규직',
    contract: '계약직',
    freelance: '프리랜서·사업자',
    resting: '쉬는 중',
  },
  from1950: '1950년부터 입력해 주세요',
  adultsOnly: '만 18세부터 쓸 수 있어요',

  // P-05
  income: '한 달에 얼마 받으세요?',
  incomeFromStarter: (starter: string) => `${starter}님이 적어 둔 값이에요`,
  incomeHelp: '세금 떼고 통장에 들어오는 돈이에요',
  incomeLow: '최근 몇 달 중 가장 적게 번 달은 얼마였어요?',
  incomeLowHelp: '이 금액이 기준 수입이 돼요',
  noIncome: '지금은 수입이 없어요',
  payday: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayShortMonth: '짧은 달은 말일로 계산해요', // [확인 필요] O-32와 같음
  checkValue: '입력한 값이 맞나요?',

  // P-07, P-08
  allowance: (me: string) => `${me}님 용돈은 한 달에 얼마로 할까요?`,
  split: '같이 쓰는 돈 나누는 방식, 괜찮아요?',
  splitModes: { half: '반반', income: '버는 만큼', custom: '직접 정할게요' },
  good: '좋아요',
  differently: '다르게 해볼래요',
  proposeTo: (name: string) => `${name}님께 제안하기`,
  applyNote: (date: string) => `좋아요면 바로, 반대 없으면 ${date}부터 적용돼요`,

  // P-10
  changes: '합류 전에 바뀐 것과 목표예요',
  noGoals: (starter: string) => `${starter}님이 목표를 정하면 여기에 보여요`,
  allGood: '모두 좋아요',

  // P-11
  done: (amount: string) => `두 분은 한 달에 ${amount}을 모을 수 있어요`,
  incomeCard: '월 수입',
  saveCard: '한 달에 모을 수 있는 돈',
  shareCard: '매달 나눠 넣을 돈',
  before: '이전', // [확인 필요] 화면 읽기용(취소선 값)
  waiting: '답 기다리는 제안', // [확인 필요] 요소 이름
  planKept: (month: number) => `${month}월 월급 플랜은 그대로, 안 나눈 돈만 다시 계산했어요`,
};
