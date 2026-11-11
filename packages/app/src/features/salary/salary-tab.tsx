import { Tabs } from '@sweetwo/ui';
import { Navigate, useSearchParams } from 'react-router-dom';
import { copy } from './copy';
import { useCheckRealtime, useSpace, useSplitRealtime } from './data';
import { W01Receipt } from './pages/w-01-receipt';
import { W02Checklist } from './pages/w-02-checklist';

// 월급 탭(20 W-01 1번, 2026-11-09): 맨 위 구간 탭 ‘이번 달’(W-02) / ‘계획’(W-01 영수증, ?view=plan).
// 상대가 월급 계획을 바꾸면 Realtime으로 바로 다시 읽음.
export function SalaryTab() {
  const [params] = useSearchParams();
  const space = useSpace();
  useSplitRealtime(space.data?.id);
  useCheckRealtime(space.data?.id);
  return params.get('view') === 'plan' ? <W01Receipt /> : <W02Checklist />;
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

/** 옛 주소 /salary/split(알림 링크 등) → /salary?view=plan(who는 그대로) */
export function SplitRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams({ view: 'plan' });
  const who = params.get('who');
  if (who) next.set('who', who);
  return <Navigate to={`/salary?${next.toString()}`} replace />;
}
