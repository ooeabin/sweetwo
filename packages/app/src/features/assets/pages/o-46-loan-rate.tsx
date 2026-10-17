import { avgRate } from '@sweetwo/core';
import { Field, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { copy } from '../copy';
import { useLoanStep } from '../week/loan';
import { weekPath } from '../week/week';

// O-46 금리(Q3 변형, 소수점 1자리 %). ‘잘 모르겠어요’ = 유형별 평균 금리(06 4장) + ‘추정’, 평균이 없는 유형은 비움.
// 비워 두고 ‘다음’도 됨(건너뛰기)
export function O46LoanRate() {
  const s = useLoanStep('rate');
  const [text, setText] = useState<string | null>(null);
  if (!s.key) return <Navigate to={weekPath.loans} replace />;
  if (s.w.d.loading) return null;
  const item = s.item;
  const shown =
    text ??
    (item?.rate === null || item?.rate === undefined || item.rateEstimated
      ? ''
      : String(item.rate));
  const v = shown.trim() === '' ? null : Number(shown);
  const bad = v !== null && (!Number.isFinite(v) || v < 0 || v > 100);
  const avg = avgRate(s.pick?.kind ?? '');
  return (
    <QuestionLayout
      steps={s.steps}
      title={copy.rate}
      help={s.help}
      onBack={s.back}
      later={s.close}
      primary={{ label: copy.next, disabled: bad, loading: s.saving }}
      onSubmit={() =>
        !bad &&
        void s.next(v === null ? {} : { rate: Math.round(v * 10) / 10, rateEstimated: false })
      }
    >
      <Field
        key={s.key}
        label={copy.rate}
        inputMode="decimal"
        value={shown}
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
        error={bad ? copy.rateError : undefined}
        help={item?.rateEstimated && item.rate !== null ? copy.weekRateAvg(item.rate) : '%'}
      />
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => void s.next({ rate: avg, rateEstimated: avg !== null })}
      >
        {copy.weekRateUnknown}
      </button>
    </QuestionLayout>
  );
}
