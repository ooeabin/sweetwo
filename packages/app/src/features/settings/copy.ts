import { withAnd } from '@sweetwo/core';

// 설정 문구(docs/spec/25-settings.md S-10, S-11, S-11a, S-14, S-14a). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '설정',
  back: '뒤로',
  couple: (a: string, b: string) => (b ? `${withAnd(a)} ${b}` : a),
  providers: { kakao: '카카오', google: '구글', apple: 'Apple' } as Record<string, string>,
  loggedIn: (p: string) => `${p}로 로그인했어요`,
  state: {
    connected: (name: string) => `${name}님과 연결됨`,
    not_joined: '초대 중',
    unlink_pending: '연결 해제 대기 중',
    solo: '혼자 쓰는 중',
  },
  rows: {
    couple: '부부 정보',
    visibility: '공개 범위',
    visibilityValue: (v: string) => `내 자산 ${v}`, // [확인 필요]
    noti: '알림',
    security: '보안',
    answers: '내 답 다시 보기',
    guide: '가이드 모아보기',
    screen: '화면',
    screenValue: '기기 설정을 따라요',
    help: '도움말',
    data: '데이터',
    dataSub: '내보내기, 휴지통, 계정 삭제',
    about: '앱 정보·문의',
    widget: '위젯',
    widgetSub: '트레이 켜짐',
  },
  later: '준비 중이에요', // [확인 필요] 아직 없는 화면 줄

  // S-11 내 정보
  me: '내 정보',
  nickname: '호칭', // [확인 필요] 줄 이름
  notifyEmail: '알림 이메일',
  emailError: '이메일 주소를 다시 확인해 주세요',
  save: '저장',
  saved: '저장했어요', // [확인 필요]
  planDay: '월급 플랜 날짜',
  planDayValue: (d: string) => d,
  lastDay: '말일',
  dayN: (n: number) => `${n}일`,
  laterPayday: '늦은 월급날',
  holidayShift: '월급날이 쉬는 날이면 앞당겨 보여줘요',
  holidayShiftLabel: '주말·공휴일 앞당기기', // [확인 필요] 줄 이름
  split: '분담 방식',
  splitModes: { half: '반반', income: '버는 만큼', custom: '직접 정할게요' },
  splitValue: (mode: string, a: number, b: number) => `${mode} ${a} : ${b}`,
  logout: '로그아웃',
  loggedOut: '로그아웃했어요',
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',

  // S-11a
  nicknameQ: '뭐라고 부르면 될까요?',

  // S-11b
  sideRow: '신랑·신부', // [확인 필요] 줄 이름
  sideQ: '신랑·신부 중 누구예요?',
  sides: { groom: '신랑', bride: '신부' },

  // S-11d
  planDayQ: '월급 플랜을 언제 세울까요?',
  paydayOf: (name: string, d: string) => `${name} 월급날 ${d}`,
  proposeTo: (name: string) => `${name}님께 제안하기`,
  proposed: (name: string) => `${name}님에게 제안했어요`,
  applyNote: (date: string) => `좋아요면 바로, 반대 없으면 ${date}부터 적용돼요`,
  openProposal: '답을 기다리는 제안이 있어요', // [확인 필요]
  seeProposal: '제안 보기', // [확인 필요]

  // S-12 부부 정보
  coupleTitle: '부부 정보',
  connected: '연결됨',
  weddingPlanned: '결혼 예정일',
  weddingDone: '결혼일',
  dday: (n: number) => (n === 0 ? '오늘' : n < 0 ? `D+${-n}` : `D-${n}`), // 지난 날 D+[확인 필요]
  inviteFirst: (name: string) => `${name}님을 초대해 주세요`,
  inviteFirstAny: '배우자를 초대해 주세요', // [확인 필요] 새로 초대(호칭 없음)
  inviteMake: '초대 코드 만들기',
  inviteCode: '초대 코드', // [확인 필요] 줄 이름
  inviteUntil: (md: string) => `${md}까지`,
  inviteExpired: '초대가 만료됐어요',
  copyCode: '코드 복사',
  copyLink: '링크 복사',
  newCode: '새 코드 받기',
  copied: '복사했어요', // [확인 필요] O-07과 같음
  newCodeDone: '새 코드를 받았어요. 이전 코드는 이제 못 써요', // [확인 필요]

  unlink: '연결 해제',
  pendingWait: (name: string) => `${name}님 답을 기다리고 있어요`,
  pendingReceived: (name: string) => `${name}님이 연결 해제를 요청했어요`,
  seePlan: '자산 정리 안 보기',
  proposalsRow: '제안', // [확인 필요] 줄 이름
  frozen: '해제 전까지 멈춤',
  cancelRequest: '요청 취소',
  cancelled: '연결 해제 요청을 취소했어요', // [확인 필요]
  deadline: (md: string) => `${md}까지 정하지 않으면 분담 비율로 정리해요`,

  // S-12a~c 연결 해제 요청
  unlinkQ: '연결을 해제할까요?', // [확인 필요]
  unlinkHow: [
    // [확인 필요] 정리되는 방식(31 보안·개인정보 4장을 해요체로)
    '내 명의 자산, 수입, 용돈은 나에게 남아요',
    '공동 목표와 통장 몫은 자산 정리 안대로 나눠요',
    '월 플랜, 월말 정리, 제안 기록은 해제할 때까지의 사본이 둘 다에게 남아요',
    '양가 가족 정보는 그 가족 쪽 사람에게 남아요',
  ],
  unlinkWedding: '결혼 비용은 각자 낸 돈 기준 요약을 둘 다에게 남겨요', // [확인 필요] 예비부부만
  unlinkWhen: (name: string) => `${name}님이 동의하면 바로, 아니면 14일 뒤에 해제돼요`, // [확인 필요]
  closeFirst: (month: number) => `${month}월 월급 플랜 정리부터 할까요?`,
  closeStart: '정리 시작',
  next: '다음',
  planTitle: (a: number, b: number) => `분담 비율 ${a} : ${b}로 정리했어요`,
  myShare: (name: string) => `${name} 내 몫`, // [확인 필요] 금액 칸 이름(화면 읽기)
  theirShare: (name: string, v: string) => `${name}님 몫 ${v}`, // [확인 필요]
  shareOver: '금액보다 많이 넣을 수 없어요', // [확인 필요]
  assetsTotal: '자산', // [확인 필요] 합계 줄 이름
  debtsTotal: '부채', // [확인 필요]
  debtAmount: (v: string) => `부채 ${v}`, // [확인 필요]
  agree: '동의해요',
  differently: '다르게 정리하기',
  counterQ: '어떻게 나눌지 다시 정해 주세요', // [확인 필요] S-12e 제목
  counterSent: (name: string) => `${name}님에게 다르게 정리한 안을 보냈어요`, // [확인 필요]
  counterDone: '다르게 정리한 안을 보냈어요', // [확인 필요] 받은 사람 S-12d
  counterReceived: (name: string) => `${name}님이 자산 정리 안을 다르게 정리했어요`,
  counterHelp: (md: string) => `동의하면 바로, 아니면 ${md}에 분담 비율로 정리돼요`,
  seeCounter: '확인하기', // [확인 필요]
  unlinkedTitle: '연결이 해제됐어요', // [확인 필요] S-12h 제목(알림 문구와 같음)
  movedMine: (v: string) => `${v} 원은 각자 목표로 옮겨요`,
  reconnectNote: '30일 안에 다시 연결하면 되돌릴 수 있어요',
  reconnectUntil: (md: string) => `${md}까지 다시 연결할 수 있어요`, // [확인 필요] 혼자 쓰기 S-12
  ok: '확인', // [확인 필요]
  newInvite: '새로 초대하기',
  reconnect: '다시 연결하기',
  reconnectSent: (name: string) => `${name}님에게 다시 연결하자고 했어요`, // [확인 필요]
  reconnectAsked: (name: string) => `${name}님이 다시 연결하자고 해요`,
  reconnectBack: '연결을 끊기 전 공동 목표·통장이 돌아와요',
  reconnectYes: '다시 연결할게요',
  reconnectNo: '괜찮아요',
  reconnectExpired: '다시 연결할 수 있는 기간이 지났어요',
  confirmQ: '확인을 위해 ‘연결 해제’를 입력해 주세요', // [확인 필요]
  confirmWord: '연결 해제',
  send: '보내기', // [확인 필요]
  sent: (name: string) => `${name}님에게 연결 해제를 요청했어요`, // [확인 필요]

  // S-13 공개 범위
  visTitle: '공개 범위',
  vis: { all: '전체 공개', sum: '합계만', private: '비공개' } as Record<string, string>,
  visDefault: '새 항목 기본값',
  visDefaultSub: '내 자산·내 부채', // [확인 필요]
  visApplyAll: (n: number) => `이미 있는 항목 ${n}개도 바꿀까요?`,
  visAll: '모두 바꾸기',
  visNewOnly: '새 항목만',
  visFixed: [
    // [확인 필요] 기획서 “‘수입·용돈 금액 항상 공유’ 등 3줄”
    '수입·용돈 금액 항상 공유',
    '공동 명의 항목은 항상 전체 공개',
    '목표와 양가 일정은 항상 전체 공개',
  ],
  visFixedTitle: '항상 함께 보는 것', // [확인 필요]
  visMine: '내 항목', // [확인 필요]
  visNone: '내 명의 항목이 없어요',
  visDebt: '부채', // [확인 필요] 항목 이름표
  visLabel: (name: string) => `${name} 공개 범위`,

  // S-21 휴지통
  trash: '휴지통',
  trashNote: '지운 항목은 30일 뒤 완전히 지워져요',
  trashKinds: {
    asset: '자산',
    debt: '부채',
    goal: '목표',
    family: '가족',
    care_day: '챙길 날',
  } as Record<string, string>,
  trashWhen: (md: string) => `${md}에 지웠어요`,
  trashLeft: (n: number) => `${n}일 남음`,
  restore: '되살리기',
  restored: '되살렸어요',
  restoreProposed: (name: string) => `${name}님에게 되살리자고 제안했어요`, // [확인 필요]
  undo: '되돌리기',
  more: '더보기', // [확인 필요] ⋯ 버튼 이름
  purge: '영구 삭제',
  purgeQ: '완전히 지울까요?',
  purgeBody: '되돌릴 수 없어요',
  purgeYes: '지울게요',
  emptyTrash: '휴지통 비우기',
  emptyQ: (n: number) => `${n}개를 완전히 지울까요?`,
  trashEmpty: '휴지통이 비어 있어요',
  purged: '완전히 지웠어요', // [확인 필요]

  // S-14 알림
  cap: '이메일은 한 달에 6번까지만 보내요',
  push: 'OS 알림',
  email: '이메일',
  groups: {
    plan: '월급 플랜·월말 정리',
    proposal: '제안',
    partner_change: (name: string) => `${name}님이 바꾼 값`,
    care: '챙길 날',
    money: '돈 날짜',
    goal: '목표',
    invite: '배우자 초대',
  },
  partnerChangeSub: '주 1회 모아서, 수입 변경은 바로 알려요',
  carePoints: { care_30: 'D-30', care_14: 'D-14', care_7: 'D-7', care_0: '당일' },
  channels: '받는 방법',
  noChannel: '알림을 받을 방법이 없어요',
  turnOff: '끄기', // [확인 필요]
  cancel: '취소',
  quiet: '방해 금지 시간',
  quietValue: (a: string, b: string) => `${a} ~ ${b}`,
  channelsOn: (on: string[]) => (on.length ? on.join(', ') : '꺼짐'), // [확인 필요] 둘 다 끔

  // S-14a
  quietQ: '알림을 받지 않을 시간을 정해 주세요',
  quietStart: '시작', // [확인 필요]
  quietEnd: '끝', // [확인 필요]
};

/** 시각 이름(“밤 10시”, “아침 8시”) [확인 필요] 0~5시 새벽, 6~11시 아침, 12시 낮, 13~17시 오후, 18~20시 저녁, 21~23시 밤 */
export function hourLabel(h: number) {
  if (h === 0) return '밤 12시';
  if (h < 6) return `새벽 ${h}시`;
  if (h < 12) return `아침 ${h}시`;
  if (h === 12) return '낮 12시';
  if (h < 18) return `오후 ${h - 12}시`;
  if (h < 21) return `저녁 ${h - 12}시`;
  return `밤 ${h - 12}시`;
}
