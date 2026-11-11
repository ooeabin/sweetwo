import { amountBand, leftover } from '@sweetwo/core';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { useSplits } from '../data';
import { secondsSinceStart, useStep } from '../step';

// O-60 준비 끝(17 온보딩 ②, 2026-11-02 다시 둠). 홈에 들어가기 전 한 장: 무엇을 해 뒀고 홈에서 무엇을 할지.
// ‘홈으로 가기’ → 온보딩을 마치고 홈(onboarding_completed, 32 4-3). 진행 막대, 뒤로 없음
export function O60Ready() {
  const s = useStep('o-60');
  const splits = useSplits();
  if (!s.ready) return <QuestionSkeleton onBack={null} fields={0} />;
  const me = s.state.me;
  const joint = s.state.space?.salary_mode === 'joint';
  const day = me?.payday_last ? copy.paydayLast : me?.payday ? `${me.payday}일` : null;
  const items = me?.monthly_income
    ? [
        { icon: 'wallet' as const, text: copy.readyDone.split },
        ...(day ? [{ icon: 'calendar-check' as const, text: copy.readyDone.checklist(day) }] : []),
        { icon: 'piggy-bank' as const, text: copy.readyDone.goal },
      ]
    : // 월급이 없으면 저금을 추가할 수 없어(20 W-11) 저금 줄 없음(2026-11-09)
      [{ icon: 'wallet' as const, text: copy.readyDone.salary }];
  const completed = () => {
    const income = me?.monthly_income ?? 0;
    const mine = splits.data?.find((x) =>
      joint ? x.owner_user_id === null : x.owner_user_id === me?.id,
    );
    const total = joint ? income + (s.state.partner?.monthly_income ?? 0) : income;
    const left = leftover(total, mine?.split_line ?? []);
    track('onboarding_completed', {
      duration_sec: secondsSinceStart(),
      salary_mode: joint ? 'combined' : 'separate',
      income_band: income > 0 ? amountBand(income) : 'none',
      split_left_band: left < 0 ? 'short' : amountBand(left),
      no_income: income === 0,
    });
  };
  return (
    <QuestionLayout
      title={copy.readyTitle(me?.nickname ?? '')}
      primary={{ label: copy.readyGo, loading: s.saving }}
      onSubmit={() => void s.finish(undefined, completed)}
      center
      hero={<DoneMark />}
    >
      <ul className="hg-intro-steps">
        {items.map((x) => (
          <li key={x.text}>
            {/* 2D 안내 그림(Illustrations ‘나중 과제’ 5번)이 들어올 때까지 40px 회색 빈 원(hg-artslot, 2026-11-09 다시 붙임) */}
            <span className="hg-intro-steps__icon hg-artslot" aria-hidden="true" />
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
    </QuestionLayout>
  );
}
