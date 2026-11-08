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
  menuGroups: { work: '운영', content: '발송과 콘텐츠', manage: '관리' }, // [확인 필요]
  globalSearch: '전체에서 찾기', // [확인 필요] 상단 바 검색 이름(자리표시는 search)
  roles: { super: '최고 관리자', ops: '운영', cs: 'CS', analyst: '분석' } as Record<string, string>,
  signOut: '로그아웃',
  seenAt: (t: string) => `${t} 접속`,

  // 로그인
  loginTitle: '어드민 로그인', // [확인 필요] 위에 흑백 워드마크 + ‘어드민’ 태그가 있음
  email: '회사 이메일', // [확인 필요]
  sendLink: '로그인 링크 받기', // [확인 필요]
  linkSent: '메일함에서 링크 열기', // [확인 필요]
  sentTo: (email: string) => `${email}로 링크 보냄`, // [확인 필요]
  otherEmail: '다른 이메일로 받기', // [확인 필요]
  tooSoon: '잠시 뒤 다시 시도', // [확인 필요]
  notAllowedEmail: '로그인할 수 없는 이메일', // [확인 필요]
  resendIn: (s: number) => `${s}초 뒤 다시 받기 가능`, // [확인 필요]
  mfaEnrollTitle: '인증 앱 등록', // [확인 필요]
  mfaEnrollHelp: 'Google Authenticator 같은 인증 앱으로 QR 스캔 후 6자리 입력', // [확인 필요]
  mfaTitle: '인증 앱 6자리 입력', // [확인 필요]
  code: '6자리 숫자', // [확인 필요]
  verify: '확인', // [확인 필요]
  reauthTitle: '인증 앱 6자리 다시 입력', // [확인 필요] 재인증(33 3장)
  reauthGo: '확인',
  wrongCode: '숫자 불일치', // [확인 필요]
  notAdmin: '권한 없음',
  noPermission: '권한 없음',
  toDashboard: '대시보드로',
  expired: '30분 미사용으로 로그아웃됨', // [확인 필요]
  failed: '오류. 다시 시도',
  noRows: '기록 없음', // [확인 필요] 빈 표(2026-11-06 검수)
  retry: '다시 시도',

  // AD-01
  alerts: '상시 경보', // [확인 필요]
  alertKinds: { loan_rate_stale: '평균 금리 마지막 갱신' } as Record<string, string>, // [확인 필요]
  alertValue: (kind: string, v: number, limit: number) =>
    kind === 'loan_rate_stale' ? `${v}일 전 / 기준 ${limit}일` : `${v} / 기준 ${limit}`, // [확인 필요]
  failedJobs: '실패 건수', // [확인 필요]
  failedPlans: '체크리스트 생성 실패',
  failedNotis: '알림 발송 실패',
  openInquiries: '미처리 문의', // [확인 필요]
  received: '접수',
  inProgress: '처리 중',
  aggregatedAt: (t: string) => `${t} 집계`, // [확인 필요]
  // AD-01 4~7번(2026-11-06) [확인 필요]
  membersTitle: '회원 현황', // [확인 필요]
  memberTotal: '전체 회원', // [확인 필요]
  joinedToday: '오늘 가입', // [확인 필요]
  vsYesterday: (n: number) => `어제 ${n.toLocaleString('ko-KR')}명`, // [확인 필요]
  connectedCouples: '연결된 커플', // [확인 필요]
  deletionToday: '오늘 삭제 요청', // [확인 필요]
  trendTitle: '최근 7일', // [확인 필요]
  // [확인 필요] 커플 연결
  trendKinds: { joined: '가입', connected: '커플 연결', checked: '체크한 줄' } as Record<
    string,
    string
  >, // [확인 필요]
  trendTable: '최근 7일 표', // [확인 필요] 표 보기 접기 제목
  versionsTitle: '앱 버전', // [확인 필요]
  belowMin: '최소 버전 미만 기기(최근 7일 실행)', // [확인 필요]
  versionCols: { platform: '기기', version: '버전', devices: '기기 수' }, // [확인 필요]
  recentTitle: '최근 활동', // [확인 필요]
  approvalsWaiting: '승인 대기', // [확인 필요]
  recentInquiries: '최근 문의', // [확인 필요]
  recentAudit: '최근 감사 로그', // [확인 필요]
  seeAll: '모두 보기', // [확인 필요]
  none: '없음', // [확인 필요]

  // AD-02
  search: '이메일, 사용자 ID, 문의 번호로 찾기',
  noMember: '일치하는 회원 없음',
  // AD-02 내려받기(L0 열만, 사유 입력 후, 파일에 관리자 ID)
  download: '내려받기',
  downloadReason: '내려받는 이유', // [확인 필요]
  downloadGo: '사유 남기고 내려받기', // [확인 필요]
  downloadBy: (admin: string, at: string) => `내려받은 관리자 ${admin}, ${at}`, // [확인 필요] 파일 첫 줄
  downloadName: (date: string) => `sweetwo-members-${date}.csv`,
  cols: {
    userId: '사용자 ID',
    email: '이메일',
    joined: '가입일',
    couple: '커플 상태', // [확인 필요]
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
  space: '커플 공간', // [확인 필요]
  consents: '동의 내역', // [확인 필요]
  data: '데이터', // [확인 필요]
  provider: '로그인 수단', // [확인 필요]
  lastSeen: '최근 접속', // [확인 필요]
  sessions: (n: number) => `로그인된 기기 ${n}대`, // [확인 필요]
  deleting: (days: number) => `삭제 유예 중, ${days}일 남음`,
  partner: '파트너 ID', // [확인 필요]
  invite: (made: string, until: string, used: string | null) =>
    used ? `${made} 발급, ${used} 사용` : `${made} 발급, ${until} 만료`, // [확인 필요]
  counts: (a: number, est: number, g: number, c: number) =>
    `자산 ${a}개, 그중 추정 ${est}개, 저금 항목 ${g}개, 끝난 체크리스트 ${c}번`, // [확인 필요]
  planStatus: '이번 달 체크리스트', // [확인 필요]
  checklistStates: { open: '진행 중', done: '다 했어요', closed: '끝남' } as Record<string, string>,
  checklistLine: (label: string, state: string, checked: number, total: number) =>
    `${label} ${state}, ${checked}/${total}줄 체크`, // [확인 필요]
  salaryMode: '월급 관리 방식', // [확인 필요]
  salaryModes: { separate: '각자', joint: '합쳐서' } as Record<string, string>,
  devices: '기기·앱 버전', // [확인 필요]
  deviceLine: (platform: string, version: string, seen: string) =>
    `${platform} ${version}, ${seen} 마지막 실행`, // [확인 필요]
  platforms: { desktop: '데스크톱', ios: 'iOS', android: 'Android', web: '웹' } as Record<
    string,
    string
  >,
  providers: { kakao: '카카오', google: '구글', apple: '애플', email: '이메일' } as Record<
    string,
    string
  >,
  consentKinds: {
    terms: '이용약관',
    privacy: '개인정보처리방침',
    space_sharing: '커플 공간 공유', // [확인 필요]
    family_info: '양가 가족 정보',
    photo: '사진',
    marketing: '마케팅 수신',
    analytics: '분석 수집',
    peer_stats: '통계 참여',
  } as Record<string, string>,
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
  revealUntil: (t: string) => `${t}까지 표시`, // [확인 필요]
  l2: 'L2 사용자 동의',
  l2Scopes: {
    month: '이번 달 화면',
    plan: '이번 달 화면', // 예전 키(지금은 month)
    close: '월말 확인 화면', // 예전 키, 새 요청에는 없음
    goals: '월급 화면', // [확인 필요] 2026-11-08 ADR 0007 목표 탭 자리(키는 그대로)
    assets: '우리 자산 화면',
    income_spend: '월 수입·지출(없앤 화면)', // 예전 키, 새 요청에는 없음
    calendar: '캘린더 화면',
  } as Record<string, string>,
  raw: '금액 원값 요청',
  rawHelp: '화면 1개만. 최고 관리자 승인 후 요청, 거절 시 구간으로', // [확인 필요]
  rawRequested: '원값 승인 요청됨', // [확인 필요]
  sendRequest: '동의 요청 보내기',
  requested: '동의 요청됨', // [확인 필요]
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
    close: '월말 확인',
  }, // [확인 필요]
  agreedCol: '동의 여부', // [확인 필요]
  agreed: '동의',
  refused: '거부', // [확인 필요]
  versionCol: '버전', // [확인 필요]
  device: '기기', // [확인 필요]

  // AD-05
  actions: {
    login_move: '로그인 수단 이전',
    sign_out_all: '전체 기기 로그아웃',
    delete_request: '삭제 대리 접수',
    rights_access: '권리 요구 기록: 열람',
    rights_fix: '권리 요구 기록: 정정',
    rights_delete: '권리 요구 기록: 삭제',
  } as Record<string, string>,
  note: '메모', // [확인 필요]
  run: '실행', // [확인 필요]
  done: '처리됨', // [확인 필요]
  confirmSignOut: '모든 기기에서 로그아웃?', // [확인 필요]
  confirmDelete: '계정 삭제 접수?', // [확인 필요]
  confirmDeleteHelp: '30일 뒤 삭제. 그 전 재로그인 시 취소', // [확인 필요]
  newAccount: '새 계정 이메일 또는 사용자 ID', // [확인 필요]
  newAccountHelp: '본인 확인 → 새 소셜 계정으로 1회 로그인 → 최고 관리자 승인 시 이전', // [확인 필요]
  moveRequested: '승인 요청됨', // [확인 필요]
  moveErrors: {
    new_not_found: '새 계정 없음',
    new_no_login: '새 계정에 로그인 수단 없음',
    new_has_partner: '새 계정이 다른 커플에 연결됨',
    same_account: '같은 계정',
    already_requested: '이미 승인 대기 중',
    not_active: '사용 중인 계정 아님',
    reason_required: '문의 번호 확인 필요',
  } as Record<string, string>, // [확인 필요]
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
    couple: '커플 연결', // [확인 필요]
    calc: '저금 항목·월급 체크리스트', // 2026-11-08 ADR 0007
    sync: '동기화',
    billing: '결제·환불',
    privacy: '개인정보',
    etc: '기타',
  } as Record<string, string>,
  inqCols: {
    no: '문의 번호',
    category: '분류',
    elapsed: '경과 시간',
    channel: '채널',
    created: '받은 시각',
  }, // [확인 필요] 채널
  channels: { app: '앱', email: '이메일' } as Record<string, string>,
  noInquiry: '문의 없음', // [확인 필요]
  attach: '자동 첨부',
  attachKeys: {
    app_version: '앱 버전',
    platform: '플랫폼',
    os: 'OS',
    couple_state: '커플 상태', // [확인 필요]
    sync: '동기화',
    error: '최근 오류 코드',
  } as Record<string, string>,
  attachValues: {
    online: '온라인',
    offline: '오프라인',
    mac: 'macOS',
    windows: 'Windows',
    ios: 'iOS',
    android: 'Android',
    desktop: '데스크톱',
    web: '웹',
    other: '기타',
  } as Record<string, string>,
  statusLabel: '상태', // [확인 필요]
  answer: '답변',
  sendAnswer: '답변 보내기',
  answered: '답변 보냄', // [확인 필요]
  user: '사용자', // [확인 필요]
  admin: '운영자', // [확인 필요]
  emailInfo: '이메일', // [확인 필요] 이메일 문의 상세 묶음 이름
  emailKeys: {
    subject: '제목',
    from: '보낸 사람',
    member: '회원',
    attachments: '첨부 파일',
  }, // [확인 필요]
  noSubject: '제목 없음', // [확인 필요]
  noMemberLink: '회원 연결 없음', // [확인 필요]
  attachmentsDropped: (n: number) => `${n}개 미수신, 메일함에서 확인`, // [확인 필요]
  emailAnswerHelp: '메일 발송 연결 전까지 답장은 네이버웍스 help@에서 직접', // [확인 필요]
  elapsed: (h: number) => (h < 24 ? `${h}시간` : `${Math.floor(h / 24)}일 ${h % 24}시간`),

  // AD-17
  auditTitle: '감사 로그',
  change: '바뀐 값', // [확인 필요] 감사 로그 행 상세(전 → 후)
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
  noAudit: '기록 없음', // [확인 필요]

  // AD-20
  docSearch: '문서 검색',
  docGroups: { spec: '기획서', design: '디자인', dev: '개발 가이드', adr: 'ADR' } as Record<
    'spec' | 'design' | 'dev' | 'adr',
    string
  >, // [확인 필요]
  docUpdated: (v: string) => `마지막 수정 ${v.split(' ').reverse().join(', 커밋 ')}`, // [확인 필요] ‘마지막 수정 2026-11-06, 커밋 af6ea4a’
  designPreview: '디자인 시스템 미리보기',
};

