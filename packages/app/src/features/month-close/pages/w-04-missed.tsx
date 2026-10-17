import { fetchPastPlans, qk } from '@sweetwo/api';
import { missedPlans, missedRange, todayKst } from '@sweetwo/core';
import { ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { closePath, useCloseData } from '../data';
import { copy } from '../copy';
import { useCloseTarget } from '../target';

// 놓친 달(docs/spec/21-month-close.md ‘놓친 달’, 07 5장). 기준일이 지나도 정리하지 않은 플랜.
// 지금 정리하기 = 그 플랜으로 W-04j·W-04k → W-04g(꼼꼼 모드는 그대로), 쉬어가기 = W-04j·W-04k만 적고 끝(플랜 ‘쉬어감’).
// 2개월 이상 밀리면 쉬어가기만(밀린 달 모두 쉬어감, 합계는 가장 최근 달에 한 번).
export function W04Missed() {
  const nav = useNavigate();
  const today = todayKst();
  const d = useCloseData(false);
  const past = useQuery({ queryKey: qk.pastPlans(today), queryFn: () => fetchPastPlans(today) });
  const set = useCloseTarget((s) => s.set);
  if (past.isLoading || d.loading) return null;
  const missed = missedPlans(past.data ?? []);
  const latest = missed[0];
  if (!latest) return <Navigate to="/" replace />;
  const many = missed.length > 1;
  const range = missedRange(missed);
  const go = (mode: 'now' | 'rest') => {
    set({ day: latest.cycleEnd, mode, plans: missed.map((p) => p.id) });
    nav(closePath('w-04a'));
  };

  return (
    <QuestionLayout
      title={many ? copy.missedMany(range) : copy.missedTitle(range)}
      help={copy.missedSub(d.month)}
      onBack={() => nav('/')}
    >
      <ChoiceCards<'now' | 'rest'>
        label={many ? copy.missedMany(range) : copy.missedTitle(range)}
        options={[
          ...(many
            ? []
            : [{ value: 'now' as const, label: copy.missedNow, sub: copy.missedNowSub }]),
          { value: 'rest' as const, label: copy.missedRest, sub: copy.missedRestSub },
        ]}
        value={null}
        onChange={() => undefined}
        onPick={go}
        autoAdvance
        autoFocus
      />
    </QuestionLayout>
  );
}
