import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import {
  A01Launch,
  A02Login,
  A03BrowserWait,
  A04NotifyEmail,
  A05Terms,
  A06LockSetup,
  A08SessionExpired,
  A08NewDevice,
  A05rReconsent,
  A02Restore,
  AuthCallback,
  O01Start,
  RequireAccount,
  paths,
} from './features/auth';
import {
  AssetAddRoute,
  F01Overview,
  F02Items,
  F04Item,
  F08Rank,
  F04aMatured,
  F04bSold,
} from './features/assets';
import { DevUiGallery } from './features/dev';
import {
  CalendarHome,
  Y01CareList,
  Y04Calendar,
  Y05Budget,
  Y05CareDay,
  Y07CareAdd,
  Y08Record,
  Y09GiftLog,
} from './features/calendar';
import {
  S10Settings,
  S11Me,
  S12Couple,
  S12aUnlinkIntro,
  S12cUnlinkConfirm,
  S12dUnlinkReview,
  S12gReconnect,
  S13Visibility,
  S15Security,
  S18Data,
  S18bDelete,
  S19About,
  S19aInquiry,
  S19aInquiries,
  S19bAccess,
  S20Help,
  S21Trash,
  S12hUnlinked,
  S11aNickname,
  S11bNotifyEmail,
  S11ePhoto,
  S01Guides,
  S02ChecklistItem,
  S03Guide,
  S11dPlanDay,
  S11cSalary,
  S11fSalaryMode,
  S11gMarriage,
  S11hWeddingDate,
  S11iBirthYear,
  S14Notifications,
  S14aQuiet,
} from './features/settings';
import { N02Notifications } from './features/notifications';
import { H01Home } from './features/home';
import {
  AchieveWatch,
  DoneRedirect,
  SalaryTab,
  SplitRedirect,
  W05Review,
  W10SavingItem,
  W10aSavingEdit,
  W11SavingAdd,
  W12SavingAchieved,
  W12aSavingAfter,
  W13SavingList,
} from './features/salary';
import { OnboardingGate, OnboardingRoute } from './features/onboarding';
import { JoinRoute, P01CodeEntry, P01JoinStart } from './features/pairing';
import { CS19NotFound, RouteError } from './shared/cs-19-not-found';

/** 옛 목표 상세 주소(/goals/:id…) → 저금 항목 상세(W-10) */
function GoalRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={/^[0-9a-f-]{36}$/.test(id) ? `/salary/items/${id}` : '/salary'} replace />;
}

