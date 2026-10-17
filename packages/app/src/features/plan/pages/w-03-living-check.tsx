import {
  answerLivingCheck,
  qk,
  undoLivingCheck,
  type LivingAnswer,
  type LivingCover,
} from '@sweetwo/api';
import { allowanceAfterCut, amountBand, formatManWon, quickChips, readWon } from '@sweetwo/core';
import { AmountInput, ChoiceCards, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { useLivingCheck, useMe, useMonthView } from '../../month';
import { copy } from '../copy';

// W-03 생활비 체크(docs/spec/20-salary-plan.md): W-03a 어때요(Q1) → ‘넘칠 것 같아요’만 W-03b 더 들 금액(Q3, 0원 불가)
// → W-03c 어디서 채울까요(Q1). 한 명이 답하면 둘 다 끝. ‘내 용돈에서’는 즉시 적용 + 상대 알림 + 토스트 ‘되돌리기’,
// 나머지 선택은 월말 정리에 반영. 켠 부부만(S-14), 결혼 전 예비부부는 없음.
export function W03LivingCheck() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const v = useMonthView();
  const me = useMe();
  const check = useLivingCheck(v?.planId ?? null);
  const [step, setStep] = useState<'a' | 'b' | 'c'>('a');
  const [answer, setAnswer] = useState<LivingAnswer | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [cover, setCover] = useState<LivingCover | null>(null);
  const [saving, setSaving] = useState(false);
  if (!v || !me.data || check.isLoading) return null;
  if (!v.planId || !v.livingCheckOn || check.data) return <Navigate to="/" replace />;
  const planId = v.planId;
  const allowance = me.data.allowance ?? 0;
  const after = over === null ? null : allowanceAfterCut(allowance, over);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.livingCheck(planId) }),
      qc.invalidateQueries({ queryKey: ['month_close'] }),
    ]);
  const save = async (a: LivingAnswer, amount?: number, from?: LivingCover) => {
    if (saving) return;
    setSaving(true);
    try {
      const id = await answerLivingCheck(planId, a, amount, from);
      track('living_check_answered', {
        answer: a,
        ...(from ? { cover_from: from } : {}),
        ...(amount ? { over_band: amountBand(amount) } : {}),
      });
      await refresh();
      if (from === 'allowance')
        toast(copy.adjusted, {
          label: copy.undo,
          onClick: () => void undoLivingCheck(id).then(refresh),
        });
      nav('/', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setSaving(false);
    }
  };
  const later = { label: copy.living.later, onClick: () => nav('/') };

  if (step === 'a')
    return (
      <QuestionLayout title={copy.living.title} onBack={() => nav('/')} later={later}>
        <ChoiceCards<LivingAnswer>
          label={copy.living.title}
          options={(['enough', 'just', 'over'] as const).map((x) => ({
            value: x,
            label: copy.living.answers[x],
          }))}
          value={answer}
          onChange={setAnswer}
          onPick={(x) => (x === 'over' ? setStep('b') : void save(x))}
          autoAdvance
          autoFocus
          shortcuts
        />
      </QuestionLayout>
    );

  if (step === 'b')
    return (
      <QuestionLayout
        title={copy.living.overTitle}
        onBack={() => setStep('a')}
        primary={{ label: copy.next, disabled: !over }}
        onSubmit={() => over && setStep('c')}
      >
        <AmountInput
          label={copy.living.overTitle}
          value={over}
          onChange={setOver}
          quick={quickChips.small}
        />
      </QuestionLayout>
    );

  return (
    <QuestionLayout title={copy.living.coverTitle} onBack={() => setStep('b')}>
      <ChoiceCards<LivingCover>
        label={copy.living.coverTitle}
        options={[
          { value: 'goal', label: copy.living.cover.goal, sub: copy.living.coverGoalSub },
          {
            value: 'allowance',
            label: copy.living.cover.allowance,
            sub:
              after === null
                ? copy.living.coverAllowanceNo(readWon(allowance))
                : copy.living.coverAllowanceSub(formatManWon(allowance), readWon(after)),
            disabled: after === null,
          },
          { value: 'next_month', label: copy.living.cover.next_month },
        ]}
        value={cover}
        onChange={setCover}
        onPick={(x) => over && void save('over', over, x)}
        autoAdvance
        autoFocus
        shortcuts
      />
    </QuestionLayout>
  );
}
