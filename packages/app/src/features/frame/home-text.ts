import { formatMonthDay, isWord, subject, type HomeTodo, type HomeUpcoming } from '@sweetwo/core';

// 홈 할 일 한 줄(19 H-06)과 일정(H-05) 문구.
export const homeText = {
  todoUnlink: (name: string) => `${name}님이 연결 해제를 요청했어요`,
  todoReconnect: (name: string) => `${name}님이 다시 연결하자고 했어요`,
  todoReview: (label: string, n: number) => `${label}에서 체크 안 한 게 ${n}개 있어요`,
  todoCheck: '월급날 체크할 차례예요', // [확인 필요] 2026-11-09 홈 할 일 띠(19 H-06 3a)
  todoInvite: '함께할 사람을 초대해 주세요',
  todoSaving: '첫 저금을 만들어 볼까요?', // [확인 필요] 2026-11-09 round 3 첫 주 할 일(19 H-06 4b)
  todoMatured: (name: string) => `${subject(name)} 만기됐어요`, // [확인 필요] 알림 문구와 같게
  todoCare: (date: string, name: string) => `${date} ${isWord(name)}`,
  payday: (who: string) => `${who}님 월급날`, // [확인 필요]
  review: '월급 전 확인', // 2026-11-09 ‘월급 전 확인’ 대신
  deadline: (goal: string) => `${goal} 기한`, // [확인 필요]
  maturity: (name: string) => `${name} 만기`, // 캘린더 금융 일정과 같음
};

/** 할 일 한 줄 문구. partner = 지금 파트너(해제 요청), exPartner = 해제한 상대(다시 연결) */
export function todoText(t: HomeTodo, n: { partner: string; exPartner: string }) {
  switch (t.kind) {
    case 'unlink':
      return homeText.todoUnlink(n.partner);
    case 'reconnect':
      return homeText.todoReconnect(n.exPartner);
    case 'review':
      return homeText.todoReview(t.label, t.left);
    case 'check':
      return homeText.todoCheck;
    case 'invite':
      return homeText.todoInvite;
    case 'saving':
      return homeText.todoSaving;
    case 'matured':
      return homeText.todoMatured(t.asset);
    case 'care':
      return homeText.todoCare(formatMonthDay(t.date), t.name);
  }
}

/** 일정 줄 이름 */
export function upcomingName(u: HomeUpcoming, myName: string) {
  switch (u.kind) {
    case 'payday':
      return homeText.payday(myName);
    case 'review':
      return homeText.review;
    case 'goal':
      return homeText.deadline(u.name);
    case 'maturity':
      return homeText.maturity(u.name);
    default:
      return u.name;
  }
}
