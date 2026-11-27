import { object } from '@sweetwo/core';

// 캘린더 문구(docs/spec/24-calendar.md, 재기획 2026-10-25). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없거나 [확인 필요]로 둔 것.
export const copy = {
  title: '캘린더',
  monthTitle: '달력', // [확인 필요] 2026-11-18 Y-04 머리 제목(서랍 줄 이름과 같게)
  add: '+ 일정 추가', // [확인 필요] 2026-11-17 넓은 창 제목 줄(예전 ‘+ 추가’)
  addSchedule: '일정 추가', // [확인 필요] 2026-11-17 좁은 창 보기 필터 줄 오른쪽(+ 아이콘이 글자 앞 ‘+’, 예전 ‘경조사 추가’)
  filters: { all: '전체', care: '경조사·기념일', money: '금융 일정' }, // [확인 필요]
  filterLabel: '보기 필터', // [확인 필요] 화면 읽기용
  noMoneyThisMonth: '이번 달은 금융 일정이 없어요', // 13 공통 상태 18번, Y-04(2026-11-12 D3)
  none60: '60일 안에는 경조사가 없어요',
  // Y-04 ‘다가오는 일정’ ‘금융 일정’ 필터 빈 목록(2026-11-12 D3, 예전 Y-01) [확인 필요]
  noMoney60: '60일 안에는 금융 일정이 없어요',
  upcomingList: '다가오는 일정', // [확인 필요] 2026-11-17 예전 ‘일정’(Y-01)
  recordCount: (n: number) => `선물을 기록할 날이 ${n}개 있어요`,
  recordWhich: (name: string, date: string, more: number) =>
    more > 0 ? `${name}, ${date} 외 ${more}개` : `${name}, ${date}`,
  money: {
    payday: (name: string) => (name ? `${name} 월급날` : '월급날'),
    review: '월급날 확인 목록', // [확인 필요] 2026-11-15 ‘월급 전 확인’ 대신(W-05 없앰)
    deadline: (name: string) => `${name} 기한`,
    goal: (name: string) => `${name} 기한`, // 저금 기한의 달(2026-11-16: 쓸 곳 메모와 같은 ‘쓸 곳’으로 보여 ‘기한’으로)
    maturity: (name: string) => `${name} 만기`,
    note: (name: string) => name, // 쓸 곳 메모 날짜(W-14, 24 v2.2) [확인 필요]
    // 날짜 없는 사람의 자동 줄(2026-11-14 R6). 지난 날은 자동 확인 [확인 필요]
    auto: (name: string) => `${name} 자동으로 나가요`,
    autoDone: (name: string) => `${name} 자동으로 나갔어요`,
    /** 홈 ‘다가오는 날’ 상자 짧은 줄(“월세 1일”, 2026-11-20) [확인 필요] */
    autoShort: (name: string, day: number) => `${name} ${day}일`,
    /** 앞당긴 월급날 까닭(2026-11-16 4차 검토 R4-9, 문구 리뷰). to = “24일” 또는 Y-04 “24일 목요일” */
    moved: (from: number, why: 'sat' | 'sun' | 'holiday', to: string) =>
      `${from}일이 ${why === 'sat' ? '토요일' : why === 'sun' ? '일요일' : '공휴일'}이라 ${to}로 앞당겼어요`,
  },
  go: {
    payday: '월급날 확인 목록', // [확인 필요]
    review: '월급날 확인 목록', // [확인 필요] 2026-11-15
    deadline: '저축·투자', // [확인 필요] ADR 0007, 2026-11-09
    goal: '저축·투자',
    maturity: '자산',
    note: '쓸 곳 메모', // [확인 필요] 2026-11-13
    auto: '월급 계획', // [확인 필요] 2026-11-14 R6
  },
  today: '오늘', // [확인 필요] Y-04 머리 오른쪽 작은 회색 알약(다른 달일 때만, 2026-11-27 ‘달 넘기기 C안’)
  // 달력 고른 날 금융 일정 보조 줄: 누르면 어디로 가는지 [확인 필요]
  goSub: {
    payday: '월급날 확인 목록 보기',
    review: '월급날 확인 목록 보기',
    deadline: '저축·투자 보기', // [확인 필요] ADR 0007, 2026-11-09
    goal: '저축·투자 보기',
    maturity: '자산 보기',
    note: '쓸 곳 메모 보기', // [확인 필요] 2026-11-13
    auto: '월급 계획 보기', // [확인 필요] 2026-11-14 R6
  },
  monthHead: (m: number) => `${m}월`,
  holiday: '공휴일',
  // 연휴에 든 공휴일 줄 보조(2026-11-26) [확인 필요]
  holidayStreak: (span: string) => `공휴일, ${span} 연휴`,
  agendaDay: (m: number, d: number, dow: string) => `${m}월 ${d}일 ${dow}요일`,
  // Y-04 고른 날 줄(맨 위 ‘월급날 확인 목록’ 띠는 2026-11-12 D1로 없앰) [확인 필요]
  reviewBand: (month: number) => `${month}월 월급날 확인 목록에 남은 게 있어요`,
  monthLabel: (m: number) => `${m}월`,
  yearLabel: (y: number) => `${y}년`,
  // 달 머리 “12월 ⌄”(2026-11-27 사용자 결정: ⌄ 되살림, ‹ › 없앰), 다른 해면 “2027년 2월” [확인 필요]
  monthTextYear: (y: number, m: number) => `${y}년 ${m}월`,
  monthMenu: (y: number, m: number) => `${y}년 ${m}월, 달 고르기`, // 화면 읽기용(달 이름을 누르면 연·월 칸 시트)
  monthSheetTitle: '연·월 고르기', // [확인 필요] 연·월 휠 시트 제목
  // 달 머리 아래 요약 한 줄 “경조사 3개(85만 원 예상)”(2026-11-24 사용자 정한 문구, 금액 메모가 없으면 “경조사 3개”, ‘금융 일정’ 필터는 “금융 일정 4개”) [확인 필요]
  summaryCare: '경조사',
  summaryMoney: '금융 일정',
  summaryCount: (n: number) => `${n}개`,
  summaryBudget: (amount: string) => `(${amount} 예상)`,
  // 고른 날 머리 보조 “음력 10월 25일”(윤달이면 “음력 윤4월 3일”) [확인 필요]
  lunarDay: (m: number, d: number, leap: boolean) => `음력 ${leap ? '윤' : ''}${m}월 ${d}일`,
  // 달력 아래 손잡이(한 주로 접기·펴기) 화면 읽기 이름 [확인 필요]
  fold: '한 주만 보기',
  unfold: '한 달 모두 보기',
  dayLabel: (m: number, d: number, n: number, holiday?: string) =>
    [`${m}월 ${d}일`, holiday, n ? `일정 ${n}개` : null].filter(Boolean).join(', '),
  agendaEmpty: '이 날은 일정이 없어요', // [확인 필요] 2026-11-04 ‘이 날짜엔 없어요’에서
  dday: (n: number) => (n === 0 ? '오늘' : n < 0 ? `D+${-n}` : `D-${n}`), // 지난 날 D+[확인 필요]

  // Y-04 ‘다가오는 일정’(예전 Y-01 본문)
  memoAmount: (amount: string) => `${amount} 생각해 뒀어요`, // [확인 필요]
  prepare: '준비하기',
  nextCare: '다음 경조사', // [확인 필요] 화면 읽기용
  gifted: '선물 기록',
  overdue: '지남',
  recordNow: '기록하기',

  // Y-07 경조사 추가
  formTitle: '경조사 추가', // [확인 필요] 한 화면 머리 제목
  formTitleEdit: '경조사 고치기', // [확인 필요]
  nameQ: '어떤 날이에요?',
  namePlaceholder: '예: 어머니 생신', // [확인 필요]
  chips: {
    birthday: '생일',
    anniversary: '결혼기념일',
    dating_anniversary: '사귄 날', // [확인 필요] 2026-11-13 v2.2(24 이름 칩), 연애 중·같이 살아요에서 맨 앞
    seollal: '설날',
    chuseok: '추석',
    parents_day: '어버이날',
    event: '행사',
    custom: '직접 쓰기',
  },
  chipsLabel: '이름 고르기', // [확인 필요] 화면 읽기용
  // 2026-11-24 K안 달력에 보일 그림(그림 파일이 하나도 없으면 이 질문을 안 보임) [확인 필요]
  artQ: '달력에 어떤 그림으로 보일까요?',
  artLabel: '그림 고르기',
  /** 그림 이름(화면 읽기용, Illustrations 10번) */
  artNames: {
    cake: '케이크',
    heart: '하트',
    diamond: '반지',
    gift: '선물',
    'flower-tulip': '꽃',
    confetti: '폭죽',
    'users-three': '가족',
    house: '집',
    baby: '아기',
    'graduation-cap': '졸업',
    'airplane-tilt': '여행',
    'moon-stars': '보름달',
  } as Record<string, string>,
  dateQ: '언제예요?', // [확인 필요]
  solar: '양력',
  lunar: '음력',
  leapMonth: '윤달',
  yearly: '매년 돌아와요', // [확인 필요]
  dateError: '날짜를 다시 확인해 주세요', // [확인 필요]
  pastDate: '이미 지난 날이에요', // [확인 필요] 2026-11-24 구역 4 B: 회색 안내 한 줄(예전 빨간 “…기록으로 남길까요?” + 글자 버튼). 주 버튼 글자가 “기록하기”로 바뀌어 → Y-08
  amountQ: '쓸 금액을 메모해 둘까요?',
  skip: '건너뛰기',
  sameDay: '같은 날이 있어요. 그래도 추가할까요?', // [확인 필요]
  addOk: '추가하기',
  addOnDay: '이 날에 경조사 추가', // [확인 필요] 달력 고른 날 → Y-07
  nextStep: '다음',
  saved: '경조사를 넣어뒀어요', // [확인 필요]
  edited: '고쳤어요', // [확인 필요] Y-07 수정, Y-05 고치기 Toast(+ ‘되돌리기’, 2026-11-12 S9-04)

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
  formTitleRecord: '기록하기', // [확인 필요] 한 화면 머리 제목
  spentQ: '얼마 썼어요?', // [확인 필요] 기획서 Y-08a 질문 문구 없음
  giftQ: '무엇을 드렸어요?',
  gifts: { cash: '현금', gift: '선물', meal: '식사' },
  giftName: '어떤 선물이에요?', // [확인 필요]
  giftNamePlaceholder: '예: 안마기', // [확인 필요] 2026-11-24 구역 4
  giftAgain: '작년에도 드렸어요',
  rememberQ: '기억하고 싶은 게 있나요?',
  // Y-08c 사진(24 Y-08c). 올린 사진은 서버에 저장 시 암호화, 두 사람만 봄
  photos: '사진',
  photoDrop: '사진을 끌어 놓거나',
  photoPick: '골라 주세요',
  photoAdd: '사진 추가', // [확인 필요] 2026-11-04 사진 칸 첫 칸
  photoHelp: '사진 10장까지, 한 장에 10MB 이하', // [확인 필요]
  photoTooBig: '10MB 이하 사진만 올릴 수 있어요',
  photoBadType: '이 파일은 올릴 수 없어요. 사진 파일을 골라 주세요',
  photoTooMany: '사진은 10장까지 올릴 수 있어요',
  photoFailed: '사진을 올리지 못했어요. 다시 올려 주세요',
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
  // Y-05 기록을 마친 회차 요약(2026-11-24 구역 4) [모두 확인 필요]
  recordSection: '기록',
  recordSpent: '쓴 돈',
  recordGifts: '드린 것',
  recordEdit: '기록 고치기',
  formTitleRecordEdit: '기록 고치기',

  // Y-09 선물 기록
  giftedViews: { care: '경조사별', year: '연도별' },
  giftedViewsLabel: '보기', // [확인 필요] 화면 읽기용
  giftedEmpty: '아직 선물 기록이 없어요', // [확인 필요]
  giftedEmptyAdd: '+ 기념일 입력하기', // [확인 필요] 2026-11-25 빈 상태 다음 행동 → Y-07
  giftedYear: (y: number) => `${y}년`,
  /** 경조사별 보기 줄 이름(묶음 머리가 경조사 이름이라 줄은 연도 + 드린 것, 띄운 가운데 점 없음, 2026-11-24 구역 4) [확인 필요] */
  giftedYearWhat: (y: number, what: string) => (what ? `${y}년, ${what}` : `${y}년`),
  giftedWhat: (items: string[]) => items.join(', '),
  giftedSum: (total: string) => `모두 ${total}`, // [확인 필요]

  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
};
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
