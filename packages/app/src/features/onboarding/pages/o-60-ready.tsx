import { amountBand, leftover } from '@sweetwo/core';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { track } from '../../../shared/analytics';
import { afterSetupPath } from '../../auth';
import { useShownPayday } from '../../salary';
import { copy } from '../copy';
import { useSplits } from '../data';
import { firstPaydayLabel } from '../first-payday';
import { secondsSinceStart, useStep } from '../step';

/** O-60 ‘첫 저금 만들기’가 여는 W-11a(entry onboarding). 끝나면 미합류 초대 시트(O-07) → A-06 → 홈(/welcome) */
export const FIRST_SAVING_PATH = '/salary/items/new?from=onboarding';

/** W-11a 뒤로가 돌아오는 O-60(2026-11-17) */
export const ONBOARDING_READY_PATH = '/onboarding/o-60';

// O-60 준비 끝(17 ‘O-60 준비 끝 (고친 점)’, 2026-11-13). 해 둔 것: “월급 계획을 만들어 뒀어요” /
// “11월 25일 월급날에 처음 확인해요”(날짜 없음 “수입이 들어오면 월급 ‘이번 달’에서 적어 주세요”), 월급이 없으면 한 줄만.
// 주 버튼 ‘첫 저금 만들기’ → 온보딩을 마치고 W-11a. ‘나중에 할게요’ → 온보딩을 마치고 A-06(권장, 건너뛸 수 있음) → 홈.
// 첫 확인 목록은 만들지 않음(소급 없음, 07 3-1). 진행 막대, 뒤로 없음
export function O60Ready() {
  const s = useStep('o-60');
  // 첫 월급날도 앞당긴 날(07 1장, 확인 목록이 생기는 날과 같게)
  const shownPayday = useShownPayday();
  const splits = useSplits();
  if (!s.ready) return <QuestionSkeleton onBack={null} fields={0} />;
  const me = s.state.me;
  const joint = s.state.space?.salary_mode === 'joint';
  const date = firstPaydayLabel(me, new Date(), shownPayday);
  const items = me?.monthly_income
    ? [copy.readyDone.split, date ? copy.readyDone.firstCheck(date) : copy.readyDone.noDate]
    : [copy.readyDone.salary];
  const completed = () => {
    if (me?.onboarding_done_at) return; // W-11a 뒤로 다시 온 O-60(2026-11-17): 완료 이벤트는 처음 한 번
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
      celebrate
      hero={<DoneMark />}
    >
      <ul className="hg-intro-steps">
        {items.map((text) => (
          <li key={text}>
            {/* 2D 안내 그림(Illustrations ‘나중 과제’ 5번, 40px 원)은 그림이 들어올 때까지 자리 없이(2026-11-15 3차 검토) */}
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </QuestionLayout>
  );
}
