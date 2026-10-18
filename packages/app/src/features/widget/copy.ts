// 위젯 문구(docs/spec/26-widgets.md, 디자인 Widget). 기획서 “ ” 안 문장을 그대로.
export const copy = {
  split: '이번 달 안 나눈 돈',
  splitAllDone: '월급을 다 나눴어요',
  splitMasked: '월급 나누기',
  splitCount: (total: number, done: number) => `${total}곳 중 ${done}곳 나눴어요`,
  living: '이번 달 남은 생활비',
  livingMasked: (pct: number) => `생활비 ${pct}% 남았어요`,
  livingOver: (amount: string) => `${amount} 넘었어요`,
  gather: '이번 달 결혼 자금 모으기',
  payday: (day: number) => `다음 월급날 ${day}일`,
  close: (n: number) => `월말 정리 D-${n}`,
  noPlan: '온보딩을 마치면 보여요',
  task: '다음 할 일',
  noDays: '다가오는 날이 없어요',
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`),
  signedOut: 'sweeTwo를 열어 로그인해 주세요',
  locked: '잠겨 있어요',
  openApp: '앱 열기',
  updated: (min: number) => (min < 1 ? '방금 업데이트' : `${min}분 전 업데이트`), // [확인 필요] 1분 안
  basis: (time: string) => `${time} 기준`,
  hidden: '금액 가림',
  days: '다가오는 날', // [확인 필요] 화면 읽기용
};
