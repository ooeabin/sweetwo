import type { SavingChip } from '@sweetwo/core';
import { formatMonthDay } from '@sweetwo/core';
import { whoDid } from '../frame';

// 홈 문구(docs/spec/19-this-month.md ‘홈 v2.2’). 기획서 “ ” 안 문장 그대로. [확인 필요]는 기획서에 문구가 없거나 확인 중인 것.
const ym = (d: string) => `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월`;
/** “{이름}님”, 이름(애칭)이 없으면 ‘파트너’ */
const nim = (name: string) => (name ? `${name}님` : '파트너');

export const copy = {
  // 시작한 사람을 기다림(상태 변형 4)
  waitTitle: (starter: string) => `${whoDid(starter)} 시작하고 있어요`,
  waitCard: (starter: string) => `${whoDid(starter)} 월급 계획을 만들면 알려 드릴게요`, // [확인 필요] 2026-11-08
  homeTitle: '홈', // 2026-11-03 넓은 창 제목 줄(다른 메뉴와 같음)
  hubLabel: '한눈에 보기', // [확인 필요] 2026-11-09 홈 상자 묶음 이름(화면 읽기용)

  // H-10 같이 모으기 [모두 확인 필요]
  together: '같이 모으기',
  dday: (n: number) => `결혼식 D-${n}`,
  ddayToday: '결혼식 D-day',
  weddingDateAsk: '결혼식 날짜 알려 주기',
  targetOf: (target: string, pct: number) => `목표 금액 ${target}의 ${pct}%`,
  thisMonthGain: (amount: string) => `이번 달 +${amount}`,
  /** 아직 안 들어간 묶음(상대가 만듦) 칸 첫 줄(2026-11-14 H1) */
  togetherInvite: (name: string) => `${name}님이 같이 모으자고 해요. 눌러서 들어가요`, // [확인 필요]
  remain: (deadline: string, amount: string) => `${ym(deadline)}까지 ${amount} 더 필요해요`,
  remainPercent: (deadline: string) => `${ym(deadline)}까지`,
  each: (a: string, x: string, b: string, y: string) => `${a} ${x}, ${b} ${y}`,
  paused: '같이 모으기를 잠시 멈췄어요',
  doneBadge: '다 모았어요',
  seeAll: '저금 모두 보기',
  moneyIn: '돈 들어왔어요', // AddRow(+ 아이콘이 ‘+’)
  emptyAsk: '무엇을 같이 모을까요?',
  emptyAdd: '저금 만들기', // AddRow(+ 아이콘이 ‘+’)
  widgetSaving: '모으는 중', // [확인 필요] 26 WG-01 목표 금액이 없고 금액 가림
  /** 화면 읽기 문장 하나(“같이 모으기, 결혼 비용, 3,100만 원, 목표 금액의 62%, …”) */
  togetherLabel: (parts: string[]) => ['같이 모으기', ...parts].filter(Boolean).join(', '),
  targetPctLabel: (pct: number) => `목표 금액의 ${pct}%`,
  chips: {
    wedding: '결혼 비용',
    honeymoon: '신혼여행',
    emergency: '비상금',
    jeonse_loan: '전세 대출 갚기',
    travel: '여행',
    moving: '이사',
    gift: '선물',
  } satisfies Record<SavingChip, string>,

  // H-11 이번 달 한 줄 [모두 확인 필요]
  monthFirst: (date: string) => `${formatMonthDay(date)} 첫 월급날에 확인해요`,
  monthFirstNoDate: '첫 월급날에 확인해요',
  monthDone: (start: string, kind: 'all' | 'mixed') =>
    `${formatMonthDay(start)} 월급, ${kind === 'all' ? '계획대로 됐어요' : '확인을 마쳤어요'}`,
  untilNext: (n: number) => `다음 월급날까지 ${n}일`,
  monthPayday: (n: number) => `월급날이에요. 확인할 게 ${n}개 있어요`,
  monthAutoOnly: '이번 달은 자동으로 나가는 것뿐이에요',
  autoNext: (day: number, n: number) => `${day}일에 ${n}개`,
  monthReview: (start: string, n: number) =>
    `${formatMonthDay(start)} 월급에서 확인할 게 ${n}개 남았어요`,
  lateLeft: (n: number) => `지난 달 ${n}개 늦게 확인할 수 있어요`,
  noSalary: '월급이 생기면 월급 계획을 만들어 드려요',
  nonManager: '이번 달 보내기와 용돈은 자동이에요',
  goView: '보기',
  goCheck: '확인하기',
  goMoneyIn: '돈 들어왔어요',
  goSalary: '월급 알려 주기',

  // H-06 할 일 띠 v2.2 [모두 확인 필요]
  taskReconnect: (name: string) => `${whoDid(name)} 다시 연결하자고 했어요`,
  taskModeSend: (name: string, me: string) =>
    `${whoDid(name)} 월급은 대부분 ${nim(me)}에게 보낸다고 했어요`,
  taskModeCombine: (name: string) => `${whoDid(name)} 월급을 합쳐서 관리하자고 해요`,
  taskModeManager: (name: string, me: string) =>
    `${whoDid(name)} 생활비 관리를 ${nim(me)}에게 맡기자고 해요`,
  taskSplit: (name: string, account: string) => `${whoDid(name)} ‘${account}’ 나누기를 제안했어요`,
  taskRank: (name: string) => `${whoDid(name)} 자산 순위를 같이 보자고 해요`,
  taskSalaryChanged: '월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?',
  taskFirstSaving: '무엇을 같이 모을지 정해 볼까요?',
  taskSplitSuggest: '같이 쓰는 생활비를 나눠 볼까요?',
  taskSplitDone: '이미 정했어요',
  taskSplitGo: '나누기',
  taskAutoPick: '자동으로 나가는 걸 골라 주세요',
  taskPush: '월급날 아침에 알려 드릴까요?',
  taskPushNoDate: '경조사 일주일 전에 알려 드릴까요?',
  taskNextSaving: (name: string) => `‘${name}’ 기한이 지났어요. 다음엔 뭘 같이 모을까요?`,
  taskReconcile: '실제 잔액과 맞춰 볼까요?',
  taskBundle: (partner: string, goal: string) => `${nim(partner)} ‘${goal}’에 같이 모을까요?`,
  taskInvite: '같이 모을 사람을 초대해 보세요',
  taskWaiting: (name: string | null) =>
    `${name ? `${name}님이` : '파트너가'} 기다리고 있어요. 월급 계획을 마쳐 주세요`,
  inviteNow: '초대하기',

  // H-07 월급 계획 타일, H-08 캘린더 타일
  planTile: '월급 계획',
  everyMonth: (day: string) => `매달 ${day}`,
  payday: (d: number) => `${d}일`,
  paydayLast: '말일',
  noPaydayTile: '돈이 들어올 때', // [확인 필요] 2026-11-13 날짜 없음
  leftover: (amount: string) => `여유 자금 ${amount}`, // [확인 필요] 2026-11-13 H-07
  short: (amount: string) => `${amount}이 모자라요`,
  calendarTile: '캘린더',
  noCare: '다가오는 일정 없어요',
  ddayShort: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요]

  // H-12 결혼 준비 타일 [모두 확인 필요]
  weddingTile: (n: number) => `결혼 준비 메모 ${n}개`,
  weddingNext: (name: string, date: string) => `다음 ${name} ${formatMonthDay(date)}`,
  weddingAdd: '+ 쓸 곳 메모 적기',
  /** 날짜가 지났는데 안 낸 메모가 있으면 그것 먼저(2026-11-14) */
  weddingOverdue: (name: string, date: string) => `${name} ${formatMonthDay(date)} 지났어요`, // [확인 필요]

  // H-04, H-09 작은 타일 [확인 필요]
  assetsTile: '자산 관리',
  noAssets: '아직 없어요', // 2026-11-11 D5 자산·부채가 없을 때(저금 타일과 같음)
  rankBadge: (pct: number) => `상위 ${pct}%`,
  assetsTileLabel: (net: string, rank: string | null) =>
    `자산 관리, 순자산 ${net}${rank ? `, ${rank}` : ''}`, // 화면 읽기용
  savingsTile: '저금', // 2026-11-09 사용자에게는 ‘저금’
  savingCount: (n: number) => `${n}개 모으는 중`,
  noSavings: '아직 없어요',

  // 맨 위 띠
  unlinkWait: '연결 해제를 기다리고 있어요', // [확인 필요] 요청한 사람
  /** 받은 사람 띠 제목(2026-11-11 D5) */
  unlinkRequested: (name: string) => `${whoDid(name)} 연결 해제를 요청했어요`,
  unlinkOn: (date: string) => `${date}에 해제돼요`, // [확인 필요]
  unlinkCheck: '확인하기',
  mailBounced: '알림 메일이 전달되지 않았어요',
  mailBouncedSub: '알림 이메일 주소를 확인해 주세요',
  mailCheck: '확인하기', // [확인 필요]
};
