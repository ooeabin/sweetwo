import { Navigate, useSearchParams } from 'react-router-dom';
import { sharedCopy } from '../../shared/copy';
import { MainFrame, SkelBody } from '../frame';
import { copy } from './copy';
import { useCheckRealtime, useGoalRealtime, useSpace, useSplitRealtime } from './data';
import { useTogetherRealtime } from './together';
import { W01Receipt } from './pages/w-01-receipt';
import { W02PaydayConfirm } from './pages/w-02-payday-confirm';
import { planPath } from './paths';

/** 상대가 월급 계획·체크를 바꾸면 Realtime으로 바로 다시 읽음(W-01·W-02 같이) */
function useSalaryRealtime() {
  const space = useSpace();
  useSplitRealtime(space.data?.id);
  useCheckRealtime(space.data?.id);
  useGoalRealtime(space.data?.id);
  // 저축·투자 묶음(2026-11-18 W-13을 합침): 상대가 묶음을 고치면 바로 다시 읽음(저금·체크·월급 계획은 위 셋이 이미)
  useTogetherRealtime(space.data?.id);
}

/**
 * W-02 이번 달 월급 체크(/salary, 월급 탭 첫 화면). 옛 구간 탭 주소 `/salary?view=plan`(알림·위젯·딥링크)은
 * 쿼리(who, line)를 살려 W-01 `/salary/plan`으로 넘김(2026-11-18 구간 탭 없앰)
 */
export function SalaryTab() {
  const [params] = useSearchParams();
  useSalaryRealtime();
  if (params.get('view') === 'plan')
    return <Navigate to={planPath({ who: params.get('who'), line: params.get('line') })} replace />;
  return <W02PaydayConfirm />;
}

/** W-01 월급 계획 템플릿(/salary/plan) */
export function SalaryPlanTab() {
  useSalaryRealtime();
  return <W01Receipt />;
}

/**
 * 머리 제목(2026-11-18): 서랍 줄 이름과 같게. W-02 = ‘이번 달 월급 체크’, W-01 = ‘월급 계획 템플릿’.
 */
export function useSalaryTitle(view: 'month' | 'plan') {
  // 화면 이름 = 서랍 줄 이름(2026-11-18), 날짜 없는 사람 W-02도 같은 개편 모양이라 같은 제목(2026-11-19)
  return view === 'plan' ? copy.planTitle : copy.monthTitle;
}

/**
 * 월급 탭 불러오는 중(13 공통 상태 5번, 2026-11-12 QA 5구간 S5-11): 구간 탭은 그대로 두고 본문 자리만 뼈대
 */
export function SalaryLoading({ value }: { value: 'month' | 'plan' }) {
  const title = useSalaryTitle(value);
  return (
    <MainFrame
      current="salary"
      page={{ title }}
      tone={value === 'plan' ? 'alt' : undefined}
      columns={[
        <div key="l" className="hg-stack">
          <SkelBody shape="cards" />
        </div>,
      ]}
    />
  );
}

/**
 * 월급 탭을 못 불러옴(13 공통 상태 7번, 2026-11-12 QA 5구간 S5-02): 구간 탭 + 오류 카드 “잠시 문제가 생겼어요” + ‘다시 시도’.
 * 홈 큰 상자 오류 카드(H-03)와 같은 모양.
 */
export function SalaryLoadError({
  value,
  onRetry,
}: {
  value: 'month' | 'plan';
  onRetry: () => void;
}) {
  const title = useSalaryTitle(value);
  return (
    <MainFrame
      current="salary"
      page={{ title }}
      tone={value === 'plan' ? 'alt' : undefined}
      columns={[
        <div key="l" className="hg-stack">
          <section className="hg-card hg-card--fill hg-stack" role="status">
            <p className="hg-card__title">{sharedCopy.errorTitle}</p>
            <p className="hg-card__meta">{sharedCopy.errorBody}</p>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={onRetry}
            >
              {sharedCopy.retry}
            </button>
          </section>
        </div>,
      ]}
    />
  );
}

/**
 * 옛 W-02 끝 주소 /salary/done(2026-11-12 화면 없앰, 옛 링크·알림) → W-02(/salary, who는 그대로).
 * 다 끝난 달은 W-02 막대 아래 한 줄로 보임
 */
export function DoneRedirect() {
  const [params] = useSearchParams();
  const who = params.get('who');
  return <Navigate to={who ? `/salary?who=${encodeURIComponent(who)}` : '/salary'} replace />;
}

/** 옛 주소 /salary/split(알림 링크 등) → /salary/plan(who는 그대로) */
export function SplitRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={planPath({ who: params.get('who') })} replace />;
}

/** 옛 W-13 저금 목록 주소 /salary/items(2026-11-18 없앰) → W-01 저축·투자 묶음(/salary/plan#saving) */
export function SavingListRedirect() {
  const [params] = useSearchParams();
  const from = params.get('from');
  return (
    <Navigate
      to={`/salary/plan${from ? `?from=${encodeURIComponent(from)}` : ''}#saving`}
      replace
    />
  );
}
