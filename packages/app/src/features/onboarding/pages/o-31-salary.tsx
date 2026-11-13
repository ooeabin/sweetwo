import { MAX_WON, quickChips, readWon } from '@sweetwo/core';
import { AmountInput, Checkbox, Modal, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useState } from 'react';
import { useConfirmOnce } from '../confirm';
import { copy } from '../copy';
import { saveRecommendedSplit } from '../auto-split';
import { usePlanShareNote } from '../../../shared/plan-share-note';
import { saveMe } from '../data';
import { useStep } from '../step';

/** 이상값 한 번 확인(2026-11-10 S2-07, 17 O-31): 10만 원 미만이나 1억 원 초과 */
const LOW = 100_000;
const HIGH = 100_000_000;

// O-31 월급 금액(17 온보딩 ② v2.2) → O-32 월급날. ‘매달 금액이 달라요’면 보통 들어오는 금액(더 들어오면 W-20).
// 주 버튼 위 공개 고지 한 줄(5번): 각자 계열은 내 공개 단계 + ‘바꾸기’(S-13 ① 시트), 같이 계열은 한 줄.
// ‘지금은 월급이 없어요’ = 확인 대화상자(S2-02) → 금액 0, 월급날 없음 → 0원 월급 계획을 만들고 O-55.
// 금액 칸에 처음 포커스(S2-12, 기기 숫자 자판), 999억 넘으면 다음 비활성(S2-06)
export function O31Salary() {
  const s = useStep('o-31');
  const me = s.state.me;
  const [amount, setAmount] = useState<number | null | undefined>(undefined);
  const [variable, setVariable] = useState<boolean | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const ok = useConfirmOnce();
  const share = usePlanShareNote({
    joint: s.state.space?.salary_mode === 'joint',
    userId: me?.id ?? '',
    share: me?.plan_share ?? 'saving_only',
    screenId: 'O-31',
  });
  if (!s.ready)
    return <QuestionSkeleton title={copy.salary} chapter={s.chapter} onBack={s.onBack ?? null} />;
  // 월급 없음(0원)으로 저장했다가 돌아오면 빈 칸(0과 오류를 바로 보이지 않게)
  const saved = me?.monthly_income ? me.monthly_income : null;
  const value = amount === undefined ? saved : amount;
  const isVariable = variable ?? me?.income_variable ?? false;
  const valid = value !== null && value > 0 && value <= MAX_WON;

  const save = (income: number) =>
    s.done(
      () =>
        saveMe({
          monthly_income: income,
          income_variable: isVariable,
          // 날짜 없음(O-32)은 ‘매달 금액이 달라요’일 때만
          ...(isVariable ? {} : { payday_none: false }),
        }),
      undefined,
      {
        replan: income !== me?.monthly_income,
      },
    );
  // 월급이 없으면 월급날도 없음: 0원 월급 계획을 만들고 O-60 준비 끝으로
  const noSalary = () =>
    s.done(
      async () => {
        await saveMe({
          monthly_income: 0,
          income_variable: false,
          payday: null,
          payday_last: false,
          payday_none: false,
        });
        await saveRecommendedSplit();
      },
      () => 'o-55',
      { answer: 'none' },
    );
  return (
    <QuestionLayout
      chapter={s.chapter}
      title={copy.salary}
      help={isVariable ? copy.salaryVariableHelp : copy.salaryHelp}
      onBack={s.onBack}
      primary={{ label: copy.next, disabled: !valid, loading: s.saving }}
      note={me ? share.note : undefined}
      onSubmit={() =>
        valid &&
        ok.check(value < LOW || value > HIGH, copy.checkSalary(readWon(value))) &&
        void save(value)
      }
    >
      <AmountInput
        label={copy.salary}
        value={value}
        onChange={(x) => {
          setAmount(x);
          ok.reset();
        }}
        quick={quickChips.small.slice(1)}
        monthly
        embedded
        autoFocus
        zeroLink={{ label: copy.noSalary, onClick: () => setAsking(true) }}
        extra={<Checkbox label={copy.salaryVariable} checked={isVariable} onChange={setVariable} />}
      />
      {ok.banner}
      {share.sheet}
      {asking && (
        <Modal
          tone="primary"
          title={copy.noSalaryQ}
          body={copy.noSalaryHelp}
          confirmLabel={copy.noSalaryYes}
          cancelLabel={copy.noSalaryNo}
          busy={s.saving}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void noSalary();
          }}
        />
      )}
    </QuestionLayout>
  );
}
