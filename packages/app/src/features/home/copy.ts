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
  /** 목표 금액이 있을 때 보조 한 줄(2026-11-20) */
  pctOfTarget: (pct: number, target: string) => `${pct}%, ${target} 중`, // [확인 필요]
  thisMonthGain: (amount: string) => `이번 달 +${amount}`,
  /** 아직 안 들어간 묶음(상대가 만듦) 칸 첫 줄(2026-11-14 H1) */
  togetherInvite: (name: string) => `${name}님이 같이 모으자고 해요. 눌러서 볼 수 있어요`,
  remain: (deadline: string, amount: string) => `${ym(deadline)}까지 ${amount} 더 필요해요`,
  remainPercent: (deadline: string) => `${ym(deadline)}까지`,
  each: (a: string, x: string, b: string, y: string) => `${a} ${x}, ${b} ${y}`,
  paused: '같이 모으기를 잠시 멈췄어요',
  doneBadge: '다 모았어요',
  seeAll: '저축·투자 모두 보기',
  emptyAsk: '무엇을 같이 모을까요?',
  /** 빈 상태에 상대 저금 권유가 있을 때 칩(2026-11-14 R4) */
  inviteJoin: '같이 모을게요', // [확인 필요]
  /** 같이 모으기 큰 숫자 아래 이름(묶음 합계, W-02 저금 줄 ‘내 몫’과 나눔, R4) */
  bothSaved: '둘이 모은 금액', // [확인 필요]
  emptyAdd: '모으기 시작하기', // [확인 필요] 2026-11-18 H-10 빈 상태 버튼(예전 ‘+ 저축·투자 추가’, O-60과 같은 말)
  emptyCustom: '직접 정하기', // [확인 필요] 2026-11-18 H-10 빈 상태 맨 끝 칩(W-11a를 이름 칸 빈 채로 엶)
  widgetAmount: (won: string) => `${won} 모았어요`, // [확인 필요] 26 WG-01 S-22 ‘위젯에 금액 보이기’를 켰을 때 한 줄
  widgetSaving: '모으는 중', // [확인 필요] 26 WG-01 목표 금액이 없고 금액 가림
  /** 화면 읽기 문장 하나(“같이 모으기, 결혼 비용, 3,100만 원, 목표 금액의 62%, …”) */
  togetherLabel: (parts: string[]) => ['같이 모으기', ...parts].filter(Boolean).join(', '),
  targetPctLabel: (pct: number) => `목표 금액의 ${pct}%`,
  chips: {
    wedding: '결혼 비용',
    newlywed_home: '신혼집',
    honeymoon: '신혼여행',
    dowry: '혼수',
    emergency: '비상금',
    home: '내 집 마련',
    travel: '여행',
    car: '차',
    childcare: '출산·육아',
    retire: '노후',
    moving: '이사',
    appliance: '가전·가구',
    anniv_gift: '기념일 선물',
    date: '데이트 비용',
    lump: '목돈',
  } satisfies Record<SavingChip, string>,

  // H-11 이번 달 한 줄 [모두 확인 필요]
  monthFirst: (date: string) => `${formatMonthDay(date)} 첫 월급날에 확인해요`,
  monthFirstNoDate: '첫 월급날에 확인해요',
  monthDone: (start: string, kind: 'all' | 'mixed') =>
    `${formatMonthDay(start)} 월급, ${kind === 'all' ? '계획대로 됐어요' : '확인을 마쳤어요'}`,
  untilNext: (n: number) => `다음 월급날까지 ${n}일`,
  monthPayday: (n: number) => `월급날이에요. 확인할 게 ${n}개 있어요`,
  monthAutoOnly: '이번 달은 자동으로 나가는 것뿐이에요',
  autoNext: (day: number, n: number) => `${day}일에 ${n}개 나가요`,
  monthReview: (start: string, n: number) =>
    `${formatMonthDay(start)} 월급에서 확인할 게 ${n}개 남았어요`,
  lateLeft: (n: number) => `지난달 확인할 게 ${n}개 남았어요`,
  nonManager: '이번 달 보낼 금액과 용돈은 자동으로 정해져요',
  goView: '보기',
  goCheck: '확인하기',

  // H-06 할 일 띠 v2.2 [모두 확인 필요]
  taskReconnect: (name: string) => `${whoDid(name)} 다시 연결하자고 했어요`,
  taskModeSend: (name: string, me: string) =>
    `${whoDid(name)} 월급은 대부분 ${nim(me)}에게 보낸다고 했어요`,
  taskModeCombine: (name: string) => `${whoDid(name)} 월급을 합쳐서 쓰자고 해요`,
  taskModeManager: (name: string, me: string) =>
    `${whoDid(name)} 생활비 관리를 ${nim(me)}에게 맡기자고 해요`,
  taskSplit: (name: string, account: string) => `${whoDid(name)} ‘${account}’ 나누기를 알렸어요`,
  taskRank: (name: string) => `${whoDid(name)} 자산 순위를 같이 보자고 해요`,
  // [확인 필요] 19 띠 5a(2026-11-16 5차 검토 B5): 혼자 쓸 때 적은 자산을 연결할 때 숨겨 두고 한 번 물음
  taskAssetShare: (name: string) => `혼자 쓸 때 적은 자산을 ${nim(name)}에게 어떻게 보여 줄까요?`,
  taskSalaryChanged: '월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?',
  taskFirstSaving: '무엇을 같이 모을지 정해 볼까요?',
  taskSplitSuggest: '같이 쓰는 생활비를 나눠 볼까요?',
  taskSplitDone: '이미 정했어요',
  /** 목록 시트 8번 줄 오른쪽 알약(2026-11-20, 같은 동작: 띠를 영구히 닫음) [확인 필요] */
  taskDecided: '정했어요',
  // 띠 둘 → 한 띠(2026-11-16 4차 검토) [확인 필요]
  tasksCount: (n: number) => `할 일 ${n}개`, // [확인 필요]
  tasksTitle: '할 일', // [확인 필요] 목록 시트 제목
  // 띠 5c(2026-11-20): 홈을 열면 W-12로 넘어가던 것을 대신함 [확인 필요]
  taskGoalAchieved: (name: string) => `${name} 다 모았어요`, // [확인 필요]
  // 띠 11a(2026-11-20): 모으는 저금이 하나도 없는데 그만 모은 것이 있을 때 [확인 필요]
  taskNextGoal: '다음엔 뭘 모을까요?', // [확인 필요]
  taskSplitGo: '나누기',
  taskAutoPick: '자동으로 나가는 걸 골라 주세요',
  taskPush: '월급날 아침에 알려 드릴까요?',
  taskPushNoDate: '경조사 일주일 전에 알려 드릴까요?',
  taskNextSaving: (name: string) => `‘${name}’ 기한이 지났어요. 다음엔 뭘 같이 모을까요?`,
  taskReconcile: '통장 잔액과 모은 금액을 맞춰 볼까요?',
  taskBundle: (partner: string, goal: string) => `${nim(partner)}의 ‘${goal}’에 같이 모을까요?`, // [확인 필요] 2026-11-16 R4-8
  taskInvite: '같이 모을 사람을 초대해 보세요',
  taskWaiting: (name: string | null) =>
    `${name ? `${name}님이` : '파트너가'} 기다리고 있어요. 월급 계획을 마저 만들어 볼까요?`,
  inviteNow: '초대하기',
  // 띠 5b 월급날 확인(2026-11-17): 문장은 위 monthPayday·monthReview·lateLeft, 이동 글자는 goCheck

  // H-15 월급 상자 ‘월급 계획 템플릿’ 줄 값(예전 H-07 타일 내용), H-08 캘린더 타일
  payday: (d: number) => `${d}일`,
  paydayLast: '말일',
  noPaydayTile: '수입이 들어올 때', // 2026-11-13 날짜 없음
  leftover: (amount: string) => `미계획 ${amount}`, // 2026-11-13 H-07, 2026-11-17 월급 상자 ‘월급 계획 템플릿’ 줄 보조, 2026-11-23 짧은 자리 규칙 ‘미계획’(예전 “미계획 금액 20만 원”)
  short: (amount: string) => `${amount}이 모자라요`,
  calendarTile: '캘린더',
  /** H-08 보조 줄(2026-11-24 구역 4: 일정 이름 + D-day “{이름} D-2”, H-16과 같은 첫 항목, 당일 “{이름} 오늘”, 없음 null) [확인 필요] */
  nextSchedule: (next: { name: string; days: number } | null) =>
    next === null
      ? '기념일을 적어 보세요' // 2026-11-25 사용자 확정(예전 “다가오는 일정이 없어요”)
      : next.days === 0
        ? `${next.name} 오늘`
        : `${next.name} D-${next.days}`,
  /** H-16 다가오는 날 상자 머리(2026-11-20) [확인 필요] */
  upcomingTitle: '다가오는 날',
  ddayShort: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요]

  // H-12 결혼 준비 타일 [모두 확인 필요]
  // 0개일 때는 개수 없이 “결혼 준비 메모”(2026-11-20) [확인 필요]
  weddingTile: (n: number) => (n === 0 ? '결혼 준비 메모' : `결혼 준비 메모 ${n}개`),
  weddingNext: (name: string, date: string) => `다음 ${name} ${formatMonthDay(date)}`,
  weddingAdd: '+ 쓸 곳 메모 추가',
  /** 저축·투자가 하나도 없으면(쓸 곳 메모를 붙일 곳이 없음) 누르면 저축·투자 추가(W-11a)로 가므로 이름도 맞춤(2026-11-25, 예전엔 “+ 쓸 곳 메모 추가”인데 저축·투자 추가로 감) [확인 필요] */
  weddingAddSaving: '+ 저축·투자 추가',
  /** 날짜가 지났는데 안 낸 메모가 있으면 그것 먼저(2026-11-14) */
  weddingOverdue: (name: string, date: string) => `${name}, ${formatMonthDay(date)}이 지났어요`,

  // H-04, H-09 작은 타일 [확인 필요]
  assetsTile: '자산 관리',
  /** H-04 값 이름표와 값 아래 작은 줄(2026-11-20) [확인 필요] */
  netLabel: '순자산',
  // 2026-11-18 빈 타일에서 자산을 적고 싶게(궁금함, 파트너 소식) [확인 필요]
  assetsEmpty: '아직 적은 자산이 없어요', // 2026-11-26 빈 상태 규칙(예전 “…또래 중 어디쯤일까요?” 둘/나 두 문구를 하나로)
  assetsPartner: (name: string) => `${name}님이 자산을 적었어요`,
  rankBadge: (pct: number) => `상위 ${pct}%`,
  assetsTileLabel: (net: string, rank: string | null) =>
    `자산 관리, 순자산 ${net}${rank ? `, ${rank}` : ''}`, // 화면 읽기용

  // 맨 위 띠
  unlinkWait: '연결 해제를 기다리고 있어요', // [확인 필요] 요청한 사람
  /** 받은 사람 띠 제목(2026-11-11 D5) */
  unlinkRequested: (name: string) => `${whoDid(name)} 연결 해제를 요청했어요`,
  unlinkOn: (date: string) => `${date}에 해제돼요`, // [확인 필요]
  unlinkCheck: '확인하기',
  mailBounced: '알림 메일이 전달되지 않았어요',
  mailBouncedSub: '알림 이메일 주소를 확인해 주세요',
  mailCheck: '확인하기', // [확인 필요]

  // H-15 월급 상자(2026-11-17, 메뉴 서랍과 같은 이름·순서) [모두 확인 필요]. 줄 이름은 서랍 하위 줄과 똑같이
  salaryBox: '월급',
  rowMonth: '이번 달 월급 체크',
  rowPlan: '월급 계획 템플릿',
  // 이번 달 월급 체크 값(H-11 상태를 짧게 줄인 것)
  leftShort: (n: number) => `${n}개 남음`,
  lateShort: (n: number) => `지난달 ${n}개 남음`,
  doneShort: (kind: 'all' | 'mixed') => (kind === 'all' ? '계획대로 됐어요' : '확인을 마쳤어요'),
  autoShort: '자동으로 나가요',
  firstShort: (date: string | null) => (date ? `${formatMonthDay(date)}부터` : '첫 월급날부터'),
  zeroSalaryShort: '월급 0원', // [확인 필요] 2026-11-19 H-15 ‘월급 계획 템플릿’ 줄 값(월급 0원이고 월급날도 없을 때)
  nonManagerShort: '자동으로 정해져요',
  // 날짜 없는 사람(H-13 기간)을 이 줄에 담음
  periodNoneShort: '수입 적기',
  periodEarlyShort: (won: string) => `수입 ${won}`,
  periodBarShort: (inn: string, need: string) => `${inn} / ${need}`,
  periodBarSub: '수입 / 월급 계획',
  periodGapShort: (n: number) => `마지막 수입 ${n}일 전`,
};
