// 캘린더 문구(docs/spec/24-calendar.md Y-01, Y-04, 캘린더 범위). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '캘린더',
  add: '+ 추가',
  views: { list: '목록', month: '달력' },
  viewsLabel: '보기', // [확인 필요] 화면 읽기용
  filters: { all: '전체', care: '챙길 날', money: '돈 날짜' },
  filterLabel: '보기 필터', // [확인 필요] 화면 읽기용
  empty: '양가 부모님 생신부터 챙겨볼까요?',
  noMoneyThisMonth: '이번 달은 돈 날짜가 없어요',
  none60: '60일 안에는 챙길 날이 없어요',
  money: {
    payday: (name: string) => `${name} 월급날`,
    close: '정리 시작',
    maturity: (name: string) => `${name} 만기`,
    proposal: '제안 적용',
    income: (name: string) => `${name} 들어오는 날`,
    goal: (name: string) => `${name} 쓰는 달`,
  },
  go: {
    payday: '월급 플랜',
    close: '월말 정리',
    maturity: '자산',
    proposal: '제안',
    income: '들어오는 돈',
    goal: '목표',
  },
  legendCare: '챙길 날',
  legendMoney: '돈 날짜',
  legendClose: '월말 정리 기간', // [확인 필요]
  monthLabel: (m: number) => `${m}월`,
  yearLabel: (y: number) => `${y}년`,
  prev: '이전 달',
  next: '다음 달',
  dayLabel: (m: number, d: number, n: number) =>
    n ? `${m}월 ${d}일, 일정 ${n}개` : `${m}월 ${d}일`,
  agendaDate: (m: number, d: number, dow: string) => `${m}월 ${d}일(${dow})`,
  agendaEmpty: '이 날짜엔 없어요',
  listMoney: '돈 날짜', // [확인 필요] 목록 섹션 이름
  dday: (n: number) => (n === 0 ? '오늘' : `D-${n}`),

  // 구분(6번)
  side: (name: string) => `${name} 쪽`,
  both: '양가', // [확인 필요] 명절·어버이날처럼 양가 공통
  couple: '우리 둘',
  carer: (name: string) => `${name}님이 챙겨요`,
  together: '같이 챙겨요', // [확인 필요]
  budget: (amount: string) => `예산 ${amount}`,
  prepare: '준비하기',
  nextCare: '다음 챙길 날', // [확인 필요] 화면 읽기용
  careList: '60일 안 챙길 날', // [확인 필요] 섹션 이름
  startSetup: '양가 부모님 생신부터 챙겨보기', // [확인 필요] 빈 상태 버튼

  // Y-02 처음 등록
  setupParents: '양가 부모님을 챙겨드릴게요',
  father: '아버지', // [확인 필요] 기본 호칭
  mother: '어머니', // [확인 필요]
  birthdayOf: (title: string) => `${title} 생신은 언제예요?`,
  month: '월',
  day: '일',
  solar: '양력',
  lunar: '음력',
  leapMonth: '윤달',
  dateError: '날짜를 다시 확인해 주세요', // [확인 필요]
  later: '나중에 할게요',
  holidayQ: '명절에 양가에 얼마쯤 쓸 것 같아요?',
  holidayHelp: '용돈, 선물, 교통비, 조카 세뱃돈까지 양가 합계로요', // [확인 필요]
  birthdayQ: '부모님 생신에는 한 분께 얼마쯤 드릴까요?',
  unsure: '잘 모르겠어요',
  summary: (total: string, monthly: string) =>
    `1년에 ${total}이에요. 매달 ${monthly}씩 모아두면 돼요`,
  summaryEngaged: (total: string) => `1년에 ${total}이에요. 결혼 뒤부터 매달 모아두면 돼요`,
  summaryHelp: '설·추석, 부모님 생신, 어버이날을 달력에 넣어둘게요', // [확인 필요]
  ok: '이대로 하기',
  nextStep: '다음',
  saved: '챙길 날을 넣어뒀어요', // [확인 필요]
  proposedFamily: (partner: string) => `${partner}님께 양가 비용을 제안했어요`, // [확인 필요]
  names: {
    seollal: '설날',
    chuseok: '추석',
    parentsDay: '어버이날',
    anniversary: '결혼기념일',
    birthday: (title: string) => `${title} 생신`,
  },
  familyCost: '양가 비용',

  // Y-05 상세
  lunarOf: (m: number, d: number, leap: boolean) => `(음력 ${leap ? '윤' : ''}${m}월 ${d}일)`,
  noDate: '날짜를 아직 몰라요', // [확인 필요]
  spend: '쓸 돈',
  edit: '수정',
  carerLabel: '챙길 사람',
  repeat: '반복',
  repeatYearly: '매년',
  repeatOnce: '한 번',
  status: '준비 상황',
  statuses: { todo: '아직', preparing: '준비 중', done: '다녀왔어요' },
  alerts: '미리 알림',
  alertChip: (n: number) => (n === 0 ? '당일' : `D-${n}`),
  memo: '메모',
  zeroBudget: '금액을 정해 주세요',
  budgetQ: '얼마쯤 쓸까요?',
  save: '저장', // [확인 필요]
  back: '뒤로',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
};
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
