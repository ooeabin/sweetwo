import { formatMonthDay, isWord, subject, type HomeTodo, type HomeUpcoming } from '@sweetwo/core';

// 홈 할 일 한 줄(19 H-06)과 다가오는 일정(H-05, 트레이 WG-03) 문구. 홈과 트레이 위젯이 같이 씀.
export const homeText = {
  todoUnlink: (name: string) => `${name}님이 연결 해제를 요청했어요`,
  todoReconnect: (name: string) => `${name}님이 다시 연결하자고 했어요`,
  todoReview: (label: string, n: number) => `${label}에서 체크 안 한 게 ${n}개 있어요`,
  todoInvite: '같이 쓸 사람을 초대해 주세요',
  todoAmount: (goal: string) => `${goal} 목표 금액을 정해 주세요`,
  todoMatured: (name: string) => `${subject(name)} 만기됐어요`, // [확인 필요] 알림 문구와 같게
  todoCare: (date: string, name: string) => `${date} ${isWord(name)}`,
  payday: (who: string) => `${who}님 월급날`, // [확인 필요]
  review: '월말 확인',
  deadline: (goal: string) => `${goal} 기한`, // [확인 필요]
  maturity: (name: string) => `${name} 만기`, // 캘린더 돈 일정과 같음
};

/** 할 일 한 줄 문구. partner = 지금 배우자(해제 요청), exPartner = 해제한 상대(다시 연결) */
export function todoText(t: HomeTodo, n: { partner: string; exPartner: string }) {
  switch (t.kind) {
    case 'unlink':
      return homeText.todoUnlink(n.partner);
    case 'reconnect':
      return homeText.todoReconnect(n.exPartner);
    case 'review':
      return homeText.todoReview(t.label, t.left);
    case 'invite':
      return homeText.todoInvite;
    case 'amount':
      return homeText.todoAmount(t.goal);
    case 'matured':
      return homeText.todoMatured(t.asset);
    case 'care':
      return homeText.todoCare(formatMonthDay(t.date), t.name);
  }
}

/** 다가오는 일정 줄 이름 */
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
