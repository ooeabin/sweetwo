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
};
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
