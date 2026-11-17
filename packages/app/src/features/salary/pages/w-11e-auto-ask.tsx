import { Chip, ChoiceCards, DayWheel, QuestionLayout, type PayDay } from '@sweetwo/ui';
import { useRef } from 'react';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';

type Answer = 'yes' | 'no';

/**
 * W-11e 은행에서 자동으로 나가요?(20 v2.2, G6): ‘네, 자동이에요’ → “언제 나가요?” 휠(처음 값 월급날, 칩 ‘월급날’ ‘다음 날’)
 * / ‘아니요, 직접 보내요’. 미리 고른 값 없음. W-11b 다음, W-11c 앞. 값은 W-11 입력값에 두고 저장 때 자동 줄로 설정.
 * autoDay null = 월급날(서버 auto_day null), 31 = 말일
 */
export function W11eAutoAsk({
  steps,
  value,
  day,
  payday,
  onBack,
  onChange,
  onNext,
}: {
  steps: { total: number; now: number };
  value: boolean | null;
  day: number | null;
  /** 내 월급날(없으면 25일로 처음 값) */
  payday: number | null;
  onBack: () => void;
  onChange: (auto: boolean, day: number | null) => void;
  onNext: () => void;
}) {
  const asked = useRef(false);
  const pay = payday ?? 25;
  const answer: Answer | null = value === null ? null : value ? 'yes' : 'no';
  const done = (a: Answer) => {
    if (!asked.current) {
      asked.current = true;
      track('auto_pay_asked', { screen_id: 'W-11e', answer: a });
    }
  };
  // 휠 값: null(월급날)이면 월급날 숫자
  const shown: PayDay = day === null ? (pay >= 31 ? 'last' : pay) : day >= 31 ? 'last' : day;
  const nextDay = pay >= 31 ? 1 : pay + 1;
  return (
    <QuestionLayout
      steps={steps}
      title={copy.autoQ}
      onBack={onBack}
      primary={value ? { label: copy.next } : undefined}
      onSubmit={() => {
        done('yes');
        onNext();
      }}
    >
      <ChoiceCards<Answer>
        label={copy.autoQ}
        value={answer}
        onChange={(a) => onChange(a === 'yes', a === 'yes' ? day : null)}
        onPick={(a) => {
          if (a === 'no') {
            done('no');
            onNext();
          }
        }}
        autoAdvance
        options={[
          { value: 'yes', label: copy.autoYes },
          { value: 'no', label: copy.autoNo },
        ]}
      />
      {value && (
        <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          <p className="hg-field__label" style={{ margin: 0 }}>
            {copy.autoDayQ}
          </p>
          <div
            className="hg-row"
            role="group"
            aria-label={copy.autoDayLabel}
            style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            <Chip selected={day === null} onClick={() => onChange(true, null)}>
              {copy.autoDayPayday}
            </Chip>
            <Chip selected={day === nextDay} onClick={() => onChange(true, nextDay)}>
              {copy.autoDayNext}
            </Chip>
          </div>
          <DayWheel
            label={copy.autoDayQ}
            value={shown}
            initial={shown}
            lastLabel={copy.paydayLast}
            onChange={(v) => {
              const n = v === 'last' ? 31 : v;
              onChange(true, n === pay ? null : n);
            }}
          />
        </div>
      )}
    </QuestionLayout>
  );
}
