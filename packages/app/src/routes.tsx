import type { RouteObject } from 'react-router-dom';
import {
  A01Launch,
  A02Login,
  A03BrowserWait,
  A04NotifyEmail,
  A05Terms,
  A06LockSetup,
  A08SessionExpired,
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
  F05Edit,
  F05Money,
  F06Diagnosis,
  O53InvestPrinciple,
  O41AssetKinds,
  O42AssetAmount,
  O43LumpGoal,
  O44LoanKinds,
  O45LoanAmount,
  O46LoanRate,
  O47LoanPayment,
} from './features/assets';
import { DevUiGallery } from './features/dev';
import {
  G01GoalList,
  G02GoalDetail,
  G02GoalEdit,
  G04GoalAdjust,
  G06GoalOrder,
  GoalAddRoute,
} from './features/goals';
import { H01ThisMonth } from './features/month';
import { CloseRoute, W04jSpendEntry } from './features/month-close';
import { OnboardingGate, OnboardingRoute } from './features/onboarding';
import { JoinRoute, P01JoinStart } from './features/pairing';
import { G08Proposal } from './features/proposals';

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
              <H01ThisMonth />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // H-01 이번 달
      {
        path: '/month/spend',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W04jSpendEntry />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-04j 지출 적기(앞당겨 열기)
      {
        path: '/month/close/:step',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <CloseRoute />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-04a~W-04 끝 월말 정리
      {
        path: '/goals',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G01GoalList />
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
        path: '/goals/adjust',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G04GoalAdjust />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-04 충돌 조정
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
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-02 목표 상세
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
        path: '/assets/diagnosis',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F06Diagnosis />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-06 재정 진단
      {
        path: '/assets/principle',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O53InvestPrinciple />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-53 투자 원칙(첫 주 7일째, 재정 진단 ‘지금 정하기’)
      {
        path: '/assets/week/assets',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O41AssetKinds />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-41 가진 돈 종류(첫 주 2일째 자산 정리하기)
      {
        path: '/assets/week/assets/:n',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O42AssetAmount />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-42 자산 금액(고른 것마다)
      {
        path: '/assets/week/lump',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O43LumpGoal />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-43 목돈 넣을 목표
      {
        path: '/assets/week/loans',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O44LoanKinds />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-44 대출 종류(첫 주 3일째 대출 정리하기)
      {
        path: '/assets/week/loans/:n/amount',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O45LoanAmount />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-45 대출 남은 돈
      {
        path: '/assets/week/loans/:n/rate',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O46LoanRate />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-46 금리
      {
        path: '/assets/week/loans/:n/pay',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O47LoanPayment />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-47 대출 월 상환
      {
        path: '/assets/money',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F05Money />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-05 월 수입·지출
      {
        path: '/assets/money/:field',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F05Edit />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-05a~d 수입, 월급날, 고정지출, 대출 상환, 용돈, 생활비
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
        path: '/proposals/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G08Proposal />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-08 제안 확인
      {
        path: '/onboarding/:screen', // O-03~O-24 온보딩 ①
        element: (
          <RequireAccount>
            <OnboardingRoute />
          </RequireAccount>
        ),
      },
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
      { path: paths.callback, element: <AuthCallback /> }, // 소셜 로그인 복귀(웹 콜백, 데스크톱 복귀 페이지)
    ],
  },
  // 개발 전용: 컴포넌트 모음. 배포 빌드에서는 import.meta.env.DEV가 false라 빠진다.
  ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <DevUiGallery /> }] : []),
];
