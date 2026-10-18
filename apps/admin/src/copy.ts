// 어드민 문구(docs/spec/27-admin-screens.md, 33-admin.md). 기획서 “ ” 안 문장을 그대로, 해요체.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  menus: {
    dashboard: '대시보드',
    members: '회원',
    inquiries: '문의',
    send: '발송',
    content: '콘텐츠',
    system: '시스템',
    docs: '문서',
  },
  roles: { super: '최고 관리자', ops: '운영', cs: 'CS', analyst: '분석' } as Record<string, string>,
  signOut: '로그아웃',
  seenAt: (t: string) => `${t} 접속`,

  // 로그인
  loginTitle: 'sweeTwo 어드민', // [확인 필요]
  loginHelp: '회사 이메일로 로그인 링크를 보내요', // [확인 필요]
  email: '회사 이메일', // [확인 필요]
  sendLink: '로그인 링크 받기', // [확인 필요]
  linkSent: '메일함에서 링크를 눌러 주세요', // [확인 필요]
  mfaEnrollTitle: '인증 앱을 등록해 주세요', // [확인 필요]
  mfaEnrollHelp: '인증 앱으로 QR을 찍고 6자리 숫자를 넣어 주세요', // [확인 필요]
  mfaTitle: '인증 앱의 6자리 숫자를 넣어 주세요', // [확인 필요]
  code: '6자리 숫자', // [확인 필요]
  verify: '확인', // [확인 필요]
  wrongCode: '숫자가 맞지 않아요. 다시 넣어 주세요', // [확인 필요]
  notAdmin: '권한이 없어요',
  noPermission: '권한이 없어요',
  toDashboard: '대시보드로',
  expired: '30분 동안 쓰지 않아 로그아웃했어요', // [확인 필요]
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',

  // AD-01
  alerts: '상시 경보', // [확인 필요]
  failedJobs: '실패 건수', // [확인 필요]
  failedPlans: '플랜 생성 실패',
  failedNotis: '알림 발송 실패',
  openInquiries: '미처리 문의', // [확인 필요]
  received: '접수',
  inProgress: '처리 중',
  aggregatedAt: (t: string) => `${t} 집계`, // [확인 필요]

  // AD-02
  search: '이메일, 사용자 ID, 문의 번호로 찾기',
  noMember: '일치하는 회원이 없어요',
  cols: {
    userId: '사용자 ID',
    email: '이메일',
    joined: '가입일',
    couple: '부부 상태',
    sub: '구독',
  },
  coupleStates: {
    not_joined: '미합류',
    connected: '연결',
    unlink_pending: '해제 대기',
    solo: '혼자 쓰기',
  } as Record<string, string>,

  // AD-03
  memberTitle: '회원 상세', // [확인 필요]
  reveal: '개인정보 보기',
  askConsent: '동의 요청',
  action: '계정 조치',
  account: '계정', // [확인 필요]
  space: '부부 공간', // [확인 필요]
  consents: '동의 내역', // [확인 필요]
  data: '데이터', // [확인 필요]
  provider: '로그인 수단', // [확인 필요]
  lastSeen: '최근 접속', // [확인 필요]
  sessions: (n: number) => `로그인된 기기 ${n}대`, // [확인 필요]
  deleting: (days: number) => `삭제 유예 중, ${days}일 남음`,
  partner: '배우자 ID', // [확인 필요]
  invite: (made: string, until: string, used: string | null) =>
    used ? `${made} 발급, ${used} 사용` : `${made} 발급, ${until} 만료`, // [확인 필요]
  counts: (a: number, est: number, g: number, c: number) =>
    `자산 ${a}개, 그중 추정 ${est}개, 목표 ${g}개, 정리한 달 ${c}번`,
  planStatus: '플랜 상태', // [확인 필요]
  hoursLeft: (h: number) => `${h}시간 남음`,
  see: '보기',

  // AD-04
  l1: 'L1 사유 입력',
  l1Reason: '사유', // [확인 필요]
  l1Reasons: ['본인 확인', '로그인 문제', '결제 문의', '권리 요구 처리'], // [확인 필요]
  inquiryNo: '문의 번호', // [확인 필요]
  l1Scopes: { email: '이메일 전체', sign_ins: '접속 기록', payments: '결제 내역' } as Record<
    'email' | 'sign_ins' | 'payments',
    string
  >,
  revealGo: '보기',
  revealUntil: (t: string) => `${t}까지 보여요`, // [확인 필요]
  l2: 'L2 사용자 동의',
  l2Scopes: {
    month: '이번 달 화면',
    plan: '월급 플랜 화면',
    close: '월말 정리 화면',
    goals: '목표 화면',
    assets: '우리 자산 화면',
    income_spend: '월 수입·지출 화면',
    calendar: '캘린더 화면',
  } as Record<string, string>,
  raw: '금액 원값 요청',
  sendRequest: '동의 요청 보내기',
  requested: '동의를 요청했어요', // [확인 필요]
  accessStatus: {
    requested: '대기',
    approved: '동의',
    declined: '거절',
    expired: '만료',
    done: '끝',
  } as Record<string, string>,
  l2View: '동의 범위 보기', // [확인 필요]
  l2Labels: {
    income: '월 수입',
    fixed: '고정지출',
    living: '생활비 예산',
    loan: '대출 상환',
    close: '월말 정리',
  }, // [확인 필요]
  agreedCol: '동의 여부', // [확인 필요]
  agreed: '동의',
  refused: '거부', // [확인 필요]
  versionCol: '버전', // [확인 필요]
  device: '기기', // [확인 필요]

  // AD-05
  actions: {
    sign_out_all: '전체 기기 로그아웃',
    rights_access: '권리 요구 기록: 열람',
    rights_fix: '권리 요구 기록: 정정',
    rights_delete: '권리 요구 기록: 삭제',
  } as Record<string, string>,
  note: '메모', // [확인 필요]
  run: '실행', // [확인 필요]
  done: '처리했어요', // [확인 필요]
  confirmSignOut: '이 회원의 모든 기기에서 로그아웃할까요?', // [확인 필요]
  cancel: '취소',

  // AD-06
  statuses: {
    received: '접수',
    in_progress: '처리 중',
    waiting_user: '사용자 답변 대기',
    done: '완료',
  } as Record<string, string>,
  categories: {
    account: '계정·로그인',
    couple: '부부 연결',
    calc: '계산·플랜',
    sync: '동기화',
    billing: '결제·환불',
    privacy: '개인정보',
    etc: '기타',
  } as Record<string, string>,
  inqCols: { no: '문의 번호', category: '분류', elapsed: '경과 시간', channel: '채널' }, // [확인 필요] 채널
  channels: { app: '앱', email: '이메일' } as Record<string, string>,
  noInquiry: '문의가 없어요', // [확인 필요]
  attach: '자동 첨부',
  statusLabel: '상태', // [확인 필요]
  answer: '답변',
  sendAnswer: '답변 보내기',
  answered: '답변을 보냈어요', // [확인 필요]
  user: '사용자', // [확인 필요]
  admin: '운영자', // [확인 필요]
  elapsed: (h: number) => (h < 24 ? `${h}시간` : `${Math.floor(h / 24)}일 ${h % 24}시간`),

  // AD-17
  auditTitle: '감사 로그',
  auditCols: {
    at: '시각',
    admin: '관리자',
    action: '동작',
    target: '대상',
    reason: '사유·변경',
    approver: '승인자',
  },
  auditActions: {
    search: '검색',
    view: '조회',
    reveal: '열람',
    request: '요청',
    execute: '실행',
    approve: '승인',
    download: '내려받기',
    edit: '수정',
  } as Record<string, string>,
  filter: { admin: '관리자', target: '대상 ID', action: '동작', from: '시작일', to: '끝일' }, // [확인 필요]
  all: '전체', // [확인 필요]
  ip: '접속 IP',
  screen: '화면',
  noAudit: '기록이 없어요', // [확인 필요]

  // AD-20
  docSearch: '문서 검색',
  designPreview: '디자인 시스템 미리보기',
};

export type Copy = typeof copy;
