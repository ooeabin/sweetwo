import { todayKst } from '@sweetwo/core';
import { DateInput, QuestionLayout, YearMonthInput } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { useStep } from '../step';

// O-12 결혼한 날·예정일(Q4). 했어요는 오늘까지, 준비 중은 내일부터. 준비 중만 ‘아직 미정이에요’ → 예정 연·월(추정),
// 그것도 모르면 ‘건너뛸게요’. 결혼 단계(비교 통계)와 결혼 비용 기한 기본값에 씀.
// 결혼기념일 챙길 날 자동 등록은 캘린더 단계에서([확인 필요] 기획서 16 O-12).
export function O12WeddingDate() {
  const s = useStep('o-12');
  const sp = s.state.space;
  const engaged = sp?.marriage_status === 'engaged';
  const [undecided, setUndecided] = useState<boolean | null>(null);
  const isUndecided = undecided ?? (engaged && !!sp?.wedding_month && !sp.wedding_date);
  const [date, setDate] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  if (!s.ready) return null;

  const saveDate = (patch: {
    wedding_date: string | null;
    wedding_month: string | null;
    wedding_date_estimated: boolean;
  }) => saveSpace(patch);
  const today = todayKst();
  const d = date ?? (typed ? null : (sp?.wedding_date ?? null));
  const m = month ?? (sp?.wedding_month ? sp.wedding_month.slice(0, 7) : null);
  const rangeError =
    d && (engaged ? d <= today : d > today)
      ? engaged
        ? copy.futureOnly
        : copy.pastOnly
      : undefined;
  const thisYm = today.slice(0, 7);
  const monthError = m && m < thisYm ? copy.futureOnly : undefined;

  if (isUndecided) {
    return (
      <QuestionLayout
        chapter={s.chapter}
        title={copy.whenPlanned}
        onBack={() => setUndecided(false)}
        primary={{ label: copy.next, disabled: !m || !!monthError, loading: s.saving }}
        onSubmit={() =>
          void s.done(() =>
            saveDate({
              wedding_date: null,
              wedding_month: m ? `${m}-01` : null,
              wedding_date_estimated: true,
            }),
          )
        }
      >
        <YearMonthInput label={copy.whenPlanned} value={m} onChange={setMonth} error={monthError} />
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            void s.done(() =>
              saveDate({ wedding_date: null, wedding_month: null, wedding_date_estimated: false }),
            )
          }
        >
          {copy.skipDate}
        </button>
      </QuestionLayout>
    );
  }
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={engaged ? copy.weddingPlanned : copy.weddingDone}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !d || !!rangeError, loading: s.saving }}
      onSubmit={() =>
        void s.done(() =>
          saveDate({ wedding_date: d, wedding_month: null, wedding_date_estimated: false }),
        )
      }
    >
      <DateInput
        label={engaged ? copy.weddingPlanned : copy.weddingDone}
        value={d}
        onChange={(v, parts) => {
          setTyped(true);
          setDate(v);
          void parts;
        }}
        error={rangeError}
      />
      {engaged && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setUndecided(true)}
        >
          {copy.undecided}
        </button>
      )}
    </QuestionLayout>
  );
}
