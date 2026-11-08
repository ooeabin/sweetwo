import { topic } from '@sweetwo/core';

// 우리 자산 문구(docs/spec/23-assets.md F-01~F-04). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // 충돌 선택(13 공통 상태 11번)
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
  title: '우리 자산',
  add: '+ 추가',
  retry: '다시 시도',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  back: '뒤로',
  tabs: { overview: '한눈에', items: '자산·부채', diagnosis: '재정 진단' },
  tabsLabel: '우리 자산 보기', // [확인 필요] 화면 읽기용

  // F-01
  netWorth: '순자산',
  // 2026-11-03 F-01 다시 짬 [확인 필요]
  ourNetWorth: '우리 순자산',
  lastMonth: '지난달보다',
  grew: '늘었어요',
  shrank: '줄었어요',
  monthly: '달마다 순자산',
  gainIncl: (amount: string) => `안 판 수익 ${amount} 포함`,
  netWorthValue: (amount: string) => `순자산 ${amount}`,
  expected: (amount: string) => `예상 순자산 ${amount}`,
  gain: (amount: string) => `안 판 수익 ${amount}`,
  up: (amount: string) => `지난달보다 ${amount} 늘었어요`,
  down: (amount: string) => `지난달보다 ${amount} 줄었어요`,
  assets: (amount: string) => `자산 ${amount}`,
  debts: (amount: string) => `부채 ${amount}`,
  assetsLabel: '자산',
  debtsLabel: '부채',
  empty: '자산을 적으면 순자산을 보여 드려요', // 23 빈 상태(홈 H-04와 같음)
  graphLabel: '순자산 그래프', // [확인 필요] 화면 읽기용
  periodsLabel: '기간', // [확인 필요] 화면 읽기용
  periods: ['6개월', '1년', '3년', '전체'],
  expectedName: '예상 순자산',
  expectedShort: (amount: string) => `예상 ${amount}`,
  summaryEmpty: '첫 월말 정리 뒤에 보여드려요',
  addAsset: '자산 추가',
  emptyAdd: '자산 추가하기', // 23 빈 상태

  // F-02
  noDebt: '갚을 돈이 없어요',
  addDebt: '+ 부채 추가',
  joint: '공동',
  proxy: '대신 입력',
  vis: { all: '모두 보여 주기', sum: '금액만 보여 주기', private: '숨기기' },
  partnerPill: '금액만', // [확인 필요]
  visShort: { all: '', sum: '금액만', private: '숨김' }, // 2026-11-04 목록 배지는 짧게(파트너 합계 줄 ‘금액만’과 같게) [확인 필요]
  partnerSum: (name: string, side: string, n: number) => `${name}님 ${side} ${n}개`,
  checkAmount: '금액이 맞나요?',
  updated: (date: string) => `${date} 수정`, // [확인 필요]
  sortLabel: '정렬', // [확인 필요] 화면 읽기용
  sorts: { name: '이름', owner: '명의', amount: '금액', updated: '수정일' },
  sortDir: (name: string, asc: boolean) => `${name}, ${asc ? '오름차순' : '내림차순'}`, // [확인 필요] 화면 읽기용
  investGainLabel: '안 판 수익', // 23 F-02 9번 투자 묶음 줄 이름(2026-11-04, 투자 비중 줄 없앰. F-04 7번과 같은 말)
  investGain: (amount: string, pct: number | null) =>
    pct === null ? amount : `${amount}(${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%)`,

  // F-03
  addTitle: '무엇을 추가할까요?', // [확인 필요] 화면 목록의 이름
  sideLabel: '자산·부채', // [확인 필요] 화면 읽기용
  groupLabel: '묶음', // [확인 필요] 화면 읽기용
  nameTitle: '이름을 정해주세요',
  nameRequired: '이름을 넣어 주세요',
  amountAsset: '현재 금액은 얼마예요?',
  amountDebt: '남은 대출금은 얼마예요?',
  ownerTitle: '누구 명의예요?',
  ownerMe: '나',
  visTitle: '파트너에게 공개할까요?', // [확인 필요]
  visOptions: { all: '모두 보여 주기', sum: '금액만 보여 주기', private: '숨기기' },
  next: '다음',
  save: '추가하기', // [확인 필요]
  sameName: '같은 이름이 있어요. 그래도 추가할까요?',
  addedUp: (amount: string) => `추가했어요. 순자산이 ${amount} 늘었어요`,
  addedDown: (amount: string) => `추가했어요. 순자산이 ${amount} 줄었어요`, // [확인 필요] 부채
  added: '추가했어요', // [확인 필요] 숨기기는 합계에 없음

  // F-05 월 수입·지출
  moneyTitle: '월 수입·지출', // [확인 필요] 화면 이름
  incomeSection: '월 수입',
  spendSection: '지출',
  person: (name: string, amount: string) => `${name} ${amount}`,
  payday: (day: string) => `월급날 ${day}`,
  baseIncome: '기준 수입',
  estimatedTag: '추정',
  allowance: '용돈',
  allowanceEach: (a: string, b: string) => `${a}, ${b}`,
  fixed: '고정지출',
  loan: '대출 상환', // [확인 필요]
  living: '생활비',
  saveable: '저축 가능 금액',
  short: (amount: string) => `${amount} 모자라요`,
  shortAsk: '어느 항목을 줄여볼까요?',
  periodChange: '기간 정해서 바꾸기',
  savedRecalc: '저장했어요. 안 나눈 돈을 다시 계산했어요',
  savedNoPending: '안 나눈 돈이 없어 월말 정리에서 맞춰요',
  previewUp: (amount: string) => `저축 가능 금액이 월 ${amount} 늘어요`, // [확인 필요] 기획서는 줄어요만
  previewDown: (amount: string) => `저축 가능 금액이 월 ${amount} 줄어요`,
  proposeTo: (name: string) => `${name}님께 제안하기`,
  proposed: (name: string) => `${name}님에게 제안했어요`,
  editMoney: '월 수입·지출 수정',

  // F-06 재정 진단
  diagTitle: '재정 진단',
  diagSummary: (good: number, total: number) => `${total}개 중 ${good}개 양호`,
  diagSaving: (pct: number) => `월 수입의 ${pct}%를 저축하고 있어요`,
  diagSavingUnknown: '월말 정리를 하면 계산해요', // [확인 필요]
  // 비상금 카드, F-09 넣기·꺼내기 [확인 필요]
  emergencyTitle: '비상금',
  emergencyOf: (held: string, base: string) => `${held} / 기준 ${base}`,
  emergencyIn: '+ 넣기',
  emergencyInBtn: '넣기',
  emergencyOut: '- 꺼내기',
  emergencyInQ: '비상금에 얼마 넣었어요?',
  emergencyOutQ: '비상금에서 얼마 꺼냈어요?',
  emergencyWhy: '어디에 썼어요?',
  emergencyReasons: {
    hospital: '병원',
    repair: '수리',
    family_event: '경조사',
    living_short: '생활비 부족',
    etc: '기타',
  },
  emergencySkipWhy: '건너뛰기',
  emergencyMoved: (kind: 'in' | 'out', amount: string) =>
    kind === 'in' ? `비상금에 ${amount}을 넣었어요` : `비상금에서 ${amount}을 꺼냈어요`,
  emergencyOver: (balance: string) => `지금 비상금은 ${balance}이에요`,
  diagEmergency: (months: number) => `비상금으로 ${months}개월 생활할 수 있어요`,
  diagEmergencyMore: (months: number) => `${months}개월분까지 모아봐요`,
  diagLoan: (pct: number) => `월 수입의 ${pct}%를 대출 상환에 쓰고 있어요`,
  diagNoLoan: '대출이 없어요',
  diagFixed: (pct: number) => `월 수입의 ${pct}%가 고정지출이에요`,
  diagInvestNone: '아직 정하지 않았어요',
  diagInvestWait: (partner: string) => `${partner}님 답을 기다려요`,
  diagInvestMine: '내 답을 기다려요', // [확인 필요] 파트너만 답했을 때
  diagInvestBoth: (limit: number) =>
    limit === 0
      ? '공동자금은 원금을 지키기로 했어요'
      : `공동자금은 ${limit}%까지 투자하기로 했어요`, // [확인 필요]

  // 첫 주 자산·대출 정리(17 O-41~47)
  weekAssets: '지금 자산을 골라주세요',
  weekAccountsIn: (n: number) => `쓰던 통장 ${n}개는 이미 넣어뒀어요`,
  weekAssetAmount: (name: string) => `${topic(name)} 얼마예요?`,
  weekLumpNone: '아직 정하지 않았어요',
  weekRecommend: '추천',
  weekLoans: '갚고 있는 대출이 있나요?',
  weekNoLoan: '없어요',
  weekNoLoanCheck: (amount: string) =>
    `처음에 대출 상환이 월 ${amount}이라고 했어요. 대출이 정말 없나요?`, // [확인 필요] O-39 확인 1회
  weekLoanAmount: (name: string) => `${name} 남은 돈은요?`,
  weekRateUnknown: '잘 모르겠어요',
  weekRateAvg: (rate: number) => `평균 금리 ${rate}%로 셀게요`, // [확인 필요]
  weekPayment: '한 달에 얼마씩 갚아요?',
  weekCount: (name: string, i: number, n: number) => `${name} ${i}/${n}`,
  weekClose: '닫기',
  weekOwner: '누구 돈이에요?', // [확인 필요] 소유자 토글 이름(화면 읽기용)
  weekTogether: '같이',
  weekAssetsDone: '자산을 정리했어요', // [확인 필요]
  weekLoansDone: '대출을 정리했어요', // [확인 필요]

  // 첫 주 고정지출 나누기·생활비 카드(17 O-37, O-38b)
  weekFixedPick: '어디에 나가는 돈이에요?', // [확인 필요] O-37 세부 항목 고르기
  weekFixedPickHelp: '고른 항목마다 금액을 물어요', // [확인 필요]
  weekFixedAmount: (name: string) => `${name}에 한 달에 얼마 나가요?`,
  weekFixedNone: '같이 내는 고정지출이 없어요', // [확인 필요] 물을 항목이 없을 때
  weekCard: '생활비는 주로 신용카드로 쓰나요?',
  weekCardYes: '네',
  weekCardNo: '아니요',
  weekFixedDone: '고정지출을 정리했어요', // [확인 필요]

  // 첫 주 상여금·다른 수입(17 O-34, O-35, O-35b)
  weekBonus: '상여금이나 성과급도 있나요?',
  weekBonusYes: '있어요',
  weekBonusNo: '없어요',
  weekBonusList: '보통 몇 월에 얼마쯤 받아요?',
  weekBonusTotal: (man: string) => `1년에 ${man} 원 받아요`,
  weekBonusName: '상여금',
  weekIncome: '월급 말고 들어오는 돈이 또 있나요?',
  weekIncomeKinds: { side_job: '부업·N잡', rent: '월세·임대 수입', support: '정부 지원금' },
  weekIncomeAmount: (name: string) => `${topic(name)} 한 달에 얼마쯤이에요?`, // [확인 필요] 항목별 월 금액
  weekIncomeLow: '들쭉날쭉하면 적게 벌 때 기준으로 적어 주세요', // [확인 필요] 변동 수입 기준
  weekRestDone: '들어오는 돈을 정리했어요', // [확인 필요]
  incomeEvents: '들어오는 돈', // W-07
  otherIncomeIn: (amount: string) => `다른 수입 ${amount} 포함`, // [확인 필요] F-05 내 수입 보조 줄

  // O-53 투자 원칙
  principleTitle: '같이 모은 돈, 투자는 어느 정도까지 괜찮아요?',
  principleOptions: {
    keep: '원금은 지켜야 해요',
    some: '조금은 괜찮아요',
    active: '일부는 적극적으로',
    unsure: '잘 모르겠어요',
  },
  principleLimit: (limit: number) => (limit === 0 ? '투자하지 않아요' : `공동자금의 ${limit}%까지`), // [확인 필요] 선택지 보조 줄
  principlePartner: (partner: string, answer: string) =>
    `${partner}님은 ‘${answer}’를 골랐어요. 다르면 더 조심스러운 쪽으로 정해요`, // [확인 필요]
  principleSaved: '투자 원칙을 정했어요', // [확인 필요]
  diagPrivate: '비공개 항목은 계산에서 빠졌어요',
  diagGoDebt: '부채 목록',
  diagGoMoney: '월 수입·지출',
  diagGoInvest: '지금 정하기',
  diagIncomeUnknown: '월 수입을 적으면 계산해요', // [확인 필요]

  // F-03f~i
  later: '나중에 할게요',
  maturity: '만기일은 언제예요?',
  contractEnd: '계약 만기일은요?',
  paidCount: '납입 회차는요?',
  paidCountUnit: '회', // [확인 필요]
  payment: '월 납입액은요?',
  repayment: '월 상환액은요?',
  rate: '금리는 몇 %예요?',
  rateError: '0~100 사이로 넣어 주세요', // [확인 필요]

  // F-04a 만기된 돈 정리
  maturedTitle: '만기된 돈은 어디로 옮겼어요?',
  maturedMoved: '다른 통장으로', // [확인 필요]
  maturedRejoin: '다시 가입했어요', // [확인 필요]
  maturedPick: '어느 통장으로 옮겼어요?', // [확인 필요]
  maturedNoAccount: '옮길 통장이 없어요. 먼저 통장을 추가해 주세요', // [확인 필요]
  // F-04b~d 팔았어요
  sold: '팔았어요',
  unsure: '잘 모르겠어요',
  marketEdit: '시세 바꾸기',
  soldAmount: '받은 금액은 얼마예요?',
  // 2026-11-03 먼저 묻기(전부 / 일부만), 금액은 화면마다 하나
  soldHow: '얼마나 팔았어요?', // [확인 필요]
  soldAll: '전부 팔았어요', // [확인 필요]
  soldPart: '일부만 팔았어요',
  soldPartSub: '남은 평가금액도 물어볼게요', // [확인 필요]
  soldRemain: '남은 평가금액은 얼마예요?',
  soldTo_q: '받은 돈은 어느 통장에 들어왔어요?', // [확인 필요]
  soldDone: '팔았어요', // [확인 필요] 결과 제목
  toList: '목록으로 가기', // [확인 필요] F-04d 주 버튼(2026-11-03)
  soldTo: (name: string, amount: string) => `${name} +${amount}`,
  soldGain: (v: string) => `실현 손익 ${v}`,
  ok: '확인',
  graph: '금액 그래프', // [확인 필요] 요소 이름
  editedBy: (date: string, name: string) => `${date} ${name}`,
  maturedDone: '정리했어요', // [확인 필요]
  maturedDateError: '오늘 뒤 날짜를 넣어 주세요', // [확인 필요]

  // F-04
  amountLabel: '금액', // [확인 필요]
  visLabel: '공개 범위', // [확인 필요]
  edit: '수정',
  amountEdit: '금액 고치기', // [확인 필요] 2026-11-04 F-04 1번 보조 버튼
  cancel: '취소',
  rateInvalid: '0~30% 사이로 적어 주세요', // [확인 필요]
  countInvalid: '숫자만 적어 주세요', // [확인 필요]
  saveEdit: '저장',
  remove: '삭제',
  removed: '휴지통으로 옮겼어요',
  undo: '되돌리기',
  saved: '저장했어요', // [확인 필요]
  readOnly: (name: string) => `${name}님 항목이라 볼 수만 있어요`,
  history: '고친 기록', // 23 F-04 5번
  historyEmpty: '아직 고친 기록이 없어요', // [확인 필요]
  createdLabel: '처음 적은 날', // [확인 필요]
  menu: '항목 메뉴',
  fromClose: '월말 정리',
  fromManual: '직접 수정',
  principal: (amount: string) => `원금 ${amount}`,
  owner: '명의', // [확인 필요]
  maturityLabel: '만기일', // [확인 필요]
  paymentLabel: '월 납입액', // [확인 필요]
  repaymentLabel: '월 상환액', // [확인 필요]
  monthlyRepay: (v: string) => `매달 ${v}`, // [확인 필요] F-02 부채 줄 보조
  rateLabel: '금리', // [확인 필요]
  countLabel: '납입 회차', // [확인 필요]

  // F-05f·F-05g 기간 수입 변경
  periodStart: '언제부터 바뀌어요?', // [확인 필요] 기간 시작 질문
  periodEnd: '언제까지예요?', // [확인 필요] 기간 끝 질문
  periodEndBefore: '시작한 달 뒤로 골라 주세요', // [확인 필요]
  periodPast: '이번 달부터 고를 수 있어요', // [확인 필요]
  periodAmount: '그 기간 월 수입은 얼마예요?',
  periodNoIncome: '수입이 없어요',
  // F-07a·b 계획 다시 세우기
  replanAsk: '계획을 다시 세워볼까요?',
  replanGo: '다시 세우기', // [확인 필요] 토스트 버튼
  replanWhat: '어떤 게 바뀌었나요?',
  replanIncome: (name: string) => `${name}님 한 달 수입은 얼마예요?`, // [확인 필요] O-31과 같은 질문
  replanFixed: '고정지출은 한 달에 얼마예요?', // [확인 필요] 이사: O-36과 같은 질문
  replanLiving: '생활비는 한 달에 얼마로 할까요?', // [확인 필요] 출산: O-37과 같은 질문
  // F-07c 비교·적용
  compareTitle: '바뀌는 점을 확인해 주세요', // [확인 필요] 화면 제목
  compareNow: '지금',
  compareAfter: '변경 후', // [확인 필요] 열 이름(일반)
  comparePeriod: (range: string) => range,
  compareRows: {
    income: '월 수입',
    supplement: '비상금에서 보충',
    saveable: '저축 가능 금액',
    emergency: '비상금 잔액',
    split: '분담',
    allowance: '용돈',
  },
  tagNow: '바로 반영',
  tagPropose: '제안',
  perMonth: (amount: string) => `월 ${amount}`,
  emergencyShort: (amount: string) => `비상금이 ${amount} 모자라요`,
  splitIncome: (a: number, b: number) => `버는 만큼 ${a}:${b}`,
  apply: '적용하기',
  applied: '적용했어요',
  appliedSplit: (name: string) => `적용했어요. 분담은 ${name}님에게 제안했어요`,
  overlap: '이미 바꾼 기간과 겹쳐요', // [확인 필요]
  noChange: '바뀌는 점이 없어요', // [확인 필요]
  unknown: '아직 몰라요',
  // F-08 우리 자산 순위(23 F-08, 2026-11-04 토스형: 카드 없이 문장 + 곡선 + 굵은 띠 + 이름·값 줄)
  rankTitle: '우리 자산 순위', // [확인 필요]
  rankHero1: '우리 자산은 전체 가구 중', // [확인 필요]
  rankHero2: (pct: number, open = false) => (open ? `상위 ${pct}% 안이에요` : `상위 ${pct}%예요`), // [확인 필요] open = P90 이상
  rankAxis: { low: '하위', mid: '중간', high: '상위' },
  rankYou: '우리',
  rankAria: (pct: number) => `우리나라 전체 가구 중 상위 ${pct}%`,
  rankBasis: (label: string, ym: string) => `${label}, ${ym} 말 기준`,
  rankOurs: (month: number) => `${month}월 우리 순자산`,
  rankMedian: '전체 가구 중앙값', // [확인 필요]
  rankBracket: (i: number) => `순자산 구간 ${i + 1}번째`,
  // 지난달 대비(히어로 아래 한 줄): ‘9월보다 [3%p] 올랐어요’
  rankPrev: (m: number) => `${m}월보다 `, // [확인 필요]
  rankUp: ' 올랐어요', // [확인 필요]
  rankDown: ' 내려갔어요', // [확인 필요]
  rankSame: (m: number) => `${m}월과 같아요`, // [확인 필요]
  rankPp: (p: number) => `${p}%p`,
  // 다음 칸까지
  rankNextLabel: (top: number) => `상위 ${top}%까지`, // [확인 필요]
  rankNextBig: (amount: string) => `${amount} 남았어요`, // [확인 필요]
  rankNextSub: (target: string, top: number) => `순자산이 ${target}이 되면 상위 ${top}%예요`, // [확인 필요]
  // 연령대 비교(계산·배분 7-7): 연령대별 중앙값만 공공 통계에 있어 순위 없이 중간보다 많은지만
  rankAge: { '20s': '20대', '30s': '30대', '40s': '40대', '50s': '50대', '60s': '60대 이상' },
  rankAgeTitle: (band: string) => `${band} 가구와 비교`, // [확인 필요]
  rankAgeMore: (band: string) => `${band} 가구 중간보다 `, // [확인 필요] + 금액 + rankAgeMoreTail
  rankAgeMoreTail: ' 많아요',
  rankAgeBelow: (band: string) => `${band} 가구 가운데 중간보다 아래예요`, // [확인 필요] 계산·배분 7-3 말투(사실만)
  rankAgeMedian: (band: string) => `${band} 가구 중앙값`, // [확인 필요]
  rankDebt: '부채 비율', // [확인 필요] 부채 ÷ 자산
  rankFinancial: '자산 중 금융자산', // [확인 필요] 예금·투자·보험·보증금
  rankAgeAvg: (band: string, pct: number) => `${band} 가구 평균 ${pct}%`,
  rankPct: (pct: number) => `${pct}%`,
  rankAgeNote: '가구주 나이별 공공 통계 기준', // [확인 필요]
  // F-01 빈 상태 항목별 등록(2026-11-04)
  emptyAssetsQ: '무엇부터 적어 볼까요?', // [확인 필요]
  emptyDebtsQ: '갚을 돈도 있나요?', // [확인 필요]
};