// 경로 표. 화면 ID를 주석으로 남긴다. 모든 화면은 A-01(실행 판단) 아래에.
export const routes: RouteObject[] = [
  {
    element: <A01Launch />, // A-01 실행, 자동 로그인 판단 + 잠금(A-06 해제) + 토스트
    errorElement: <RouteError />, // 13 공통 상태 7번(화면 오류), 19번(없는 주소)
    children: [
      {
        path: paths.home,
        element: (
          <RequireAccount>
            <OnboardingGate>
              <H01Home />
              <AchieveWatch />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 홈 H-01~06
      ...(
        [
          ['/salary/split', <SplitRedirect key="w01r" />], // 옛 W-01 주소 → /salary?view=plan(2026-11-09)
          ['/salary', <SalaryTab key="w02" />], // 월급 탭: ‘이번 달’ W-02 / ‘계획’ W-01 영수증(?view=plan)
          ['/salary/done', <DoneRedirect key="w02e" />], // 옛 W-02 끝(2026-11-12 없앰) → W-02
          ['/salary/review', <W05Review key="w05" />], // W-05 월급 전 확인
          ['/salary/items', <W13SavingList key="w13" />], // W-13 저금 목록(2026-11-09 round 3)
          ['/salary/items/new/:step?', <W11SavingAdd key="w11" />], // W-11a~d 저금 항목 추가
          ['/salary/items/:id', <W10SavingItem key="w10" />], // W-10 저금 항목 상세
          ['/salary/items/:id/edit/:field', <W10aSavingEdit key="w10a" />], // W-10a 고치기
          ['/salary/items/:id/achieved', <W12SavingAchieved key="w12" />], // W-12 달성 축하
          ['/salary/items/:id/after', <W12aSavingAfter key="w12a" />], // W-12a 달성 뒤
        ] as const
      ).map(([path, el]) => ({
        path,
        element: (
          <RequireAccount>
            <OnboardingGate>{el}</OnboardingGate>
          </RequireAccount>
        ),
      })),
      // 2026-11-08 목표 탭 없앰(ADR 0007): 옛 주소(알림 링크 등)는 월급 탭으로
      { path: '/goals', element: <Navigate to="/salary" replace /> },
      { path: '/goals/:id/*', element: <GoalRedirect /> },
      {
        path: '/assets',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F01Overview />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-01 자산 관리 요약
      {
        path: '/assets/items',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F02Items />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-02 자산·부채 목록
      {
        path: '/calendar',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <CalendarHome />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 캘린더: 마지막 보기
      {
        path: '/calendar/list',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y01CareList />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-01 경조사 목록
      {
        path: '/calendar/month',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y04Calendar />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-04 달력
      {
        path: '/calendar/day/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y05CareDay />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-05 경조사 상세
      {
        path: '/calendar/day/:id/budget',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y05Budget />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-05 쓸 돈 수정
      {
        path: '/calendar/day/:id/record/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y08Record />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-08 다녀온 뒤 기록
      {
        path: '/calendar/gifts',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y09GiftLog />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-09 선물 기록
      {
        path: '/notifications',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <N02Notifications />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // N-02 알림 화면(좁은 창)
      {
        path: '/settings',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S10Settings />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-10 설정 홈
      {
        path: '/settings/me',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11Me />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11 내 정보
      {
        path: '/settings/couple',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12Couple />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12 우리 둘 정보
      {
        path: '/settings/couple/unlink',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12aUnlinkIntro />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12a 연결 해제 안내
      {
        path: '/settings/couple/unlink/confirm',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12cUnlinkConfirm />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12c 입력 후 보내기
      {
        path: '/settings/couple/unlink/review',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12dUnlinkReview />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12d 자산 정리 안 확인, 동의
      {
        path: '/settings/couple/unlinked',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12hUnlinked />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12h 혼자 쓰기 전환
      {
        path: '/settings/couple/reconnect',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12gReconnect />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12g 다시 연결 수락
      {
        path: '/settings/visibility',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S13Visibility />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-13 공개 범위
      {
        path: '/settings/trash',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S21Trash />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-21 휴지통
      {
        path: '/settings/about',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S19About />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-19 앱 정보
      {
        path: '/settings/help',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S20Help />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-20 도움말
      {
        path: '/settings/help/inquiry',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S19aInquiry />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-19a 문의하기
      {
        path: '/settings/help/inquiries',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S19aInquiries />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-19a 내 문의
      {
        path: '/settings/help/inquiries/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S19aInquiries />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-19a 문의 상세
      {
        path: '/settings/help/access/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S19bAccess />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-19b 관리자 열람 동의
      {
        path: '/settings/data',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S18Data />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-18 데이터
      {
        path: paths.reconsent,
        element: (
          <RequireAccount>
            <A05rReconsent />
          </RequireAccount>
        ),
      }, // A-05r 약관 개정 재동의·마케팅 재확인
      {
        path: `${paths.newDevice}/:session`,
        element: (
          <RequireAccount>
            <A08NewDevice />
          </RequireAccount>
        ),
      }, // A-08 새 기기 알림(나예요 / 내가 아니에요)
      {
        path: '/settings/security',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S15Security />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-15 보안
      {
        path: '/settings/data/delete',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S18bDelete />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-18b 계정 삭제
      {
        path: '/settings/me/nickname',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11aNickname />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11a 호칭
      {
        path: '/settings/me/email',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11bNotifyEmail />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11b 알림 이메일
      {
        path: '/settings/me/photo',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11ePhoto />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11e 프로필 사진
      {
        path: '/settings/me/plan-day',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11dPlanDay />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11d 체크리스트 만드는 날
      {
        path: '/settings/me/salary',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11cSalary />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11c 내 월급
      {
        path: '/settings/me/salary-mode',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11fSalaryMode />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11f 월급 관리 방식
      {
        path: '/settings/me/marriage',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11gMarriage />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11g 결혼 상태
      {
        path: '/settings/me/wedding',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11hWeddingDate />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11h 결혼한 날·예정일
      {
        path: '/settings/me/birth-year',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S11iBirthYear />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-11i 출생연도
      {
        path: '/settings/guides',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S01Guides />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-01 가이드 모아보기
      {
        path: '/settings/guides/check/:key',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S02ChecklistItem />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-02 체크리스트 항목
      {
        path: '/settings/guides/read/:key',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S03Guide />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-03 가이드 글
      {
        path: '/settings/notifications',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S14Notifications />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-14 알림
      {
        path: '/settings/notifications/quiet',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S14aQuiet />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-14a 방해 금지 시간
      {
        path: '/calendar/add/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <Y07CareAdd />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // Y-07 경조사 추가
      {
        path: '/assets/new/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <AssetAddRoute />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-03 항목 추가
      {
        path: '/assets/rank',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F08Rank />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-08 자산 순위(2026-11-04)
      {
        path: '/assets/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F04Item />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-04 항목 상세·수정
      {
        path: '/assets/:id/matured/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F04aMatured />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-04a 만기된 돈 정리
      {
        path: '/assets/:id/sold',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F04bSold />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-04b~d 팔았어요
      {
        path: '/onboarding/:screen', // O-03~O-60 온보딩(2026-11-10 O-10·O-12·O-13 없앰)
        element: (
          <RequireAccount>
            <OnboardingRoute />
          </RequireAccount>
        ),
      },
      { path: '/i', element: <P01CodeEntry /> }, // P-01 코드 직접 입력(O-01 ‘코드 입력하기’)
      { path: '/i/:code', element: <P01JoinStart /> }, // A-07 초대 링크, P-01 합류 시작(로그인 전에도)
      {
        path: '/join/:screen', // P-02b~P-11 파트너 합류
        element: (
          <RequireAccount>
            <JoinRoute />
          </RequireAccount>
        ),
      },
      { path: paths.start, element: <O01Start /> }, // O-01 시작
      { path: paths.login, element: <A02Login /> }, // A-02 로그인 방법
      { path: paths.wait, element: <A03BrowserWait /> }, // A-03 브라우저 로그인 대기
      { path: paths.email, element: <A04NotifyEmail /> }, // A-04 알림 이메일
      { path: paths.terms, element: <A05Terms /> }, // A-05 약관 동의
      { path: paths.pinSetup, element: <A06LockSetup /> }, // A-06 PIN 정하기
      { path: paths.expired, element: <A08SessionExpired /> }, // A-08 세션 만료
      { path: paths.restore, element: <A02Restore /> }, // A-02 계정 삭제 취소
      { path: paths.callback, element: <AuthCallback /> }, // 소셜 로그인 복귀(웹 콜백, 앱 복귀 페이지)
      { path: '*', element: <CS19NotFound /> }, // 13 공통 상태 19번 없는 주소
    ],
  },
  // 개발 전용: 컴포넌트 모음. 배포 빌드에서는 import.meta.env.DEV가 false라 빠진다.
  ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <DevUiGallery /> }] : []),
];
