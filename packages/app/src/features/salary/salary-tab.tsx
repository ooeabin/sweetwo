import { Tabs } from '@sweetwo/ui';
import { Navigate, useSearchParams } from 'react-router-dom';
import { sharedCopy } from '../../shared/copy';
import { MainFrame, SkelBody } from '../frame';
import { copy } from './copy';
import { useCheckRealtime, useGoalRealtime, useSpace, useSplitRealtime } from './data';
import { W01Receipt } from './pages/w-01-receipt';
import { W02PaydayConfirm } from './pages/w-02-payday-confirm';

// 월급 탭(20 W-01 1번, 2026-11-09): 맨 위 구간 탭 ‘이번 달’(W-02) / ‘계획’(W-01 영수증, ?view=plan).
// 상대가 월급 계획을 바꾸면 Realtime으로 바로 다시 읽음.
export function SalaryTab() {
  const [params] = useSearchParams();
  const space = useSpace();
  useSplitRealtime(space.data?.id);
  useCheckRealtime(space.data?.id);
  useGoalRealtime(space.data?.id);
  return params.get('view') === 'plan' ? <W01Receipt /> : <W02PaydayConfirm />;
}

/** 구간 탭 ‘이번 달 / 계획’. 사람 탭(who)은 그대로 */
export function SalarySeg({ value }: { value: 'month' | 'plan' }) {
  const [params, setParams] = useSearchParams();
  return (
    <Tabs
      variant="seg"
      label={copy.segLabel}
      value={value}
      onChange={(v) => {
        const next = new URLSearchParams();
        if (v === 'plan') next.set('view', 'plan');
        const who = params.get('who');
        if (who) next.set('who', who);
        setParams(next, { replace: true });
      }}
      items={[
        { value: 'month', label: copy.segMonth },
        { value: 'plan', label: copy.segPlan },
      ]}
    />
  );
}

/**
 * 월급 탭 불러오는 중(13 공통 상태 5번, 2026-11-12 QA 5구간 S5-11): 구간 탭은 그대로 두고 본문 자리만 뼈대
 */
export function SalaryLoading({ value }: { value: 'month' | 'plan' }) {
  return (
    <MainFrame
      current="salary"
      page={{ title: copy.tabTitle }}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
          <SalarySeg value={value} />
          <SkelBody shape="cards" />
        </div>,
      ]}
    />
  );
}

/**
 * 월급 탭을 못 불러옴(13 공통 상태 7번, 2026-11-12 QA 5구간 S5-02): 구간 탭 + 오류 카드 “잠시 문제가 생겼어요” + ‘다시 시도’.
 * 홈 큰 상자 오류 카드(H-03)와 같은 모양. 월급이 없을 때의 ‘월급 알려 주기’ 카드와 다름
 */
export function SalaryLoadError({
  value,
  onRetry,
}: {
  value: 'month' | 'plan';
  onRetry: () => void;
}) {
  return (
    <MainFrame
      current="salary"
      page={{ title: copy.tabTitle }}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-4)' }}>
          <SalarySeg value={value} />
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

/** 옛 주소 /salary/split(알림 링크 등) → /salary?view=plan(who는 그대로) */
export function SplitRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams({ view: 'plan' });
  const who = params.get('who');
  if (who) next.set('who', who);
  return <Navigate to={`/salary?${next.toString()}`} replace />;
}
