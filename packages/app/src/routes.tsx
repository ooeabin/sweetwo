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
  F05Edit,
  F05fPeriod,
  F07aReplan,
  F07bReplanQuestion,
  F07cReplanCompare,
  F05Money,
  F09EmergencyMove,
  O53InvestPrinciple,
  O34Bonus,
  O35BonusList,
  O35bOtherIncome,
  O37FixedItems,
  O38bCard,
  O41AssetKinds,
  O42AssetAmount,
  O43LumpGoal,
  O44LoanKinds,
  O45LoanAmount,
  O46LoanRate,
  O47LoanPayment,
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
  G07Wedding,
  G07WeddingBudget,
  G07WeddingPay,
  G07aWeddingItem,
  G02GoalEdit,
  G04GoalAdjust,
  G06GoalOrder,
  G02aGoalMove,
  G02bGoalUse,
  O23RestQuestion,
  O24RestDeadline,
  O25RestHeld,
  RestGoalNext,
  GoalAddRoute,
} from './features/goals';
import {
  W01SalaryPlan,
  W01aAdjust,
  W03LivingCheck,
  W02Split,
  W02aOtherAmount,
  W07Income,
  W07IncomeAdd,
} from './features/plan';
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
  S12bUnlinkPlan,
  S12cUnlinkConfirm,
  S12dUnlinkReview,
  S12eUnlinkDifferently,
  S12fUnlinkCounter,
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
  S01Talk,
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
import { H01ThisMonth } from './features/month';
import { W01Split, W02Checklist, W02Done, W05Review } from './features/salary';
import { CloseRoute, W04Missed, W04jSpendEntry, W04pBundle } from './features/month-close';
import { OnboardingGate, OnboardingRoute } from './features/onboarding';
import { JoinRoute, P01CodeEntry, P01JoinStart } from './features/pairing';
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
              <H01Home />
              <AchieveWatch />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 홈 H-01~06
      {
        path: '/month',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <H01ThisMonth />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 옛 이번 달(재기획 전, 지울 대상: 월말 정리·월급 플랜·제안 화면이 여기서 열림)
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
        path: '/month/close/w-04p/:id',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W04pBundle />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-04p 월말 정리 제안 응답
      {
        path: '/month/missed',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W04Missed />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 놓친 달
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
        path: '/goals/wedding',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G07Wedding />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-07 결혼 비용 상세
      {
        path: '/goals/wedding/budget',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G07WeddingBudget />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-07 총예산
      {
        path: '/goals/wedding/item/:id/:step',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G07aWeddingItem />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-07a~d 결혼 비용 항목
      {
        path: '/goals/wedding/pay/:id/:part',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G07WeddingPay />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // G-07 결제 기록
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
        path: '/assets/emergency/:kind',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F09EmergencyMove />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-09 비상금 넣기·꺼내기
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
        path: '/assets/week/fixed',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O37FixedItems />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-37 세부 항목 고르기(첫 주 4일째)
      {
        path: '/assets/week/fixed/:n',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O37FixedItems />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-37 항목별 고정지출
      {
        path: '/assets/week/card',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O38bCard />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-38b 생활비 카드 사용
      {
        path: '/plan',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W01SalaryPlan />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-01 월급 플랜
      {
        path: '/plan/split',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W02Split />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-02 월급 나누기
      {
        path: '/plan/split/:lineId',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W02aOtherAmount />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-02a 다른 금액
      {
        path: '/plan/edit/:role',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W01aAdjust />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-01a 이번 달만 바꾸기
      {
        path: '/plan/living-check',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W03LivingCheck />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-03 생활비 체크
      {
        path: '/plan/income',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W07Income />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-07 들어오는 돈
      {
        path: '/plan/income/new/:step?',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <W07IncomeAdd />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // W-07 들어오는 돈 추가
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
        path: '/settings/couple/unlink/plan',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12bUnlinkPlan />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12b 자산 정리 안
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
        path: '/settings/couple/unlink/differently',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12eUnlinkDifferently />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12e 다르게 정리하기
      {
        path: '/settings/couple/unlink/counter',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S12fUnlinkCounter />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-12f 다르게 정리한 안 확인
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
        path: '/settings/guides/talk',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <S01Talk />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // S-01 부부 대화 카드
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
        path: '/goals/week',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <G06GoalOrder week />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-22 나머지 목표 순서(첫 주 5일째)
      {
        path: '/goals/week/next',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <RestGoalNext />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // 첫 주 5일째 남은 화면으로
      {
        path: '/goals/week/:id/q/:i',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O23RestQuestion />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-23 나머지 목표 금액 질문
      {
        path: '/goals/week/:id/deadline',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O24RestDeadline />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-24 나머지 목표 기한
      {
        path: '/goals/week/:id/held',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O25RestHeld />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-25 이미 모아둔 돈
      {
        path: '/assets/week/bonus',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O34Bonus />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-34 상여금 여부(첫 주 5일째)
      {
        path: '/assets/week/bonus/list',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O35BonusList />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-35 상여금 월·금액
      {
        path: '/assets/week/income',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O35bOtherIncome />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-35b 다른 수입
      {
        path: '/assets/week/income/:n',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <O35bOtherIncome />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // O-35b 항목별 월 금액
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
        path: '/assets/money/period/:step',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F05fPeriod />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-05f·g 기간 수입 변경
      {
        path: '/assets/replan',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F07aReplan />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-07a 계획 다시 세우기
      {
        path: '/assets/replan/q/:q',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F07bReplanQuestion />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-07b 바뀐 부분 다시 묻기
      {
        path: '/assets/replan/compare/:mode',
        element: (
          <RequireAccount>
            <OnboardingGate>
              <F07cReplanCompare />
            </OnboardingGate>
          </RequireAccount>
        ),
      }, // F-07c 비교·적용
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