export type Copy = typeof copy;

// 운영(AD-10·14·15·16·18·19, 승인)
export const ops = {
  // AD-10
  noticeTitle: '공지',
  noticeEmpty: '공지 없음', // [확인 필요]
  newNotice: '새 공지', // [확인 필요]
  noticeCols: {
    title: '제목',
    kind: '종류',
    importance: '중요도',
    period: '노출 기간',
    status: '상태',
  }, // [확인 필요]
  noticeKinds: {
    info: '일반',
    maintenance: '점검',
    incident: '장애 고지',
    terms: '약관 개정',
  } as Record<string, string>, // [확인 필요]
  importance: { normal: '일반', must: '필독' } as Record<string, string>,
  noticeStatus: {
    draft: '초안',
    requested: '승인 대기',
    published: '게시',
    cancelled: '내림',
  } as Record<string, string>, // [확인 필요]
  platforms: { desktop: '데스크톱 앱', mobile: '모바일 앱' } as Record<string, string>, // [확인 필요]
  field: {
    title: '제목',
    body: '내용',
    starts: '시작',
    ends: '끝',
    kind: '종류',
    importance: '중요도',
    platforms: '대상 플랫폼',
    email: '이메일로도 보내기',
    emailHelp: '노출 시작 때 전체 회원에게 1회 발송(메일 상한 무관)',
    // 장애 고지는 영향받은 회원(대상 조건)에게만(33 ‘1등급 장애 뒤 고지’)
    emailHelpTarget: '노출 시작 때 대상 회원에게 1회 발송(메일 상한 무관)',
  }, // [확인 필요]
  // 27 AD-10 2번 대상. 금액 조건 없음
  target: {
    title: '대상', // 27 AD-10 2번
    all: '약관 개정은 전체 회원', // [확인 필요]
    coupleStates: '커플 상태', // 27 AD-10 2번 [확인 필요]
    coupleHelp: '미선택 시 전체', // [확인 필요]
    versionBelow: '이 버전보다 낮은 앱만', // [확인 필요]
    versionHelp: '예: 1.4.0, 비우면 전체', // [확인 필요]
    weeksMin: '가입 주차(부터)', // [확인 필요]
    weeksMax: '가입 주차(까지)', // [확인 필요]
    weeksHelp: '가입 주 = 1주차, 비우면 전체', // [확인 필요]
    badVersion: '버전 형식: 1.4.0', // [확인 필요]
    badWeeks: '가입 주차: 1~520, 시작 ≤ 끝', // [확인 필요]
  },
  // 27 AD-10 4번 대상 수: 이름표 “대상” “제외” + “3,214명”
  audience: {
    title: '대상 수', // 27 AD-10 4번
    target: '대상',
    excluded: '제외',
    people: (n: number) => `${n.toLocaleString('ko-KR')}명`,
    blocked: '반송·수신 거부', // [확인 필요] 메일이 막힌 주소
    zero: '대상 0명, 승인 요청 불가', // [확인 필요] 27 AD-10 예외 ‘대상 0명’
    failed: '대상 수 계산 실패', // [확인 필요]
  },
  // 27 AD-10 6번 미리보기: 공지는 홈 상단 띠, 메일은 받은 메일 모양
  preview: {
    title: '미리보기', // 27 AD-10 6번
    band: '홈 상단 띠', // [확인 필요]
    mail: '이메일', // [확인 필요]
    // 앱 공지 띠 버튼(packages/app frame copy와 같은 문구)
    open: '보기',
    fold: '접기',
    close: '닫기',
    from: '보내는 곳 sweeTwo', // [확인 필요]
    sign: 'sweeTwo',
    emptyTitle: '제목 미입력', // [확인 필요]
  },
  // 27 AD-10 7번 테스트 발송: 내부 계정(내 관리자 메일)만
  testSend: '테스트 발송', // 27 AD-10 7번
  testSent: '내 메일로 보냄', // [확인 필요]
  testTooMany: '테스트 메일은 10분에 5회까지', // [확인 필요]
  saveDraft: '초안 저장', // [확인 필요]
  belowMin: (n: number) => `최소 버전 미만 기기 ${n}대(90일 내 실행)`, // [확인 필요]
  requestApproval: '승인 요청',
  endNotice: '내리기', // [확인 필요]
  quietHours: '밤 10시~아침 8시 시작 불가', // [확인 필요]
  saved: '저장됨', // [확인 필요]
  requestedApproval: '승인 요청됨', // [확인 필요]

  // 콘텐츠
  contentTitle: '콘텐츠',
  tabs: { guides: '가이드·도움말', terms: '약관·개인정보 처리방침', data: '계산·기준 데이터' },
  guideKinds: { guide: '가이드 글', checklist: '단계별 체크리스트', faq: '도움말' } as Record<
    string,
    string
  >,
  versionCols: {
    kind: '종류',
    key: '항목',
    version: '버전',
    effective: '시행일',
    checked: '출처 확인일',
  }, // [확인 필요]
  recheck: '재검토', // [확인 필요] 확인일 6개월 지남
  addVersion: '버전 추가', // [확인 필요]
  termsKinds: { terms: '이용약관', privacy: '개인정보 처리방침' } as Record<string, string>,
  termsCols: {
    kind: '종류',
    version: '버전',
    effective: '시행일',
    reconsent: '재동의',
    agreed: '동의 수',
    status: '상태',
  }, // [확인 필요]
  reconsent: '재동의 요구',
  legalChecked: '법률 검토 확인', // [확인 필요]
  termsStatus: { requested: '승인 대기', approved: '승인', rejected: '거절' } as Record<
    string,
    string
  >, // [확인 필요]
  yes: '예', // [확인 필요]
  no: '아니요', // [확인 필요]
  loanTitle: '대출 유형별 평균 금리', // [확인 필요]
  loanKinds: {
    mortgage: '주택담보',
    jeonse: '전세',
    credit: '신용',
    student: '학자금',
    card_loan: '카드론·현금서비스',
  } as Record<string, string>,
  loanCols: { kind: '유형', rate: '연 금리', applied: '적용일', updated: '마지막 갱신' }, // [확인 필요] 마지막 갱신
  loanAppliedPick: '저장할 때 적용일', // [확인 필요],
  holidayTitle: '공휴일', // [확인 필요]
  // AD-19 항목 이름 목록 [확인 필요]
  kindTitle: '항목 이름 목록',
  kindCols: { name: '이름', base: '따르는 항목', hidden: '숨김' },
  kindDefault: '기본 항목',
  kindAdd: '칩 추가',
  kindReset: '처음대로',
  holidayKinds: { holiday: '공휴일', substitute: '대체공휴일', temporary: '임시공휴일' } as Record<
    string,
    string
  >,
  date: '날짜', // [확인 필요]
  name: '이름', // [확인 필요]
  save: '저장', // [확인 필요]
  remove: '지우기', // [확인 필요]

  // 시스템
  systemTitle: '시스템',
  sysTabs: { approvals: '승인', app: '앱 버전·점검', admins: '관리자 계정', audit: '감사 로그' },
  approvalCols: { summary: '내용', by: '요청한 사람', at: '요청 시각', status: '상태' }, // [확인 필요]
  approvalStatus: {
    requested: '기다리는 중',
    approved: '승인',
    rejected: '거절',
    cancelled: '취소',
  } as Record<string, string>,
  approve: '승인', // [확인 필요]
  reject: '거절', // [확인 필요]
  cancelRequest: '요청 취소', // [확인 필요]
  noApproval: '승인할 요청 없음', // [확인 필요]
  superMin: '최고 관리자 최소 1명 필요', // [확인 필요] 33 2장 최소 1명(2026-11-06)
  appCols: {
    latest: '최신 버전(데스크톱)',
    minDesktop: '최소 지원 버전(데스크톱)',
    minWeb: '최소 지원 버전(웹)',
    minIos: '최소 지원 버전(iOS)',
    minAndroid: '최소 지원 버전(Android)',
  }, // [확인 필요]
  maintenance: '점검 예약', // [확인 필요]
  maintenanceMsg: '점검 문구', // [확인 필요]
  adminCols: {
    email: 'ID',
    name: '이름',
    roles: '역할',
    last: '마지막 접속',
    mfa: '2단계 인증',
    locked: '잠금',
  },
  addAdmin: '관리자 추가·역할 바꾸기', // [확인 필요]
  lock: '잠그기', // [확인 필요]
  unlock: '잠금 풀기', // [확인 필요]
  review: '분기 점검 기록', // [확인 필요]
  reviewNote: '점검 내용', // [확인 필요]
  addReview: '기록 남기기', // [확인 필요]
  notLinked: '첫 로그인 전', // [확인 필요]
};
