// 홈 문구(docs/spec/19-this-month.md). 기획서 “ ” 안 문장 그대로. [확인 필요]는 기획서에 문구가 없거나 확인 중인 것.
export const copy = {
  // H-01 기다리는 화면
  waitTitle: (starter: string) => `${starter}님이 시작하고 있어요`,
  waitCard: (starter: string) => `${starter}님이 월급 계획을 만들면 알려 드릴게요`, // [확인 필요] 2026-11-08,
  homeTitle: '홈', // 2026-11-03 넓은 창 제목 줄(다른 메뉴와 같음)
  hubLabel: '한눈에 보기', // [확인 필요] 2026-11-09 홈 상자 묶음 이름(화면 읽기용)
  // H-03 큰 상자(2026-11-09 홈 허브) [확인 필요]
  untilPayday: (date: string) => `${date} 월급날까지`,
  daysLeft: (n: number) => `${n}일 남았어요`,
  paydayToday: '오늘이 월급날이에요',
  sentLines: '이번 달 체크', // 2026-11-11 ‘보낸 줄’에서 바꿈(사용자 결정),
  sentAmount: '체크한 금액',
  savedAmount: '모은 금액',
  heroLabel: (p: {
    caption: string;
    title: string;
    total: number;
    done: number;
    sent: string;
    saved: string;
  }) =>
    `${p.caption} ${p.title}. 이번 달 ${p.total}개 중 ${p.done}개 체크했어요. 체크한 금액 ${p.sent}, 모은 금액 ${p.saved}`, // 화면 읽기용
  noSalary: '월급이 생기면 월급 계획을 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // H-06 할 일 띠(오렌지) 오른쪽 이동 글자 [확인 필요]
  bandCheck: '체크하기',
  bandReview: '확인하기',
  // 반 칸 타일(2026-11-09) [확인 필요]
  planTile: '월급 계획',
  everyMonth: (day: string) => `매달 ${day}`,
  payday: (d: number) => `${d}일`,
  paydayLast: '말일',
  calendarTile: '캘린더',
  noCare: '다가오는 일정 없어요',
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요]
  // H-02 저금 상자(목표 금액에 가장 가까운 저금 하나)
  savingLabel: (name: string, pct: number, progress: string) => `${name}, ${pct}%, ${progress}`, // 화면 읽기용
  // 작은 타일 [확인 필요]
  assetsTile: '자산 관리',
  rankBadge: (pct: number) => `상위 ${pct}%`, // [확인 필요] 2026-11-11 H-04 타일 제목 아래(홈 순위 줄 대신)
  assetsTileLabel: (net: string, rank: string | null) =>
    `자산 관리, 순자산 ${net}${rank ? `, ${rank}` : ''}`, // 화면 읽기용
  savingsTile: '저금', // 2026-11-09 사용자에게는 ‘저금’
  savingCount: (n: number) => `${n}개 모으는 중`,
  noSavings: '아직 없어요',
  inviteNow: '초대하기', // 2026-11-11 초대 띠(코코아 HubBand) 오른쪽 이동 글자
  unlinkWait: '연결 해제를 기다리고 있어요', // [확인 필요]
  unlinkOn: (date: string) => `${date}에 해제돼요`, // [확인 필요]
  unlinkCheck: '확인하기',
  mailBounced: '알림 메일이 전달되지 않았어요',
  mailBouncedSub: '알림 이메일 주소를 확인해 주세요',
  mailCheck: '확인하기', // [확인 필요]
};
