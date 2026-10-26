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
    lockOn: '앱 잠금 켜짐',
    lockOff: '앱 잠금 꺼짐', // [확인 필요]
    asking: (n: number) => `확인 요청 ${n}`,
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

  // S-11 내 정보와 월급
  me: '내 정보',
  nickname: '이름',
  notifyEmail: '알림 이메일',
  emailError: '이메일 주소를 다시 확인해 주세요',
  save: '저장',
  saved: '저장했어요', // [확인 필요]
  marriage: '결혼 상태',
  marriageValue: { married: '했어요', engaged: '준비 중이에요' },
  weddingDay: { married: '결혼한 날', engaged: '결혼 예정일' }, // [확인 필요]
  weddingPlannedMonth: (y: number, m: number) => `${y}년 ${m}월 예정`, // [확인 필요]
  undecidedValue: '미정', // [확인 필요]
  birthYearRow: '출생연도',
  birthYearValue: (y: number) => `${y}년생`, // [확인 필요]
  salaryGroup: '월급',
  mySalary: '내 월급',
  salaryValue: (amount: string, day: string) => `${amount}, ${day}`,
  variable: '매달 달라요',
  partnerSalary: (name: string, amount: string, day: string) => `${name} ${amount}, ${day}`, // [확인 필요]
  salaryMode: '월급 관리 방식',
  salaryModeValue: { separate: '각자 관리해요', joint: '합쳐서 관리해요' }, // [확인 필요]
  planDay: '체크리스트 만드는 날',
  lastDay: '말일',
  dayN: (n: number) => `${n}일`,
  laterPayday: '늦은 월급날',
  holidayShift: '월급날이 쉬는 날이면 앞당겨 보여줘요',
  holidayShiftLabel: '주말·공휴일 앞당기기', // [확인 필요] 줄 이름
  openSplit: '월급 분배표 열기',
  logout: '로그아웃',
  loggedOut: '로그아웃했어요',
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  unlinkPendingLocked: '연결 해제 대기 중에는 바꿀 수 없어요', // [확인 필요]

  // S-11a
  nicknameQ: '내 이름이나 애칭을 알려 주세요',

  // S-11c 내 월급(O-31과 같음)
  salaryQ: '한 달에 월급이 얼마 들어와요?',
  salaryHelp: '세금 떼고 통장에 들어오는 돈이에요',
  salaryVariableHelp: '가장 적게 들어온 달을 기준으로 적어 주세요',
  noSalary: '지금은 월급이 없어요',
  payday: '월급날',
  salarySaved: '월급을 바꿨어요', // [확인 필요]

  // S-11d 체크리스트 만드는 날
  planDayQ: '체크리스트를 언제 만들까요?', // [확인 필요]
  paydayOf: (name: string, d: string) => `${name} 월급날 ${d}`,
  planDaySaved: '체크리스트 만드는 날을 바꿨어요', // [확인 필요]

  // S-11f 월급 관리 방식
  salaryModeQ: '월급을 어떻게 관리해요?',
  salaryModeHelp: '바꾸면 두 분 모두에게 적용되고, 체크리스트는 다음 월급날부터 바뀌어요', // [확인 필요]
  salaryModes: {
    separate: '각자 월급을 따로 관리해요',
    joint: '합쳐서 같이 관리해요',
  },
  salaryModeSaved: '월급 관리 방식을 바꿨어요', // [확인 필요]

  // S-11g·h·i
  marriageQ: '결혼은 하셨나요?',
  weddingDoneQ: '결혼한 날은 언제예요?',
  weddingPlannedQ: '결혼 예정일은 언제예요?',
  whenPlanned: '언제쯤 예정이에요?',
  undecided: '아직 미정이에요',
  pastOnly: '오늘까지의 날짜를 넣어 주세요', // [확인 필요] O-12와 같음
  futureOnly: '내일부터의 날짜를 넣어 주세요', // [확인 필요] O-12와 같음
  birthYearQ: (me: string) => `${me}님은 몇 년생이에요?`, // [확인 필요]
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
  seeRequest: '확인하기', // [확인 필요]
  proposalsRow: '제안', // [확인 필요] 줄 이름
  frozen: '해제 전까지 분배표를 고칠 수 없어요', // [확인 필요]
  cancelRequest: '요청 취소',
  cancelled: '연결 해제 요청을 취소했어요', // [확인 필요]
  pendingWhen: (name: string, md: string) => `${name}님이 확인하거나 ${md}이 되면 해제돼요`, // [확인 필요]

  // S-12a·c·d 연결 해제(같이 쓰던 데이터는 나누지 않고 모두 지움)
  unlinkQ: '연결을 해제할까요?', // [확인 필요]
  unlinkAll: '해제되면 두 분이 같이 쓰던 데이터가 모두 지워져요', // [확인 필요]
  unlinkList: ['목표', '월급 분배표와 체크리스트', '자산과 부채', '챙길 날', '활동과 알림 기록'], // [확인 필요]
  unlinkWhen: (name: string) => `${name}님이 확인하거나 14일이 지나면 해제돼요`, // [확인 필요]
  unlinkRestart: '해제되면 혼자 쓰기로 처음부터 다시 시작해요', // [확인 필요]
  exportFirst: '먼저 내보내기',
  next: '다음',
  requestedBy: (name: string) => `${name}님이 연결 해제를 요청했어요`,
  unlinkOn: (md: string) => `${md}에 해제돼요`, // [확인 필요]
  acknowledge: '확인했어요', // [확인 필요]
  unlinkedTitle: '연결이 해제됐어요', // [확인 필요]
  unlinkedHelp: '같이 쓰던 데이터는 지웠어요. 혼자 쓰기로 처음부터 시작해요', // [확인 필요]
  startSolo: '시작하기', // [확인 필요]
  reconnectNote: '30일 안에 다시 연결하면 되돌릴 수 있어요',
  reconnectUntil: (md: string) => `${md}까지 다시 연결할 수 있어요`, // [확인 필요] 혼자 쓰기 S-12
  ok: '확인', // [확인 필요]
  newInvite: '새로 초대하기',
  reconnect: '다시 연결하기',
  reconnectSent: (name: string) => `${name}님에게 다시 연결하자고 했어요`, // [확인 필요]
  reconnectAsked: (name: string) => `${name}님이 다시 연결하자고 해요`,
  reconnectBack: '연결을 끊기 전 같이 쓰던 목표와 분배표가 돌아와요', // [확인 필요]
  reconnectDiscard: '해제 뒤 새로 적은 내용은 지워져요', // [확인 필요]
  reconnectYes: '다시 연결할게요',
  reconnectNo: '괜찮아요',
  reconnectExpired: '다시 연결할 수 있는 기간이 지났어요',
  confirmQ: '확인을 위해 ‘연결 해제’라고 적어 주세요', // [확인 필요]
  confirmWord: '연결 해제',
  send: '연결 해제 요청하기', // [확인 필요]
  sent: (name: string) => `${name}님에게 연결 해제를 요청했어요`, // [확인 필요]

  // S-13 공개 범위
  visTitle: '공개 범위',
  vis: { all: '모두 보여 주기', sum: '금액만 보여 주기', private: '숨기기' } as Record<
    string,
    string
  >,
  visDefault: '새 항목 기본값',
  visDefaultSub: '내 자산·내 부채', // [확인 필요]
  visApplyAll: (n: number) => `이미 있는 항목 ${n}개도 바꿀까요?`,
  visAll: '모두 바꾸기',
  visNewOnly: '새 항목만',
  visFixed: [
    // [확인 필요] 기획서 25 S-13 2번 “월급과 분배표는 늘 같이 봐요” 등
    '월급과 분배표는 늘 같이 봐요',
    '우리 목표와 공동 명의 항목은 늘 같이 봐요',
    '챙길 날은 늘 같이 봐요',
  ],
  visFixedTitle: '항상 함께 보는 것', // [확인 필요]
  visMine: '내 항목', // [확인 필요]
  visNone: '내 명의 항목이 없어요',
  visGoals: '내 목표',
  goalVis: { all: '모두 보여 주기', amount: '금액만 보여 주기' } as Record<string, string>,
  visDebt: '부채', // [확인 필요] 항목 이름표
  visLabel: (name: string) => `${name} 공개 범위`,

  // S-21 휴지통
  trash: '휴지통',
  trashNote: '지운 항목은 30일 뒤 완전히 지워져요',
  trashKinds: {
    asset: '자산',
    debt: '부채',
    goal: '목표',
    care_day: '챙길 날',
  } as Record<string, string>,
  trashWhen: (md: string) => `${md}에 지웠어요`,
  trashLeft: (n: number) => `${n}일 남음`,
  restore: '되살리기',
  restored: '되살렸어요',
  restoreProposed: (name: string) => `${name}님에게 되살리자고 제안했어요`, // [확인 필요]
  undo: '되돌리기',
  marketing: '마케팅 정보 받기',
  marketingAt: (date: string) => `${date} 동의`,
  more: '더보기', // [확인 필요] ⋯ 버튼 이름
  purge: '영구 삭제',
  purgeQ: '완전히 지울까요?',
  purgeBody: '되돌릴 수 없어요',
  purgeYes: '지울게요',
  emptyTrash: '휴지통 비우기',
  emptyQ: (n: number) => `${n}개를 완전히 지울까요?`,
  trashEmpty: '휴지통이 비어 있어요',
  purged: '완전히 지웠어요', // [확인 필요]

  // S-18 데이터
  data: '데이터',
  exportTitle: '내보내기',
  scope: { mine: '내 데이터', joint: '공동 데이터' } as Record<string, string>,
  scopeLabel: '범위', // [확인 필요]
  formatCsv: '엑셀(CSV)',
  noPhotos: '사진은 내보내기에 들어가지 않아요',
  doExport: '내보내기',
  exporting: '파일을 만들고 있어요',
  exportFailed: '파일을 만들지 못했어요',
  retry: '다시 시도',
  exported: '파일을 저장했어요', // [확인 필요]
  pinQ: 'PIN을 입력해 주세요', // [확인 필요] 내보내기 본인 확인
  pinWrong: 'PIN이 맞지 않아요', // [확인 필요]
  confirmMe: '확인', // [확인 필요]
  trashCount: (n: number) => `${n}개`,
  analytics: '사용 기록 보내기',
  analyticsSub: '앱을 고치는 데만 써요',
  deleteAccount: '계정 삭제',
  // 파일에 생성일. 이름은 영문(일부 브라우저가 한글·띄어쓰기 이름을 버림)
  fileName: (scope: string, date: string) => `sweetwo-${scope}-${date}.zip`,
  ex: {
    joint: '공동',
    partnerSum: (name: string) => `${name}님 합계`,
    files: {
      assets: '자산.csv',
      debts: '부채.csv',
      goals: '목표.csv',
      splits: '월급 분배표.csv',
      checklists: '월급 체크리스트.csv',
      care: '챙길 날.csv',
    },
    heads: {
      assets: ['이름', '종류', '명의', '금액', '넣은 원금', '만기일', '공개 범위', '마지막 갱신일'],
      debts: ['이름', '종류', '명의', '잔액', '금리', '월 상환액', '만기일'],
      goals: [
        '이름',
        '형태',
        '목표 금액',
        '모은 돈',
        '기한',
        '우선순위',
        '상태',
        '분배표 저금 금액',
      ],
      splits: ['사람', '줄 종류', '줄 이름·목표', '금액'],
      checklists: ['월', '사람', '줄', '금액', '상태', '체크한 사람', '체크한 날'],
      care: ['날짜', '대상', '구분', '예산', '실제 금액', '낸 곳', '드린 것'],
    },
    goalKinds: { once: '한 번', yearly: '매년', monthly: '매달' } as Record<string, string>,
    goalStatus: {
      active: '진행 중',
      delayed: '지연',
      achieved: '달성',
      used: '사용 완료',
      paused: '보류',
    } as Record<string, string>,
    lineKinds: {
      saving: '저금',
      fixed: '고정지출',
      living: '생활비',
      allowance: '용돈',
      custom: '직접 추가',
    } as Record<string, string>,
    checkState: { checked: '체크함', skipped: '못 함', wait: '체크 안 함' } as Record<
      string,
      string
    >,
    careCats: { family: '양가', couple: '부부', wedding: '결혼' } as Record<string, string>,
    paidFrom: {
      goal_fund: '목표자금',
      living: '생활비',
      personal: '각자 돈',
      wedding_account: '결혼 준비 통장',
      personal_support: '각자 돈(지원)',
    } as Record<string, string>,
  },

  // S-18b 계정 삭제
  deleteMine: (n: number) => `내 명의 항목 ${n}개는 지워져요`,
  deleteSharedGone: '같이 쓰던 데이터도 모두 지워져요',
  deleteWholeSpace: '부부 공간 전체 삭제',
  deleteRestore: '30일 안에 다시 로그인하면 복구돼요',
  deleteWith: (p: string) => `${p}로 확인하고 삭제`,
  deleteQ: '계정을 삭제할까요?', // [확인 필요] 확인 Modal 제목
  deletedNotice: (md: string) =>
    `계정 삭제 요청을 받았어요. ${md}까지 다시 로그인하면 취소할 수 있어요`,

  // S-19 앱 정보
  about: '앱 정보',
  version: '버전',
  whatsNew: '새 기능 보기',
  checkUpdate: '업데이트 확인',
  terms: '이용약관',
  privacy: '개인정보 처리방침',
  contact: '문의하기',
  myInquiries: '내 문의',
  siteUrl: 'https://sweetwo.kr', // 웹사이트(L-03, L-05, L-06)

  // S-19a 문의하기·내 문의
  categoryLabel: '분류', // [확인 필요]
  categories: {
    account: '계정·로그인',
    couple: '부부 연결',
    calc: '계산·플랜',
    sync: '동기화',
    billing: '결제·환불',
    privacy: '개인정보',
    etc: '기타',
  } as Record<string, string>,
  bodyLabel: '내용',
  bodyHelp: '금액이나 계좌번호는 적지 않아도 돼요', // [확인 필요]
  attachApp: '앱 정보 함께 보내기',
  attachAppSub: '앱 버전, OS, 부부 상태. 금액과 메모는 보내지 않아요', // [확인 필요]
  sendInquiry: '보내기',
  inquirySent: (no: string) => `문의 #${no}를 받았어요`,
  inquiryStatus: {
    received: '접수',
    in_progress: '처리 중',
    waiting_user: '답변 도착', // [확인 필요] 사용자 쪽 이름
    done: '완료',
  } as Record<string, string>,
  noInquiries: '보낸 문의가 없어요', // [확인 필요]
  inquiryNo: (no: string) => `문의 #${no}`,
  me2: '나', // [확인 필요] 대화의 내 쪽 이름
  agent: '상담원', // [확인 필요]
  reply: '덧붙이기', // [확인 필요]
  replyLabel: '더 알려 줄 내용', // [확인 필요]
  replySent: '보냈어요', // [확인 필요]
  closedNote: '완료된 지 7일이 지나 새 문의로 보내 주세요', // [확인 필요]
  accessAsk: '문의를 확인하려면 동의가 필요해요',
  accessSee: '확인하기', // [확인 필요]
  accessOn: '상담원이 확인 중이에요',
  accessLeft: (h: number) => `${h}시간 남았어요`,
  accessStop: '지금 그만 보게 하기',
  accessStopped: '이제 운영자는 볼 수 없어요',

  // S-19b 관리자 열람 동의
  access24: '동의하면 24시간만 봐요',
  accessCan: '볼 수 있어요', // [확인 필요] 섹션 이름
  accessCannot: '보지 않아요', // [확인 필요]
  accessRange: '금액은 구간으로',
  accessRaw: '금액이 그대로 보여요',
  accessNever: ['메모', '가족 정보', '사진', '비공개 항목', '용돈 내역'],
  accessScopes: {
    month: '이번 달 화면',
    plan: '월급 플랜 화면',
    close: '월말 정리 화면',
    goals: '목표 화면',
    assets: '우리 자산 화면',
    income_spend: '월 수입·지출 화면',
    calendar: '캘린더 화면',
  } as Record<string, string>,
  accessYes: '동의해요',
  accessNo: '거절할게요',
  accessDeclined: '거절했어요. 다른 방법으로 도와드릴게요', // [확인 필요]

  // S-20 도움말
  help: '도움말',
  faq: '자주 묻는 질문',
  faqSearch: '자주 묻는 질문에서 찾기', // [확인 필요] 검색 칸
  faqNone: '찾는 답이 없어요',

  // S-10a 통장 방식
  accountMode: '통장 방식',
  accountModeQ: '통장을 어떻게 쓸까요?', // [확인 필요] 질문 문구
  accountModes: { single: '통장 하나로 써요', roles: '역할별로 나눠 쓸래요' } as Record<
    string,
    string
  >,
  accountModeNext: '다음 월급 플랜부터 바뀌어요', // [확인 필요]
  accountModeValue: (now: string, next: string | null) => (next ? `${now} → ${next}` : now),

  // S-15 보안
  security: '보안',
  appLock: '앱 잠금',
  appLockSub: 'PIN 6자리로 잠가요', // [확인 필요]
  changePin: 'PIN 바꾸기',
  touchId: (kind: 'touch' | 'face' | 'fingerprint') =>
    kind === 'fingerprint' ? '지문으로 풀기' : `${kind === 'face' ? 'Face ID' : 'Touch ID'}로 풀기`, // [확인 필요]
  autoLock: '자동 잠금',
  autoLockOptions: { 1: '1분', 5: '5분', 15: '15분', 0: '사용 안 함' } as Record<number, string>,
  currentPin: '지금 PIN을 입력해 주세요', // [확인 필요]
  devices: '로그인된 기기',
  thisDevice: '지금 이 기기',
  lastUsed: (md: string) => `${md}에 마지막으로 썼어요`, // [확인 필요]
  logoutDevice: '로그아웃',
  logoutAll: '모든 기기에서 로그아웃',
  loggedOutDevice: '그 기기에서 로그아웃했어요', // [확인 필요]

  // S-14 알림
  cap: '이메일은 한 달에 6번까지만 보내요',
  push: '푸시 알림',
  email: '이메일',
  livingCheck: '생활비 체크',
  livingCheckSub: (partner: string) => `켜면 ${partner}님도 함께 받아요`,
  groups: {
    plan: '월급 체크리스트',
    partner_change: (name: string) => `${name}님이 바꾼 값`,
    care: '챙길 날',
    money: '돈 날짜',
    goal: '목표',
    invite: '배우자 초대',
  },
  partnerChangeSub: '분배표·관리 방식·목표 변경은 바로, 나머지는 월요일에 모아서 알려요', // [확인 필요]
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
  // S-01~S-03 가이드
  guidesTitle: '가이드 모아보기',
  checklistProgress: (done: number, total: number) => `체크리스트 ${done}/${total}`,
  checklistStage: (stage: string) => `${stage} 체크리스트`, // [확인 필요] 요소 이름
  forUs: '우리 상황에 맞는 글', // [확인 필요] 요소 이름
  topics: '주제별 가이드', // [확인 필요] 요소 이름
  talkCards: '부부 대화 카드 다시 보기',
  steps: '해야 할 일', // [확인 필요] 요소 이름
  sources: '출처', // [확인 필요] 요소 이름
  checked: (date: string) => `확인일 ${date}`,
  doneBy: (name: string) => `${name}님이 완료했어요`,
  markDone: '완료했어요',
  applyToUs: '우리에게 적용하기',
  notAdvice: '투자·금융 자문이 아니에요. 제도와 개념만 설명해요', // [확인 필요] 고지 문구
  noStage: '지금 단계의 체크리스트가 없어요', // [확인 필요]
  // S-17 내 답 다시 보기
  answersTitle: '내 답 다시 보기',
  parts: {
    p0: '우리', // [확인 필요] 파트 이름
    p1: '우리 상황',
    p2: '목표',
    p3: '수입과 지출',
    p4: '자산과 부채',
    p5: '용돈과 분담',
  },
  reanswer: '다시 답하기',
  replan: '계획 다시 세우기',
  answerRows: {
    nickname: '내 호칭',
    side: '신랑·신부',
    marriage: '결혼 상태',
    housing: '사는 집',
    employment: '일하는 방식',
    child: '아이 계획',
    goals: '고른 목표',
    income: '월 수입',
    fixed: '고정지출',
    living: '생활비',
    assets: '자산과 부채',
    allowance: '내 용돈',
    split: '분담 방식',
  },
  goalsCount: (n: number) => `${n}개`,
  marriageState: { married: '결혼했어요', engaged: '준비 중이에요' } as Record<string, string>,
  housingOptions: {
    jeonse: '전세',
    monthly_rent: '반전세·월세',
    own: '자가',
    parents: '부모님 집',
    none: '아직 안 구했어요',
  },
  employmentOptions: {
    regular: '정규직',
    contract: '계약직',
    freelance: '프리랜서·사업자',
    resting: '쉬는 중',
  },
  childOptions: {
    within_1y: '1년 안',
    in_1_3y: '1~3년',
    after_3y: '3년 뒤',
    none: '없어요',
    unsure: '아직 모르겠어요',
  },
  askHousing: '지금 어떤 집에 사세요?',
  askEmployment: (name: string) => `${name}님은 어떻게 일하고 계세요?`,
  askChild: '아이 계획이 있으세요?',
  askSplit: '같이 쓰는 돈 나누는 방식, 괜찮아요?',
  savedAnswer: '바꿨어요',
  proposedTo: (name: string) => `${name}님에게 제안했어요`,
  // S-11e 프로필 사진
  photo: '프로필 사진',
  photoChange: '사진 바꾸기',
  photoRemove: '사진 지우기',
  photoRemoved: '사진을 지웠어요', // [확인 필요]
  photoDrop: '사진을 끌어 놓거나 골라 주세요',
  photoPick: '사진 고르기',
  photoHelp: 'JPG, PNG, HEIC, WebP, 10MB 이하',
  photoNotice: (partner: string) => `올린 사진은 ${partner}님과 나만 볼 수 있어요`,
  photoNoticeSolo: '올린 사진은 나만 볼 수 있어요', // [확인 필요] 혼자 쓰기
  photoTooBig: '10MB 이하 사진만 올릴 수 있어요',
  photoBadType: '이 형식은 올릴 수 없어요',
  photoStage: '사진 위치, 화살표로 옮겨요',
  photoZoom: '확대', // [확인 필요] 화면 읽기용
  photoPreview: '미리보기', // [확인 필요] 화면 읽기용
  photoAgain: '다시 고르기',
  photoSave: '저장할게요',
  photoSaved: '사진을 바꿨어요',
  // S-22 위젯
  widgetTitle: '위젯',
  widgetTray: '트레이 아이콘',
  widgetTrayHelp: '앱 창을 닫아도 트레이에 남아요',
  widgetAmounts: '위젯에 금액 보이기',
  widgetGoal: '목표 위젯에 보일 목표',
  widgetNoGoal: '목표 없음',
  widgetTrayOn: '트레이 켜짐',
  widgetTrayOff: '트레이 꺼짐', // [확인 필요]
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
