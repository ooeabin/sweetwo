import { object } from '@sweetwo/core';

// 캘린더 문구(docs/spec/24-calendar.md, 재기획 2026-10-25). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없거나 [확인 필요]로 둔 것.
export const copy = {
  title: '캘린더',
  add: '+ 추가',
  views: { list: '목록', month: '달력' },
  monthLink: '달력', // 2026-11-09 Y-01 ‘목록/달력’ 탭 대신 오른쪽 ‘달력 ›’ 링크 [확인 필요]
  addCareRow: '경조사 추가', // 2026-11-09 ‘일정’ 머리 오른쪽 + 줄(+ 아이콘이 글자 앞 ‘+’) [확인 필요]
  viewsLabel: '보기', // [확인 필요] 화면 읽기용
  filters: { all: '전체', care: '경조사', money: '금융 일정' }, // [확인 필요]
  filterLabel: '보기 필터', // [확인 필요] 화면 읽기용
  emptyAdd: '경조사 추가',
  noMoneyThisMonth: '이번 달은 금융 일정이 없어요', // [확인 필요]
  none60: '60일 안에는 경조사가 없어요',
  // 2026-11-03 Y-01 한 목록 [확인 필요]
  noMoney60: '60일 안에는 금융 일정이 없어요',
  upcomingList: '일정',
  recordCount: (n: number) => `기록할 날이 ${n}개 있어요`,
  recordWhich: (name: string, date: string, more: number) =>
    more > 0 ? `${name}, ${date} 외 ${more}개` : `${name}, ${date}`,
  money: {
    payday: (name: string) => (name ? `${name} 월급날` : '월급날'),
    review: '월급 전 확인', // [확인 필요] 2026-11-09 한 이름으로
    deadline: (name: string) => `${name} 기한`,
    goal: (name: string) => `${name} 쓰는 달`,
    maturity: (name: string) => `${name} 만기`,
  },
  go: {
    payday: '체크리스트', // [확인 필요]
    review: '월급 전 확인', // [확인 필요]
    deadline: '저금', // [확인 필요] ADR 0007, 2026-11-09
    goal: '저금',
    maturity: '자산',
  },
  // 2026-11-04 칸 안 짧은 이름, 월급 전 확인 띠 이름, 오늘로 [확인 필요]
  short: {
    payday: '월급',
    review: '월급 전 확인',
    deadline: '기한',
    goal: '쓰는 달',
    maturity: '만기',
    band: '월급 전 확인',
  },
  today: '오늘',
  // 달력 고른 날 금융 일정 보조 줄: 누르면 어디로 가는지 [확인 필요]
  goSub: {
    payday: '체크리스트 보기',
    review: '월급 전 확인하기',
    deadline: '저금 보기', // [확인 필요] ADR 0007, 2026-11-09
    goal: '저금 보기',
    maturity: '자산 보기',
  },
  monthHead: (m: number) => `${m}월`,
  holiday: '공휴일',
  agendaDay: (m: number, d: number, dow: string) => `${m}월 ${d}일 ${dow}요일`,
  reviewBand: (month: number) => `${month}월 월급, 빠진 게 있는지 확인할 때예요`, // [확인 필요]
  legendCare: '경조사',
  legendMoney: '금융 일정',
  monthLabel: (m: number) => `${m}월`,
  yearLabel: (y: number) => `${y}년`,
  prev: '이전 달',
  next: '다음 달',
  dayLabel: (m: number, d: number, n: number, holiday?: string) =>
    [`${m}월 ${d}일`, holiday, n ? `일정 ${n}개` : null].filter(Boolean).join(', '),
  agendaEmpty: '이 날은 일정이 없어요', // [확인 필요] 2026-11-04 ‘이 날짜엔 없어요’에서
  listMoney: '금융 일정', // [확인 필요] 목록 섹션 이름
  dday: (n: number) => (n === 0 ? '오늘' : n < 0 ? `D+${-n}` : `D-${n}`), // 지난 날 D+[확인 필요]

  // Y-01
  memoAmount: (amount: string) => `${amount} 생각해 뒀어요`, // [확인 필요]
  prepare: '준비하기',
  nextCare: '다음 경조사', // [확인 필요] 화면 읽기용
  careList: '60일 안 경조사', // [확인 필요] 섹션 이름
  gifted: '선물 기록',
  overdue: '지남',
  recordNow: '기록하기',
  overdueList: '기록하기', // [확인 필요] 목록 맨 위 섹션 이름

  // Y-07 경조사 추가
  nameQ: '어떤 날이에요?',
  namePlaceholder: '예: 어머니 생신', // [확인 필요]
  chips: {
    birthday: '생일',
    anniversary: '결혼기념일',
    seollal: '설날',
    chuseok: '추석',
    parents_day: '어버이날',
    event: '행사',
    custom: '직접 쓰기',
  },
  chipsLabel: '이름 고르기', // [확인 필요] 화면 읽기용
  dateQ: '언제예요?', // [확인 필요]
  solar: '양력',
  lunar: '음력',
  leapMonth: '윤달',
  yearly: '매년 돌아와요', // [확인 필요]
  dateError: '날짜를 다시 확인해 주세요', // [확인 필요]
  pastDate: '이미 지난 날이에요. 기록으로 남길까요?',
  recordPast: '기록으로 남기기', // [확인 필요] 지난 날짜 → Y-08
  amountQ: '쓸 돈을 메모해 둘까요?', // [확인 필요]
  skip: '건너뛰기',
  sameDay: '같은 날이 있어요. 그래도 추가할까요?', // [확인 필요]
  addOk: '추가하기',
  addOnDay: '이 날에 경조사 추가', // [확인 필요] 달력 고른 날 → Y-07
  nextStep: '다음',
  saved: '경조사를 넣어뒀어요', // [확인 필요]
  edited: '고쳤어요', // [확인 필요]

  // Y-05 상세
  lunarOf: (m: number, d: number, leap: boolean) => `(음력 ${leap ? '윤' : ''}${m}월 ${d}일)`,
  noDate: '날짜를 아직 몰라요', // [확인 필요]
  amountMemo: '금액 메모', // [확인 필요] 줄 이름
  noAmount: '비어 있어요', // [확인 필요]
  edit: '수정',
  menu: '경조사 메뉴', // [확인 필요] 화면 읽기용
  remove: '지우기',
  removed: '휴지통으로 옮겼어요',
  undo: '되돌리기',
  repeat: '반복',
  repeatYearly: '매년',
  repeatOnce: '한 번',
  status: '준비 상황',
  statuses: { todo: '아직', preparing: '준비 중', done: '다녀왔어요' },
  alerts: '미리 알림',
  alertRow: (n: number) => (n === 0 ? '당일' : `${n}일 전`), // [확인 필요] 2026-11-04 체크 목록(‘D-30’ 칩에서)
  memo: '메모',
  memoPlaceholder: '예: 같이 케이크 먹었어요', // [확인 필요] 2026-11-04 Y-08c
  dayMemoPlaceholder: '예: 무릎이 안 좋으시다고 하셨음', // 24 Y-05 7번 예시
  lastYear: (gift: string, amount: string) => `작년엔 ${object(gift)} 드렸어요 (${amount})`,
  save: '저장', // [확인 필요]
  back: '뒤로',

  // Y-08 다녀온 뒤 기록
  spentQ: '얼마 썼어요?', // [확인 필요] 기획서 Y-08a 질문 문구 없음
  giftQ: '무엇을 드렸어요?',
  gifts: { cash: '현금', gift: '선물', meal: '식사' },
  giftName: '어떤 선물이에요?', // [확인 필요]
  giftAgain: '작년에도 드렸어요',
  rememberQ: '기억하고 싶은 게 있나요?',
  // Y-08c 사진(24 Y-08c). 올린 사진은 서버에 저장 시 암호화, 두 사람만 봄
  photos: '사진',
  photoDrop: '사진을 끌어 놓거나',
  photoPick: '골라 주세요',
  photoAdd: '사진 추가', // [확인 필요] 2026-11-04 사진 칸 첫 칸
  photoHelp: '사진 10장까지, 한 장에 10MB 이하', // [확인 필요]
  photoTooBig: '10MB 이하 사진만 올릴 수 있어요',
  photoBadType: '이 형식은 올릴 수 없어요',
  photoTooMany: '사진은 10장까지 올릴 수 있어요',
  photoFailed: '사진을 올리지 못했어요',
  photoRetry: '다시 시도',
  photoUploading: '올리는 중',
  photoRemove: (name: string) => `${name} 빼기`,
  photoAlt: (n: number) => `사진 ${n}`, // [확인 필요] 화면 읽기용
  giftedPhotos: (n: number) => `사진 ${n}장`, // [확인 필요] Y-09 행
  // 사진(경조사) 동의: 처음 사진 추가 시(31 동의 8종)
  photoConsentTitle: '사진을 저장해도 될까요?', // [확인 필요]
  photoConsentBody: '기억하고 싶은 사진을 기록과 함께 보관해요', // [확인 필요]
  // 파트너가 아직 합류 전이면 이름이 없어 ‘파트너와’로 [확인 필요]
  photoNotice: (partner: string) =>
    partner
      ? `올린 사진은 ${partner}님과 나만 볼 수 있어요`
      : '올린 사진은 파트너와 나만 볼 수 있어요', // [확인 필요]
  photoNoticeSolo: '올린 사진은 나만 볼 수 있어요', // [확인 필요] 혼자 쓰기
  photoGoesWith: '기록을 지우면 사진도 함께 지워져요', // [확인 필요]
  photoConsentLater: '나중에 할게요', // [확인 필요]
  photoConsentOk: '동의할게요', // [확인 필요]
  recorded: '기록했어요', // [확인 필요]

  // Y-09 선물 기록
  giftedViews: { care: '경조사별', year: '연도별' },
  giftedViewsLabel: '보기', // [확인 필요] 화면 읽기용
  giftedEmpty: '아직 선물 기록이 없어요', // [확인 필요]
  giftedEmptyBody: '경조사에 ‘다녀왔어요’를 누르고 기록하면 여기에 모여요', // [확인 필요] 2026-11-04
  giftedYear: (y: number) => `${y}년`,
  giftedWhat: (items: string[]) => items.join(', '),
  giftedSum: (total: string) => `모두 ${total}`, // [확인 필요]

  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
};
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
