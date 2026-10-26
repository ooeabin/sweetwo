import { object } from '@sweetwo/core';

// 위젯 문구(docs/spec/26-widgets.md, 디자인 Widget). 기획서 “ ” 안 문장을 그대로.
export const copy = {
  // WG-01 이번 달 월급
  count: (n: number) => `${n}개`,
  progress: (total: number, done: number) => `${total}개 중 ${done}개 했어요`, // [확인 필요]
  allDone: (label: string) => `${object(label)} 다 나눴어요`,
  payday: (day: number) => `다음 월급날 ${day}일`,
  review: (n: number) => `체크 안 한 게 ${n}개 있어요`, // [확인 필요]
  noSalary: '월급이 생기면 분배표를 만들어 드려요',
  noPlan: '온보딩을 마치면 보여요',
  task: '다음 할 일',
  noDays: '다가오는 날이 없어요',
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`),
  signedOut: 'sweeTwo를 열어 로그인해 주세요',
  locked: '잠겨 있어요',
  openApp: '앱 열기',
  updated: (min: number) => (min < 1 ? '방금 업데이트' : `${min}분 전 업데이트`), // [확인 필요] 1분 안
  basis: (time: string) => `${time} 기준`,
  days: '다가오는 날', // [확인 필요] 화면 읽기용
};
