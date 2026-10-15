import { finishJoin, updatePendingShares } from '@sweetwo/api';
import { formatManWon, planSummary, readPlanSnapshot, readWon, splitShares } from '@sweetwo/core';
import { QuestionLayout, SceneMedia } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useJoinStep } from '../join-step';

// P-11 합류 완료(O-62 형식). 들어오면 합류 완료(부부 연결, 코드 사용됨) + 이번 플랜의 안 나눈 줄 분담액만 다시 계산.
// 새 플랜은 다음 기준일부터. O-63~65 다시 보기는 다음 단계라 ‘이번 달로’.
export function P11Joined() {
  const s = useJoinStep('p-11');
  const d = s.d;
  const nav = useNavigate();
  const [finished, setFinished] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!d.ready || !d.space || !d.couple || ran.current) return;
    ran.current = true;
    const run = async () => {
      try {
        await finishJoin();
        const sp = d.space;
        const c = d.couple;
        if (d.plan && sp && c) {
          // 안 나눈 통장 줄마다 새 분담(금액은 그대로)
          const mode = sp.split_deferred || !sp.split_mode ? 'half' : sp.split_mode;
          const groom = d.me?.side !== 'bride';
          const shares = (d.plan.lines ?? [])
            .filter((l) => l.target === 'account' && l.state === 'pending' && l.account_role)
            .map((l) => {
              const x = splitShares({
                total: l.amount,
                mode,
                myRatio: c.myRatio,
                myIncome: c.myIncome ?? 0,
                partnerIncome: c.partnerIncome ?? 0,
              });
              return {
                account_role: l.account_role as string,
                amount_groom: groom ? x.me : x.partner,
                amount_bride: groom ? x.partner : x.me,
              };
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
      primary={{ label: copy.toMonth, disabled: !finished }}
      onSubmit={() => nav('/', { replace: true })}
    >
      <SceneMedia scene="P-11" />
      <div className="hg-cards">
        <div className="hg-card">
          <span className="hg-card__label">{copy.incomeCard}</span>
          <p className="hg-card__value">{readWon(now.income)}</p>
          {beforeIncome !== now.income && (
            <p className="hg-card__meta">
              <s aria-label={copy.before}>{readWon(beforeIncome)}</s>
            </p>
          )}
        </div>
        <div className="hg-card">
          <span className="hg-card__label">{copy.saveCard}</span>
          <p className="hg-card__value">{readWon(Math.max(now.saveable, 0))}</p>
          {beforeSave !== null && beforeSave !== now.saveable && (
            <p className="hg-card__meta">
              <s aria-label={copy.before}>{readWon(Math.max(beforeSave, 0))}</s>
            </p>
          )}
        </div>
        <div className="hg-card">
          <span className="hg-card__label">{copy.shareCard}</span>
          <p className="hg-card__meta">{copy.splitModes[mode]}</p>
          <p style={{ margin: 0 }}>
            <span className="hg-help">{c.myName}</span> <b>{formatManWon(share.me)} 원</b>{' '}
            <span className="hg-help">{c.partnerName}</span> <b>{formatManWon(share.partner)} 원</b>
          </p>
        </div>
      </div>
      {month && <p className="hg-q__help">{copy.planKept(month)}</p>}
    </QuestionLayout>
  );
}
