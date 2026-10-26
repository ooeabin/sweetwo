// 웹사이트 주소와 문구(docs/spec/28-website.md). 기획서 “ ” 안 문장을 그대로, 해요체.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const URLS = {
  // 스토어 앱 페이지(28 공통 ‘주소’). App Store 주소는 앱을 등록해야 정해져 빌드 환경 변수로 [확인 필요]
  appStore:
    (import.meta.env.PUBLIC_APP_STORE_URL as string | undefined) ?? 'https://apps.apple.com/kr/',
  playStore:
    (import.meta.env.PUBLIC_PLAY_STORE_URL as string | undefined) ??
    'https://play.google.com/store/apps/details?id=kr.sweetwo.app',
  mac: 'https://download.sweetwo.kr/latest/mac',
  win: 'https://download.sweetwo.kr/latest/win',
  status: 'https://status.sweetwo.kr',
  help: 'mailto:help@sweetwo.kr',
  privacyMail: 'mailto:privacy@sweetwo.kr',
};

export const CATCH = '함께 구워 더 달콤한 자산파이';

export const t = {
  title: (page: string) => `${page} - sweeTwo`,
  landingTitle: `sweeTwo | ${CATCH}`,
  landingDesc: `${CATCH}. 둘의 목표를 정하고, 월급날 정한 대로 나눴는지 같이 체크하는 부부 돈 관리 앱이에요.`, // [확인 필요] 기능 설명 1문장
  faq: '자주 묻는 질문',
  getApp: '앱 받기',
  heroLead: '둘의 목표를 정하고, 월급날 정한 대로 나눴는지 같이 체크해요', // [확인 필요]
  macDownload: 'Mac용 다운로드',
  winDownload: 'Windows용 다운로드',
  otherOs: '다른 OS용 받기',
  supported: 'macOS 12 이상, Windows 10 64비트 이상에서 쓸 수 있어요',
  unsupported: '이 컴퓨터에서는 앱을 쓸 수 없어요. 휴대폰 앱으로 시작할 수 있어요', // [확인 필요]
  phoneAlso: 'Mac이나 Windows에서도 같은 계정으로 쓸 수 있어요', // [확인 필요]
  mobileToo: '휴대폰 앱도 있어요',
  // 스토어 배지 자리(공식 배지 이미지를 넣기 전까지 글자 버튼)
  appStore: 'App Store에서 받기',
  googlePlay: 'Google Play에서 받기',
  // [확인 필요] 기능 4개(28 L-01 3번)
  features: [
    { title: '우리 목표', body: '내 집 마련, 여행, 비상금까지 얼마나 모았는지 한눈에 봐요' },
    {
      title: '월급 분배표와 체크리스트',
      body: '월급을 어디에 얼마씩 보낼지 한 번 정하고, 월급날 보냈는지 체크만 해요',
    },
    { title: '한눈에 순자산', body: '통장, 투자, 집, 대출을 적으면 우리 순자산을 보여 드려요' },
    { title: '둘이 같이', body: '초대 코드 하나로 같이 쓰고, 누가 고쳐도 서로 바로 알 수 있어요' },
  ],
  featuresTitle: '이렇게 써요', // [확인 필요] 구획 제목
  howTitle: '둘이 쓰는 법', // [확인 필요] 구획 제목
  how: ['한 사람이 시작해요', '초대 코드로 합류해요', '월급날 같이 체크해요'], // [확인 필요]
  safeTitle: '안심하고 써요', // [확인 필요] 구획 제목
  safe: [
    { icon: 'pencil', text: '직접 입력해요, 계좌를 연결하지 않아요' },
    { icon: 'shield-check', text: '계좌번호와 카드번호를 받지 않아요' },
    { icon: 'house', text: '국내 서버에 보관해요' },
    { icon: 'lock', text: '메모와 가족 정보는 한 번 더 암호화해요' },
  ],
  seeAll: '전체 보기',
  foot: {
    terms: '이용약관',
    privacy: '개인정보처리방침',
    help: '고객센터',
    status: '상태 페이지',
    contact: '고객센터 help@sweetwo.kr',
    privacyOfficer: '개인정보 보호책임자 privacy@sweetwo.kr',
    // 사업자 정보 값은 출시 준비(34 4장)에서 정함
    business: [
      ['상호', '[확인 필요]'],
      ['대표', '[확인 필요]'],
      ['사업자등록번호', '[확인 필요]'],
      ['주소', '[확인 필요]'],
    ] as [string, string][],
    notAdvice: 'sweeTwo는 입력한 숫자로 계산한 참고 정보를 보여드려요. 투자·금융 자문이 아니에요',
  },

  // L-02
  installPage: '설치 안내',
  started: '다운로드를 시작했어요',
  startedSub: '받기가 시작되지 않으면 다시 받기를 눌러 주세요',
  again: '다시 받기',
  steps: {
    mac: [
      'dmg 파일을 열어요',
      'sweeTwo를 응용 프로그램 폴더로 끌어 놓아요',
      '처음 열 때 ‘열기’를 눌러요',
    ],
    win: ['설치 파일을 실행해요', '설치를 눌러요', '시작 메뉴에서 sweeTwo를 열어요'],
  },
  warnQ: '보안 경고가 뜨나요?',
  warn: {
    mac: '‘확인되지 않은 개발자’ 경고가 뜨면 시스템 설정의 개인정보 보호 및 보안에서 ‘그래도 열기’를 눌러 주세요',
    win: 'SmartScreen 창이 뜨면 ‘추가 정보’를 누른 뒤 ‘실행’을 눌러 주세요',
  },
  signed: 'sweeTwo는 서명과 공증을 마친 앱이라 보통은 이 경고가 뜨지 않아요',
  after: '휴대폰 앱과 같은 계정으로 로그인하면 기록이 그대로 있어요', // [확인 필요]
  chooseOs: '받을 파일을 골라 주세요', // [확인 필요] OS를 모를 때

  // L-03
  releasesPage: '릴리스 노트',
  releasesTitle: 'sweeTwo 릴리스 노트',
  newFeatures: '새 기능',
  fixed: '고친 것',

  // L-05
  effective: (d: string) => `시행일 ${d}`,
  prevVersions: '이전 버전',
  currentVersion: '지금 버전 보기',

  // L-06
  helpPage: '고객센터',
  searchPlaceholder: '궁금한 걸 검색해 보세요',
  noAnswer: '찾는 답이 없어요',
  noResult: '찾는 답이 없어요. 메일로 물어봐 주세요',

  notFound: '페이지를 찾을 수 없어요', // [확인 필요]
  home: '처음으로', // [확인 필요]

  // 초대 링크
  openInApp: 'sweeTwo 앱으로 열까요?',
  openApp: '앱으로 열기',
  // [확인 필요] 초대 페이지(28 공통 ‘초대 링크’)
  invited: 'sweeTwo에 초대받았어요',
  invitedSub: '앱을 설치한 뒤 이 코드를 입력해 주세요',
  copyCode: '복사',
  copied: '복사했어요',

  // 알림 메일 링크(14 ‘센터와 푸시·메일’): 앱이 없으면 안내 + 앱 받기
  openInSweetwo: 'sweeTwo 앱에서 열어 주세요',
  // 로그인 복귀 페이지(15 A-03 5번)
  loginDone: '로그인을 마쳤어요',
  backToApp: 'sweeTwo 앱으로 돌아가요',
  openSweetwo: 'sweeTwo 열기',
};
