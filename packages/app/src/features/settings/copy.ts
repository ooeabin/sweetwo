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
    visibilityValue: '내 자산 합계만',
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
