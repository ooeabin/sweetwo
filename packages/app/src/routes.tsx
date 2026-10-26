import type { RouteObject } from 'react-router-dom';
import {
  A01Launch,
  A02Login,
  A03BrowserWait,
  A04NotifyEmail,
  A05Terms,
  A06LockSetup,
  A08SessionExpired,
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
  F04aMatured,
  F04bSold,
} from './features/assets';
import { TrayWidget } from './features/widget';
import { DevUiGallery } from './features/dev';
import {
  AchieveWatch,
  G01GoalList,
  G02GoalDetail,
  G05Achieved,
  G05Send,
  G05Use,
  G02GoalEdit,
  G06GoalOrder,
  G02aGoalMove,
  G02bGoalUse,
  GoalAddRoute,
} from './features/goals';
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
  S11ePhoto,
  S22Widget,
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
import { W01Split, W02Checklist, W02Done, W05Review } from './features/salary';
import { OnboardingGate, OnboardingRoute } from './features/onboarding';
import { JoinRoute, P01CodeEntry, P01JoinStart } from './features/pairing';

// 경로 표. 화면 ID를 주석으로 남긴다. 모든 화면은 A-01(실행 판단) 아래에.
export const routes: RouteObject[] = [
  {
    element: <A01Launch />, // A-01 실행, 자동 로그인 판단 + 잠금(A-06 해제) + 토스트
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
          ['/salary/split', <W01Split key="w01" />], // W-01 월급 분배표
          ['/salary', <W02Checklist key="w02" />], // W-02 이번 달 월급
          ['/salary/done', <W02Done key="w02e" />], // W-02 끝
          ['/salary/review', <W05Review key="w05" />], // W-05 월말 확인
        ] as const
      ).map(([path, el]) => ({
        path,
        element: (
          <RequireAccount>
            <OnboardingGate>{el}</OnboardingGate>
          </RequireAccount>
        ),
      })),
      {
        path: '/goals',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G01GoalList />
              <AchieveWatch />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-01 목표 목록
      {
        path: '/goals/order',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G06GoalOrder />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-06 우선순위 바꾸기
      {
        path: '/goals/new/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <GoalAddRoute />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-03a~f 목표 추가
      {
        path: '/goals/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G02GoalDetail />
              <AchieveWatch />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-02 목표 상세
      {
        path: '/goals/:id/achieved',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G05Achieved />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-05 달성 축하
      {
        path: '/goals/:id/achieved/send',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G05Send />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-05 보낼 곳
      {
        path: '/goals/:id/use',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G05Use />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-05 사용 기록
      {
        path: '/goals/:id/move/:kind?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G02aGoalMove />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-02a 넣기·빼기, 이미 모은 돈 넣기
      {
        path: '/goals/:id/spend',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G02bGoalUse />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-02b 꺼내 쓰기
      {
        path: '/goals/:id/edit/:field',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G02GoalEdit />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 목표 수정(금액, 기한, 이름)
      {
        path: '/assets',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F01Overview />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-01 우리 자산 한눈에
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
      }, // Y-01 챙길 날 목록
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
      }, // Y-05 챙길 날 상세
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
      }, // Y-09 드린 기록
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
      }, // S-12 부부 정보
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
        path: '/settings/widget/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S22Widget />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-22 위젯
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
      }, // Y-07 챙길 날 추가
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
        path: '/onboarding/:screen', // O-10~O-67 온보딩
        element: (
          <RequireAccount>
            <OnboardingRoute />
          </RequireAccount>
        ),
      },
      { path: '/i', element: <P01CodeEntry /> }, // P-01 코드 직접 입력(O-01 ‘초대받았어요’)
      { path: '/i/:code', element: <P01JoinStart /> }, // A-07 초대 링크, P-01 합류 시작(로그인 전에도)
      {
        path: '/join/:screen', // P-02b~P-11 배우자 합류
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
      { path: paths.callback, element: <AuthCallback /> }, // 소셜 로그인 복귀(웹 콜백, 데스크톱 복귀 페이지)
    ],
  },
  // 트레이 위젯 창(데스크톱, 26). 앱 틀·로그인 확인 없이 브리지 값만 그림
  { path: '/widget/tray', element: <TrayWidget /> },
  // 개발 전용: 컴포넌트 모음. 배포 빌드에서는 import.meta.env.DEV가 false라 빠진다.
  ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <DevUiGallery /> }] : []),
];
