import type { PayCheckLine } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { money, useMask } from '../../../shared/mask';
import { quietly, toast } from '../../../shared/toast';
import { checkToast } from '../check-line';
import { copy } from '../copy';
import { useCheck, type CheckEntry } from '../data';

/**
 * W-02a 다른 금액(20, Q3). W-02와 W-05 줄 시트 ‘다른 금액으로 보냈어요’에서 엶(2026-11-12 D6: W-05도).
 * 제목에 줄 이름(“생활비, 얼마를 보냈어요?”), 보조는 계획 금액과 차이. 0원이면 ‘이번 달은 못 했어요’와 같음.
 * 저장하면 체크와 같은 Toast + ‘되돌리기’(2026-11-12 S6-07), 빈 칸이면 ‘다음’을 누를 수 없음.
 * 화면 안 상태가 아니라 기록(history state)에 둬서 뒤로·하드웨어 뒤로가 그 체크리스트로 돌아감(S6-11)
 */
export function W02aOtherAmount({
  line,
  name,
  goalName,
  personName,
  entry,
  onClose,
}: {
  line: PayCheckLine;
  name: string;
  goalName?: string;
  personName: (id: string | null) => string | null;
  entry: CheckEntry;
  /** 뒤로(기록 한 칸 뒤로) */
  onClose: () => void;
}) {
  const check = useCheck(entry);
  const { masked } = useMask();
  const [amount, setAmount] = useState<number | null>(line.planned);
  const diff = (amount ?? line.planned) - line.planned;
  return (
    <QuestionLayout
      title={copy.howMuchFor(name)}
      help={
        amount === null
          ? copy.planned(readWon(line.planned))
          : diff < 0
            ? copy.lessThanPlan(readWon(-diff))
            : diff > 0
              ? copy.moreThanPlan(readWon(diff))
              : copy.planned(readWon(line.planned))
      }
      onBack={onClose}
      primary={{ label: copy.next, disabled: amount === null }}
      onSubmit={() => {
        if (amount === null) return;
        const v = amount;
        const from = line.state as 'checked' | 'wait' | 'skipped';
        onClose();
        void check(line, 'checked', v)
          .then((res) =>
            checkToast(res, {
              line,
              name,
              goalName,
              amount: money(v, masked),
              to: v === 0 ? 'skipped' : 'checked',
              personName,
              undo: () => quietly(check(line, from, undefined, 'toast')),
            }),
          )
          .catch(() => toast(copy.failed));
      }}
    >
      <AmountInput
        label={copy.howMuch}
        value={amount}
        onChange={(x) => setAmount(x ?? null)}
        monthly
        allowZero
      />
    </QuestionLayout>
  );
}
