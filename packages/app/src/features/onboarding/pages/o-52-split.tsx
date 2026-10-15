import {
  dateToYm,
  monthlyNeed,
  planSummary,
  readWon,
  splitShares,
  type SplitMode,
} from '@sweetwo/core';
import { ChoiceCards, PercentSlider, QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { copy } from '../copy';
import { saveSpace } from '../data';
import { isSeparate, PART6_START, planInput } from '../flow';
import { deferPart5 } from '../part5';
import { useStep } from '../step';

// O-52 같이 쓰는 돈 나누기(Q1 + 미리보기). 반반, 버는 만큼은 고르면 바로 결과(O-61), 직접 정할게요는 슬라이더 + ‘다음’.
// 각자 관리 예비부부는 결혼 비용 월 필요액을 나눈다. 분담액 계산 → core splitShares.
export function O52Split() {
  const s = useStep('o-52');
  const sp = s.state.space;
  const me = s.state.me;
  const [mode, setMode] = useState<SplitMode | null | undefined>(undefined);
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  if (!s.ready || !sp) return null;

  const separate = isSeparate(s.state);
  const myName = me?.nickname ?? '';
  const partnerName = sp.partner_nickname ?? '';
  const unknown = sp.partner_income_unknown;
  const myIncome = me?.monthly_income ?? 0;
  const partnerIncome = unknown ? 0 : (sp.partner_income ?? 0);

  // 나눌 돈: 각자 관리 예비부부 = 결혼 비용 월 필요액, 그 밖 = 공동자금
  const plan = planSummary(planInput(s.state));
  const wedding = s.state.goals?.find((g) => g.template === 'wedding');
  const weddingNeed =
    wedding && wedding.target_amount !== null
      ? (monthlyNeed({
          target: wedding.target_amount,
          held: wedding.other_held ?? 0,
          deadline: wedding.deadline ? dateToYm(wedding.deadline) : null,
        })?.need ?? 0)
      : 0;
  const total = separate ? weddingNeed : plan.commonFund;
  const noSaving = !separate && plan.saveable <= 0;

  const value = mode === undefined ? (sp.split_mode ?? null) : mode;
  const myPct = ratio ?? sp.split_ratio ?? 50;
  const shares = (m: SplitMode) =>
    splitShares({ total, mode: m, myIncome, partnerIncome, myRatio: myPct });

  const preview = (m: SplitMode) => {
    if (m === 'income' && unknown)
      return <span className="hg-help">{copy.splitPartnerUnknown(partnerName)}</span>;
    if (noSaving) return undefined;
    const x = shares(m);
    return (
      <span className="hg-row" style={{ gap: 'var(--space-4)' }}>
        <span>
          <span className="hg-help">{myName}</span> <b>{readWon(x.me)}</b>
        </span>
        <span>
          <span className="hg-help">{partnerName}</span> <b>{readWon(x.partner)}</b>
        </span>
      </span>
    );
  };

  const save = (m: SplitMode) =>
    s.done(
      () =>
        saveSpace({
          split_mode: m,
          split_ratio: m === 'custom' ? myPct : null,
          split_deferred: false,
        }),
      () => PART6_START,
    );

  const title = separate ? copy.splitWedding : copy.split;
  const help = separate ? copy.splitWeddingHelp(readWon(total)) : copy.splitHelp(readWon(total));
  const custom = value === 'custom';
  const cx = shares('custom');

  return (
    <QuestionLayout
      steps={s.steps}
      title={title}
      help={help}
      onBack={s.onBack}
      later={{ label: copy.later, onClick: () => void deferPart5(s) }}
      primary={custom ? { label: copy.next, loading: s.saving } : undefined}
      onSubmit={() => custom && void save('custom')}
    >
      {noSaving && (
        <p className="hg-banner hg-banner--info" style={{ margin: 0 }}>
          <span>{copy.splitNoSaving}</span>
        </p>
      )}
      <ChoiceCards<SplitMode>
        label={title}
        value={value}
        onChange={setMode}
        onPick={(m) => m !== 'custom' && void save(m)}
        options={[
          { value: 'half', label: copy.splitModes.half, detail: preview('half') },
          {
            value: 'income',
            label: copy.splitModes.income,
            tag: sp.partner_income_estimated && !unknown ? copy.estimated : undefined,
            disabled: unknown,
            detail: preview('income'),
          },
          { value: 'custom', label: copy.splitModes.custom },
        ]}
      />
      {custom && (
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <PercentSlider
            label={copy.splitModes.custom}
            value={myPct}
            onChange={setRatio}
            left={copy.splitPct(myName, myPct)}
            right={copy.splitPct(partnerName, 100 - myPct)}
          />
          {!noSaving && (
            <div className="hg-row" style={{ justifyContent: 'space-between' }}>
              <b>{readWon(cx.me)}</b>
              <b>{readWon(cx.partner)}</b>
            </div>
          )}
        </div>
      )}
    </QuestionLayout>
  );
}
