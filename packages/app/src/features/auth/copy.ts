import type { AuthProvider } from '@sweetwo/core';

// 로그인, 가입 문구(docs/spec/15-login-signup.md). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것(기획서에 정해지면 바꾼다).
export const providerName: Record<AuthProvider, string> = {
  kakao: '카카오',
  google: '구글',
  apple: '애플',
};

export const copy = {
  // A-01
  updateTitle: '새 버전으로 업데이트해 주세요',
  updateSub: '지금 버전으로는 저장할 수 없어요',
  updateNow: '지금 업데이트',
  viewOnly: '업데이트 없이 보기만 할게요',
  updateFailed: '업데이트를 받지 못했어요',
  offlineNoSession: '인터넷에 연결하면 로그인할 수 있어요',
  retry: '다시 시도',

  // O-01
  startTitle: '둘이 처음 합치는 돈,\n순서대로 같이 정리해요',
  start: '시작하기',
  invited: '초대받았어요',

  // A-02
  loginTitle: '시작하려면 로그인해 주세요',
  loginHelp: '처음이면 바로 가입돼요',
  recent: '최근 사용',
  continueWith: {
    kakao: '카카오로 계속하기',
    google: '구글로 계속하기',
    apple: '애플로 계속하기',
  } satisfies Record<AuthProvider, string>,
  keepLogin: '이 기기에서 로그인 유지',
  emailConflict: (p: AuthProvider) => `이미 ${providerName[p]}로 가입한 이메일이에요`,
  providerError: (p: AuthProvider) =>
    `${providerName[p]} 로그인에 문제가 생겼어요. 다른 방법으로 해볼까요?`,
  offline: '인터넷에 연결되면 할 수 있어요',
  pinLockedOut: 'PIN을 5번 틀려서 다시 로그인해 주세요', // 디자인 LockScreen

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
  emailTitle: '알림 받을 이메일을 알려주세요',
  emailHelp: '주간 요약·초대·제안 메일을 보내요',
  emailLabel: '알림 이메일', // 설정 이름
  emailPlaceholder: 'name@example.com',
  next: '다음',
  emailInvalid: '이메일 주소를 다시 확인해 주세요',

  // A-05
  termsTitle: '약관에 동의해 주세요', // [확인 필요] A-05 제목 문구
  agreeAll: '모두 동의해요',
  terms: '[필수] 이용약관',
  privacy: '[필수] 개인정보 수집·이용',
  spaceSharing: '[필수] 배우자와 부부 공간 공유',
  marketing: '[선택] 마케팅 정보 받기',
  view: '보기',
  agreeContinue: '동의하고 계속하기',
  signupFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',

  // A-06
  pinSetTitle: '앱을 열 때 쓸 PIN 6자리를 정해 주세요',
  pinSetSub: '자리를 비우면 5분 뒤 잠겨요',
  pinConfirm: '한 번 더 입력해 주세요',
  pinMismatch: 'PIN이 서로 달라요',
  pinWeak: '같은 숫자나 이어지는 숫자는 쓸 수 없어요', // [확인 필요] 기획서는 규칙만 있음
  touchIdAsk: 'Touch ID로도 풀까요?',
  touchIdYes: 'Touch ID 켜기', // [확인 필요] 버튼 문구
  later: '나중에 할게요',
  pinUnlockTitle: 'PIN을 입력해 주세요',
  touchIdUnlock: 'Touch ID로 풀기',
  forgotPin: 'PIN을 잊었어요',
  pinWrong: 'PIN이 맞지 않아요',
  pinRemaining: (n: number) => `${n}번 더 틀리면 다시 로그인해야 해요`,

  // A-08
  expiredTitle: '다시 로그인해 주세요',
  expiredReason: {
    days14: '로그인한 지 14일이 지났어요',
    idle: '오래 자리를 비워서 잠갔어요',
    otherDevice: '다른 기기에서 로그아웃했어요',
  },
  loginAgain: '로그인하기',
  otherAccount: '다른 계정으로 로그인',

  // 약관 보기(L-05). 웹사이트가 생기면 앱 안 보기로 연다.
  termsUrl: {
    terms: 'https://sweetwo.kr/terms',
    privacy: 'https://sweetwo.kr/privacy',
    spaceSharing: 'https://sweetwo.kr/terms#space-sharing',
    marketing: 'https://sweetwo.kr/terms#marketing',
  },
};
