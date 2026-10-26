// 웹사이트 주소와 문구(docs/spec/28-website.md). 기획서 “ ” 안 문장을 그대로, 해요체.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const URLS = {
  app: (import.meta.env.PUBLIC_APP_URL as string | undefined) ?? 'https://app.sweetwo.kr',
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
  landingDesc: `${CATCH}. 월급날 어디에 얼마씩 쓸지 같이 정하고, 월말에 함께 정산하는 부부 돈 관리 앱이에요.`, // [확인 필요] 기능 설명 1문장
  faq: '자주 묻는 질문',
  webStart: '웹에서 시작하기',
  heroLead: '월급날 어디에 얼마씩 쓸지 같이 정하고, 월말에 함께 정산해요',
  macDownload: 'Mac용 다운로드',
  winDownload: 'Windows용 다운로드',
  otherOs: '다른 OS용 받기',
  supported: 'macOS 12 이상, Windows 10 64비트 이상에서 쓸 수 있어요',
  unsupported: '이 기기에서는 앱을 쓸 수 없어요. 웹에서 시작할 수 있어요',
  mobile: 'Mac이나 Windows에서 설치할 수 있어요',
  features: [
    { title: '월급 플랜과 월급 나누기', body: '월급날 어디에 얼마씩 쓸지 같이 정해요' },
    { title: '월말 정리와 제안', body: '달마다 같이 돌아보고, 바꾸고 싶은 건 제안으로 정해요' },
    { title: '양가 챙길 날', body: '양가 생신과 명절을 미리 알려 드리고 예산도 같이 챙겨요' },
  ],
  featuresTitle: '이렇게 써요', // [확인 필요] 구획 제목
  howTitle: '둘이 쓰는 법', // [확인 필요] 구획 제목
  how: ['한 사람이 시작해요', '초대 코드로 합류해요', '월말에 같이 정리해요'],
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
  after: '앱에서 로그인하면 웹에서 쓰던 기록이 그대로 있어요',
  webContinue: '설치 없이 웹에서 계속하기',
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
  webContinueInvite: '웹에서 계속하기',

  // 알림 메일 링크(14 ‘센터와 푸시·메일’): 앱이 없으면 안내 + 앱 받기
  openInSweetwo: 'sweeTwo 앱에서 열어 주세요',
  // 로그인 복귀 페이지(15 A-03 5번)
  loginDone: '로그인을 마쳤어요',
  backToApp: 'sweeTwo 앱으로 돌아가요',
  openSweetwo: 'sweeTwo 열기',
  getApp: '앱 받기',
};
