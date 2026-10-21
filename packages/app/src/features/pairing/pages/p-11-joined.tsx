import { finishJoin, updatePendingShares } from '@sweetwo/api';
import {
  formatManWon,
  pendingShares,
  planSummary,
  readPlanSnapshot,
  readWon,
  splitShares,
} from '@sweetwo/core';
import { DoneMark, InfoPlate, QuestionLayout, ResultCard } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openSent, ProposalLines, useProposals } from '../../proposals';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { joinPath, useJoinStep } from '../join-step';

// P-11 합류 완료(O-62 형식). 들어오면 합류 완료(부부 연결, 코드 사용됨) + 이번 플랜의 안 나눈 줄 분담액만 다시 계산.
// 새 플랜은 다음 기준일부터. ‘다음’ → O-63~65 다시 보기(바뀐 값 강조) → 이번 달.
export function P11Joined() {
  const s = useJoinStep('p-11');
  const d = s.d;
  const nav = useNavigate();
  const proposals = useProposals();
  const [finished, setFinished] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!d.ready || !d.space || !d.couple || ran.current) return;
    ran.current = true;
    const run = async () => {
      try {
        await finishJoin();
        const sp = d.space;
        // 첫 플랜 전(대기)이면 다시 나눌 줄이 없음
        const c = d.couple;
        if (d.plan && sp && c) {
          // 안 나눈 통장 줄마다 새 분담(금액은 그대로)
          const shares = pendingShares(d.plan.lines ?? [], {
            mode: sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode,
            myRatio: c.myRatio,
            myIncome: c.myIncome ?? 0,
            partnerIncome: c.partnerIncome ?? 0,
            iAmGroom: d.me?.side !== 'bride',
          });
          if (shares.length) await updatePendingShares(d.plan.id, shares, false);
        }
        await d.refetch();
        setFinished(true);
      } catch {
        ran.current = false;
        toast(copy.saveFailed);
      }
    };
    void run();
  }, [d.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d.ready || !d.space || !d.couple || !d.me) return null;
  if (d.waiting) {
    const me = d.me;
    return (
      <QuestionLayout
        steps={s.steps}
        title={copy.waitTitle(d.couple.partnerName)}
        help={copy.waitHelp(d.couple.partnerName)}
        primary={{ label: copy.toMonth, disabled: !finished }}
        onSubmit={() => nav('/', { replace: true })}
      >
        <DoneMark />
        <InfoPlate
          title={copy.waitPlate}
          rows={[
            {
              label: copy.incomeCard,
              value: me.monthly_income !== null ? readWon(me.monthly_income) : '-',
            },
            {
              label: copy.waitPayday,
              value: me.payday_last ? copy.paydayLast : me.payday ? `${me.payday}일` : '-',
            },
            {
              label: copy.waitAllowance,
              value: me.allowance !== null ? readWon(me.allowance) : '-',
            },
          ]}
        />
      </QuestionLayout>
    );
  }
  const sp = d.space;
  const c = d.couple;
  const inputs = {
    fixedTotal: sp.fixed_total,
    loanRepayment: sp.loan_repayment,
    livingBudget: sp.living_budget,
  };
  const now = planSummary({
    myIncome: c.myIncome,
    partnerIncome: c.partnerIncome,
    partnerUnknown: c.partnerUnknown,
    myAllowance: c.myAllowance,
    partnerAllowance: c.partnerAllowance,
    ...inputs,
  });
  // 합류 전: 시작한 사람이 적은 내 추정 수입, 내 용돈 = 시작한 사람 용돈
  const snap = readPlanSnapshot(d.plan?.snapshot);
  const beforeIncome = snap.income ?? (c.partnerIncome ?? 0) + (sp.partner_income ?? 0);
  const beforeSave = snap.saveable ?? null;
  const mode = sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode;
  const waiting = openSent(proposals.data ?? [], d.me.id);
  const month = d.plan ? Number(d.plan.label_month.slice(5, 7)) : null;
  const share = splitShares({
    total: now.commonFund,
    mode,
    myRatio: c.myRatio,
    myIncome: c.myIncome ?? 0,
    partnerIncome: c.partnerIncome ?? 0,
  });

  return (
    <QuestionLayout
      wide
      steps={s.steps}
      title={copy.done(readWon(Math.max(now.saveable, 0)))}
      primary={{ label: copy.next, disabled: !finished }}
      onSubmit={() => nav(joinPath('o-63'))}
    >
      <ResultCard
        label={copy.saveCard}
        value={readWon(Math.max(now.saveable, 0))}
        meta={
          beforeSave !== null && beforeSave !== now.saveable ? (
            <s aria-label={copy.before}>{readWon(Math.max(beforeSave, 0))}</s>
          ) : undefined
        }
        items={[
          {
            label: copy.incomeCard,
            value: (
              <>
                <span>{readWon(now.income)}</span>
                {beforeIncome !== now.income && (
                  <>
                    {' '}
                    <s className="hg-card__meta" aria-label={copy.before}>
                      {readWon(beforeIncome)}
                    </s>
                  </>
                )}
              </>
            ),
          },
          { label: copy.shareMode, value: copy.splitModes[mode] },
          {
            label: copy.shareOf(c.myName),
            value: `${formatManWon(share.me)} 원`,
          },
          {
            label: copy.shareOf(c.partnerName),
            value: `${formatManWon(share.partner)} 원`,
          },
        ]}
      />
      {waiting.length > 0 && (
        <section className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <h2 className="hg-card__label" style={{ margin: 0 }}>
            {copy.waiting}
          </h2>
          <ProposalLines
            proposals={waiting}
            label={copy.waiting}
            names={{
              myId: d.me.id,
              myName: c.myName,
              partnerName: c.partnerName,
              starter: c.starter,
            }}
          />
        </section>
      )}
      {month && <p className="hg-q__help">{copy.planKept(month)}</p>}
    </QuestionLayout>
  );
}
