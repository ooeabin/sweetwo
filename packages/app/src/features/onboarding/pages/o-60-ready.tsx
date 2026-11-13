import { amountBand, leftover } from '@sweetwo/core';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { track } from '../../../shared/analytics';
import { afterSetupPath } from '../../auth';
import { copy } from '../copy';
import { useSplits } from '../data';
import { firstPaydayLabel } from '../first-payday';
import { secondsSinceStart, useStep } from '../step';

/** O-60 ‘첫 저금 만들기’가 여는 W-11a(entry onboarding). 끝나면 미합류 초대 시트(O-07) → A-06 → 홈(/welcome) */
export const FIRST_SAVING_PATH = '/salary/items/new/a?from=onboarding';

// O-60 준비 끝(17 ‘O-60 준비 끝 (고친 점)’, 2026-11-13). 해 둔 것: “월급을 추천값으로 나눠 뒀어요” /
// “11월 25일 월급날에 처음 확인해요”(날짜 없음 “돈이 들어오면 홈에서 알려 주세요”), 월급이 없으면 한 줄만.
// 주 버튼 ‘첫 저금 만들기’ → 온보딩을 마치고 W-11a. ‘나중에 할게요’ → 온보딩을 마치고 A-06(권장, 건너뛸 수 있음) → 홈.
// 첫 확인 목록은 만들지 않음(소급 없음, 07 3-1). 진행 막대, 뒤로 없음
export function O60Ready() {
  const s = useStep('o-60');
  const splits = useSplits();
  if (!s.ready) return <QuestionSkeleton onBack={null} fields={0} />;
  const me = s.state.me;
  const joint = s.state.space?.salary_mode === 'joint';
  const date = firstPaydayLabel(me);
  const items = me?.monthly_income
    ? [copy.readyDone.split, date ? copy.readyDone.firstCheck(date) : copy.readyDone.noDate]
    : [copy.readyDone.salary];
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
      onSubmit={() => void s.finish(undefined, completed, FIRST_SAVING_PATH)}
      later={{
        label: copy.later,
        onClick: () => void s.finish(undefined, completed, () => afterSetupPath()),
      }}
      center
      hero={<DoneMark />}
    >
      <ul className="hg-intro-steps">
        {items.map((text) => (
          <li key={text}>
            {/* 2D 안내 그림(Illustrations ‘나중 과제’ 5번)이 들어올 때까지 40px 회색 빈 원(hg-artslot, 2026-11-09 다시 붙임) */}
            <span className="hg-intro-steps__icon hg-artslot" aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </QuestionLayout>
  );
}
