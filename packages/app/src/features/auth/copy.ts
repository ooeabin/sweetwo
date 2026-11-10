import type { AuthProvider } from '@sweetwo/core';

// 로그인, 가입 문구(docs/spec/15-login-signup.md). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것(기획서에 정해지면 바꾼다).
export const providerName: Record<AuthProvider, string> = {
  kakao: '카카오',
  google: '구글',
  apple: '애플',
};

type Bio = 'touch' | 'face' | 'fingerprint';
/** “Touch ID로”, “Face ID로”, “지문으로” */
const bioObj = (kind: Bio) =>
  kind === 'fingerprint' ? '지문으' : kind === 'face' ? 'Face ID' : 'Touch ID';

export const copy = {
  toStart: '처음으로', // [확인 필요] 넓은 창 A-02 뒤로 글자
  // A-01
  maintenanceTitle: '지금 점검 중이에요',
  maintenanceEnds: (time: string) => `${time}에 끝나요`,
  updateTitle: '새 버전으로 업데이트해 주세요',
  updateSub: '지금 버전으로는 저장할 수 없어요',
  updateNow: '지금 업데이트',
  downloadUrl: 'https://sweetwo.kr/download',
  viewOnly: '업데이트 없이 보기만 할게요',
  offlineNoSession: '인터넷에 연결하면 로그인할 수 있어요',
  retry: '다시 시도',
  // 13 공통 상태 5번: 판단이 10초 넘게 걸리면(서버 무응답) 스플래시 아래 Banner + 다시 시도(2026-11-10)
  slow: '연결이 느려요',
  // 13 공통 상태 7번: 실행 판단 중 예상 못 한 오류(2026-11-10 가입 실패 문구 대신 제목·보조 둘로)
  errorTitle: '잠시 문제가 생겼어요',
  errorHelp: '다시 시도해 주세요',

  // O-01·A-02 공용 히어로 캐치프레이즈(04-brand.md 슬로건). 하나만 쓰고 새 표어를 만들지 않는다
  catchphrase: '둘이 구워서 더 달콤한 자산파이',
  // O-01 서브 2줄
  startHelp: '매달 월급을 나누고 달성 체크하면,\n함께한 시간만큼 자산파이가 커져요.', // 2026-11-10 사용자 확정

  // O-01
  start: '시작하기',
  invitedAsk: '초대를 받았나요?', // [확인 필요]
  invitedLink: '코드 입력하기', // [확인 필요]

  // A-02
  recent: '최근 사용',
  // 초대로 들어왔을 때(P-01 ‘합류하기’ → A-02). 캐치프레이즈 대신
  joinTitle: (inviter: string) => `${inviter}님 공간에 합류할 계정을 골라요`,
  // 2026-11-10 제공자 공식 문구 그대로(카카오 로그인 디자인 가이드, Google·Apple 브랜드 가이드). ‘3초’는 뺌
  continueWith: {
    kakao: '카카오로 3초 만에 로그인', // 2026-11-10 사용자 결정
    google: 'Google로 계속하기',
    apple: 'Apple로 계속하기',
  } satisfies Record<AuthProvider, string>,
  emailConflict: (p: AuthProvider) => `이미 ${providerName[p]}로 가입한 이메일이에요`,
  providerError: (p: AuthProvider) =>
    `${providerName[p]} 로그인에 문제가 생겼어요. 다른 방법으로 해볼까요?`,
  offline: '인터넷에 연결되면 할 수 있어요',
  pinLockedOut: 'PIN을 5번 틀려서 다시 로그인해 주세요', // 디자인 LockScreen
  forgotPinNotice: '다시 로그인하면 새 PIN을 정할 수 있어요', // [확인 필요] A-06 ‘PIN을 잊었어요’ 뒤 A-02 띠(2026-11-10)

  // A-03
  loginWith: {
    kakao: '카카오로 로그인',
    google: '구글로 로그인',
    apple: '애플로 로그인',
  } satisfies Record<AuthProvider, string>,
  waitTitle: '브라우저에서 로그인 중이에요',
  waitHelp: '로그인을 마치면 앱으로 돌아와요',
  reopen: '브라우저 다시 열기',
  cancel: '취소',
  doneTitle: '로그인을 마쳤어요',
  doneHelp: 'sweeTwo 앱으로 돌아가요',
  openApp: 'sweeTwo 열기',
  timeout: '로그인이 끝나지 않았어요. 다시 시도해 주세요',
  cancelled: '로그인을 취소했어요',
  relogin: '다시 로그인해 주세요',
  restoreTitle: '계정 삭제를 취소할까요?',
  restoreYes: '취소하고 계속 쓰기',
  restoreNo: '그대로 두기',
  restoreHelp: '복구하면 혼자 쓰기로 돌아와요', // [확인 필요]
  browserFailed: '브라우저를 열지 못했어요',

  // A-04
  emailTitle: '알림 받을 이메일을 알려 주세요',
  // [확인 필요] 2026-11-10 실제로 보내는 메일(14 ‘상한 밖’ + 푸시를 못 받을 때 월급 전 확인)과 31 5-1에 맞춤
  emailHelp: '계정 보안, 약관 변경, 문의 답변처럼 꼭 필요한 안내만 보내요',
  emailTypo: (s: string) => `혹시 ${s}인가요?`, // [확인 필요] 흔한 도메인 오타(2026-11-10)
  emailTypoFix: '이 주소로 고치기', // [확인 필요]
  emailLabel: '알림 이메일', // 설정 이름
  emailPlaceholder: 'name@example.com',
  next: '다음',
  emailInvalid: '이메일 주소를 다시 확인해 주세요',

  // A-05
  termsTitle: '약관에 동의해 주세요', // [확인 필요] A-05 제목 문구
  agreeAll: '모두 동의해요(선택 포함)', // [확인 필요] 2026-11-10 선택 항목도 켜진다는 걸 이름에
  requiredAll: '[필수] 서비스 이용에 동의해요', // [확인 필요] 필수 약관 묶음
  foldRequired: '필수 약관 펼치기',
  adult: '[필수] 만 18세 이상이에요',
  terms: '[필수] 이용약관',
  privacy: '[필수] 개인정보 수집·이용',
  spaceSharing: '[필수] 파트너와 우리 둘 공간 공유', // [확인 필요]
  marketing: '[선택] 마케팅 정보 받기',
  view: '보기',
  close: '닫기',
  agreeContinue: '동의하고 계속하기',
  // A-05r 약관 개정 재동의(바뀐 필수 항목만)·마케팅 2년 재확인 [확인 필요]
  reconsentTitle: '바뀐 약관을 확인해 주세요',
  reconsentHelp: '바뀐 항목만 다시 동의하면 이어서 쓸 수 있어요',
  marketingAgainTitle: '마케팅 정보를 계속 받을까요?',
  marketingAgainHelp: '동의한 지 2년이 지나 다시 여쭤봐요',
  marketingKeep: '계속 받을게요',
  marketingStop: '그만 받을게요',
  reconsentFailed: '저장하지 못했어요. 다시 시도해 주세요',
  changesView: '바뀐 점 보기', // [확인 필요] A-05r 바뀐 약관 원문(웹사이트 L-05)을 앱 안에서(2026-11-10)
  signupFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  restoreFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요', // [확인 필요] A-02 삭제 취소 실패(2026-11-06)

  // A-06
  pinSetTitle: '앱을 열 때 쓸\nPIN 6자리를 정해 주세요',
  pinSetSub: '자리를 비우면 5분 뒤 잠겨요',
  pinConfirm: '한 번 더\n입력해 주세요',
  pinMismatch: 'PIN이 서로 달라요',
  pinWeak: '같은 숫자나 이어지는 숫자는 쓸 수 없어요', // [확인 필요] 기획서는 규칙만 있음
  pinSaveFailed: 'PIN을 저장하지 못했어요. 처음부터 다시 정해 주세요', // [확인 필요] 2026-11-10
  // 생체 인증 이름(15 A-06 1·5번): iPhone Touch ID, iPhone Face ID, Android 지문
  bioName: { touch: 'Touch ID', face: 'Face ID', fingerprint: '지문' } as const,
  touchIdAsk: (kind: Bio) => `${bioObj(kind)}로도 풀까요?`,
  touchIdYes: (kind: Bio) => `${copy.bioName[kind]} 켜기`, // [확인 필요] 버튼 문구
  // [확인 필요] 생체 질문 보조 1줄
  touchIdHelp: (kind: Bio) =>
    kind === 'face'
      ? '다음부터 PIN 대신 얼굴로 열 수 있어요'
      : '다음부터 PIN 대신 지문으로 열 수 있어요',
  later: '나중에 할게요',
  pinUnlockTitle: 'PIN을 입력해 주세요', // 2026-11-10 한 줄로
  touchIdUnlock: (kind: Bio) => `${bioObj(kind)}로 풀기`,
  forgotPin: 'PIN을 잊었어요',
  // ‘PIN을 잊었어요’ 확인 Modal(2026-11-10) [확인 필요]
  forgotTitle: 'PIN을 잊었나요?',
  forgotBody: '로그아웃하고 다시 로그인하면 새 PIN을 정할 수 있어요',
  forgotYes: '로그아웃할게요',
  forgotNo: '취소',
  pinWrong: 'PIN이 맞지 않아요',
  pinRemaining: (n: number) => `${n}번 더 틀리면 다시 로그인해야 해요`,

  // A-08
  expiredTitle: '다시 로그인해 주세요',
  // 보조 = 사유. 출시는 “로그인이 만료됐어요” 한 줄(2026-11-10), 다른 기기 로그아웃 사유가 오면 그 문구
  expiredReason: {
    expired: '로그인이 만료됐어요', // [확인 필요]
    otherDevice: '다른 기기에서 로그아웃했어요',
  },
  loginAgain: '로그인하기',
  otherAccount: '다른 계정으로 로그인',
  // A-08 4·5번 새 기기 알림
  newDeviceTitle: '새 기기에서 로그인했어요',
  newDeviceHelp: '본인이 아니면 바로 로그아웃해 주세요',
  newDeviceAt: (device: string, at: string) => `${device}, ${at}`,
  newDeviceGone: '이미 로그아웃된 기기예요', // [확인 필요]
  deviceList: '기기 목록 보기', // [확인 필요] 이미 로그아웃된 기기면 버튼 하나(2026-11-10)
  itsMe: '나예요',
  notMe: '내가 아니에요',
  checkProvider: (p: string) => `${p} 계정 보안도 확인해 주세요`,
  checkAccount: '로그인한 계정의 보안도 확인해 주세요', // [확인 필요]
  newDeviceFailed: '지금은 로그아웃할 수 없어요. 잠시 뒤 다시 해 주세요', // [확인 필요]

  // 약관 보기: 이용약관은 웹사이트 L-05를 앱 안 브라우저로(2026-11-10). 개인정보 수집·이용, 공간 공유, 마케팅은
  // 앱 안 시트(원본 apps/site/src/content/consents, pnpm content:sync)
  termsUrl: {
    terms: 'https://sweetwo.kr/terms',
    privacy: 'https://sweetwo.kr/privacy',
  },
};
