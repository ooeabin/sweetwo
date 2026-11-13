// 자산 관리 문구(docs/spec/23-assets.md F-01~F-04). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // 충돌 선택(13 공통 상태 11번)
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
  title: '자산 관리',
  add: '+ 추가',
  retry: '다시 시도',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  back: '뒤로',
  tabs: { overview: '요약', items: '자산·부채' },
  tabsLabel: '자산 관리 보기', // [확인 필요] 화면 읽기용

  // 2026-11-03 F-01 다시 짬 [확인 필요]
  ourNetWorth: '순자산',
  lastMonth: '지난달보다',
  grew: '늘었어요',
  shrank: '줄었어요',
  monthly: '달마다 순자산',
  gainIncl: (amount: string) => `안 판 수익 ${amount} 포함`,
  assets: (amount: string) => `자산 ${amount}`,
  debts: (amount: string) => `부채 ${amount}`,
  assetsLabel: '자산',
  debtsLabel: '부채',
  empty: '자산을 적으면 순자산을 보여 드려요', // 23 빈 상태(홈 H-04와 같음)
  expectedName: '예상 순자산',
  emptyAdd: '자산 추가하기', // 23 빈 상태

  // F-02
  noDebt: '갚을 돈이 없어요',
  addDebt: '+ 부채 추가',
  // 2026-11-09 F-02 목록 끝 추가 줄(+ 아이콘이 글자 앞 ‘+’를 대신) [확인 필요]
  addAssetRow: '자산 추가',
  addDebtRow: '부채 추가',
  joint: '공동',
  proxy: '대신 입력',
  // 2026-11-13 ‘금액만 보여 주기’ → ‘총액만 보여 주기’(ADR 0009, 23 F-03e·F-04 2번·F-02 8번)
  vis: { all: '모두 보여 주기', sum: '총액만 보여 주기', private: '숨기기' },
  partnerPill: '총액만', // [확인 필요]
  visShort: { all: '', sum: '총액만', private: '숨김' }, // 목록 배지는 짧게(파트너 합계 줄 알약과 같게, 2026-11-13 ‘총액만’) [확인 필요]
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
  amountAsset: '현재 금액은 얼마예요?',
  amountDebt: '남은 대출금은 얼마예요?',
  ownerTitle: '누구 명의예요?',
  ownerMe: '나',
  // F-03e v2.2(2026-11-13): 미리 고른 값 없음, 처음 고른 값이 내 새 항목 기본값
  visTitle: '파트너에게 어떻게 보여 줄까요?', // [확인 필요]
  visOptions: { all: '모두 보여 주기', sum: '총액만 보여 주기', private: '숨기기' }, // [확인 필요]
  visSubs: { sum: '항목은 안 보이고 총액에만 더해요', private: '총액에도 안 더해요' }, // [확인 필요]
  next: '다음',
  save: '추가하기', // [확인 필요]
  sameName: '같은 이름이 있어요. 그래도 추가할까요?',
  addedUp: (amount: string) => `추가했어요. 순자산이 ${amount} 늘었어요`,
  addedDown: (amount: string) => `추가했어요. 순자산이 ${amount} 줄었어요`, // [확인 필요] 부채
  added: '추가했어요', // [확인 필요] 숨기기는 합계에 없음

  estimatedTag: '추정', // F-03 6번 ‘잘 모르겠어요’ 알약

  // F-03f~i
  later: '나중에 할게요',
  maturity: '만기일은 언제예요?',
  contractEnd: '계약 만기일은요?',
  paidCount: '납입 회차는요?',
  paidCountUnit: '회', // [확인 필요]
  payment: '월 납입액은요?',
  repayment: '월 상환액은요?',
  rate: '금리는 몇 %예요?',

  // F-04a 만기된 돈 정리
  maturedTitle: '만기된 돈은 어디로 옮겼어요?',
  maturedPast: '만기일이 지났어요', // [확인 필요] 2026-11-11 F-04 상세 띠(정리 전)
  maturedSettle: '정리하기', // [확인 필요]
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
  graph: '금액 그래프', // [확인 필요] 요소 이름
  editedBy: (date: string, name: string) => `${date} ${name}`,
  maturedDone: '정리했어요', // [확인 필요]
  maturedDateError: '오늘 뒤 날짜를 넣어 주세요', // [확인 필요]

  // F-04
  amountLabel: '금액', // [확인 필요]
  visLabel: '공개 범위', // [확인 필요]
  amountEdit: '금액 고치기', // [확인 필요] 2026-11-04 F-04 1번 버튼(2026-11-11 주 버튼)
  cancel: '취소',
  rateInvalid: '0~30% 사이로 적어 주세요', // [확인 필요] F-03g와 F-04 같은 규칙(2026-11-12 D5 = A)
  countInvalid: '숫자만 적어 주세요', // [확인 필요]
  saveEdit: '저장',
  remove: '삭제',
  removed: '휴지통으로 옮겼어요',
  undo: '되돌리기',
  saved: '저장했어요', // [확인 필요]
  saveFailed: '저장하지 못했어요', // 13 공통 상태 10번 저장 실패(2026-11-12 S8-16)
  readOnly: (name: string) => `${name}님 항목이라 볼 수만 있어요`,
  history: '수정 내역', // 23 F-04 5번
  historyEmpty: '아직 수정 내역이 없어요', // [확인 필요]
  createdLabel: '처음 적은 날', // [확인 필요]
  menu: '항목 메뉴',
  principal: (amount: string) => `원금 ${amount}`,
  owner: '명의', // [확인 필요]
  maturityLabel: '만기일', // [확인 필요]
  paymentLabel: '월 납입액', // [확인 필요]
  repaymentLabel: '월 상환액', // [확인 필요]
  monthlyRepay: (v: string) => `매달 ${v}`, // [확인 필요] F-02 부채 줄 보조
  rateLabel: '금리', // [확인 필요]
  countLabel: '납입 회차', // [확인 필요]

  // F-08 자산 순위(23 F-08, 2026-11-04 카드 없이 문장 + 곡선 + 굵은 띠 + 이름·값 줄)
  rankTitle: '자산 순위', // [확인 필요]
  rankHero1: '우리 자산은 전체 가구 중', // [확인 필요]
  rankHero2: (pct: number, open = false) => (open ? `상위 ${pct}% 안이에요` : `상위 ${pct}%예요`), // [확인 필요] open = P90 이상
  rankAxis: { low: '하위', mid: '중간', high: '상위' },
  rankYou: '우리',
  rankAria: (pct: number) => `우리나라 전체 가구 중 상위 ${pct}%`,
  rankBasis: (label: string, ym: string) => `${label}, ${ym} 말 기준`,
  rankOurs: (month: number) => `${month}월 순자산`,
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
  // 2026-11-10 QA 2구간: 출생연도를 온보딩에서 묻지 않고 F-08에서(23 F-08 7번)
  rankAskBirth: '출생연도 알려 주기', // [확인 필요]
  rankAskBirthSub: '또래와 비교해 드려요', // [확인 필요]
  // F-01 v2.2(2026-11-13): 평가금액 기준 + 전환
  principalView: '원금으로 보기', // [확인 필요]
  principalViewHelp: '원금을 적은 투자·부동산은 원금으로 셈해요', // [확인 필요]
  // F-03q 빠르게 적기(2026-11-13)
  quickEntry: '큰 묶음만 빠르게 적기', // [확인 필요] F-03a 맨 위, F-01 빈 상태(줄 끝 ›)
  quickTitle: '큰 묶음만 빠르게 적어 볼까요?', // [확인 필요]
  quickFields: {
    cash: '현금·예적금',
    invest: '투자',
    home: '집·보증금',
    pension: '연금·보험',
    loan: '대출',
  }, // [확인 필요]
  quickHelp: '빈 칸은 저장하지 않아요', // [확인 필요]
  quickSave: '저장하기',
  quickSaved: (n: number) => `${n}개를 적었어요`, // [확인 필요]
  quickPlaceholder: '0원',
  // F-08 v2.2 (가) 순위(두 사람 모두 동의, 둘의 합)
  rankPairHero1: (band: string | null) => (band ? `${band} 가구 가운데` : '전체 가구 가운데'), // [확인 필요]
  rankPairNote: '둘의 자산을 합쳐 비교했어요', // [확인 필요]
  rankPairBasis: (band: string | null) =>
    band ? `${band} 가구 기준이에요` : '전체 가구 기준이에요', // [확인 필요] 06 7-8 연령대 분포가 없으면 전체 가구
  rankPairOurs: (month: number) => `${month}월 둘의 순자산`, // [확인 필요]
  rankHomeBadge: '홈에 보여 주기', // [확인 필요] 기본 끔
  rankRefreshAd: '새로 확인하기', // [확인 필요] 앞에 ‘광고’ 표시
  rankStaleNote: (month: number) => `${month}월에 본 결과예요`, // [확인 필요]
  rankNotYet: '아직 확인하지 않았어요', // [확인 필요] 다시 동의한 뒤 저장 순위가 없을 때
  rankAd: '광고',
  // F-08 v2.2 (나) 순위 없음
  rankPeerLine: (amount: string) => `또래 가구 중간값은 ${amount}이에요`, // [확인 필요]
  rankPeerBand: (band: string) => `${band} 가구 기준`, // [확인 필요]
  rankAskPair: (name: string) => `${name}님과 같이 순위 보기`, // [확인 필요]
  rankAskWaiting: (name: string) => `${name}님 답을 기다리고 있어요`, // [확인 필요]
  rankAskAnswer: (name: string) => `${name}님이 같이 보자고 해요`, // [확인 필요]
  // F-08c 순위 같이 보기 동의
  consentSendTitle: '둘의 자산을 합쳐 전체 가구와 비교해요', // [확인 필요] 06 7-8 연령대 분포가 들어오면 ‘또래 가구와’
  consentSendHelp: (name: string) => `${name}님도 좋다고 하면 보여요`, // [확인 필요]
  consentSend: '같이 보자고 하기', // [확인 필요]
  consentSent: (name: string) => `${name}님에게 물어봤어요`, // [확인 필요]
  consentAskTitle: (name: string) => `${name}님이 자산 순위를 같이 보자고 해요`, // [확인 필요]
  consentAskHelp: '숨긴 자산은 빼고 합쳐요', // [확인 필요]
  consentYes: '좋아요', // [확인 필요]
  consentNo: '괜찮아요', // [확인 필요]
  consentAccepted: '이제 자산 순위를 같이 봐요', // [확인 필요] 서버 알림 문구와 같음
  consentGone: '이미 답했거나 기한이 지난 요청이에요', // [확인 필요]
  consentFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  // F-01 빈 상태 항목별 등록(2026-11-04)
  emptyAssetsQ: '무엇부터 적어 볼까요?', // [확인 필요]
  emptyDebtsQ: '갚을 돈도 있나요?', // [확인 필요]
};
