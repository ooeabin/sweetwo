import { markProposalSeen, propose } from '@sweetwo/api';
import { formatMonthDay, planSummary, proposalApplyOn, spaceBaseDay } from '@sweetwo/core';
import { Badge, Button, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useProposalActions } from '../actions';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { refreshAfterChange, useProposalContext } from '../data';
import { SplitPicker, type SplitPick } from '../split-picker';
import { describe, nameOf, splitOfProposal } from '../values';

// G-08 제안 확인(docs/spec/22-goals.md G-08, 08 6장). 받은 사람: 좋아요 / 다르게 해볼래요(분담, 목표 금액·기한) / 반대.
// 보낸 사람: 상태 + ‘보내기 취소’(받은 사람이 열기 전) / ‘철회’(연 뒤). 월 배분 영향(3번), 되돌리기(8번)는 목표 제안과 함께.
export function G08Proposal() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const x = useProposalContext();
  const [pick, setPick] = useState<SplitPick | null>(null);
  const p = x.list.find((r) => r.id === id) ?? null;
  const mine = !!p && !!x.me && p.proposer === x.me.id;
  const act = useProposalActions(p, {
    who: mine ? (x.couple?.myName ?? '') : (x.couple?.partnerName ?? ''),
    partner: x.couple?.partnerName ?? '',
    onDone: () => nav('/'),
  });

  // 받은 사람이 열면 ‘보내기 취소’ 대신 ‘철회’가 된다
  const seen = useRef(false);
  useEffect(() => {
    if (!p || mine || p.seen_at || seen.current) return;
    seen.current = true;
    void markProposalSeen(p.id).catch(() => undefined);
  }, [p, mine]);

  if (!x.ready) return null;
  const home = () => nav('/');
  if (!p || !x.me || !x.space || !x.couple) {
    return (
      <QuestionLayout
        title={copy.notFound}
        onBack={home}
        primary={{ label: copy.retry }}
        onSubmit={home}
      />
    );
  }

  const c = x.couple;
  const names = { myId: x.me.id, myName: c.myName, partnerName: c.partnerName, starter: c.starter };
  const who = nameOf(names, p.proposer);
  const line = describe(p, names, x.goals);
  const open = p.status === 'open';
  const base = spaceBaseDay(x.space, c);

  const { busy, run, like, oppose, withdraw } = act;
  const sendDifferent = (v: SplitPick) =>
    run(async () => {
      if (!v.mode || base === null) return;
      await propose(
        'split',
        v.mode === 'custom'
          ? { mode: v.mode, starter_ratio: c.starter ? v.myPct : 100 - v.myPct }
          : { mode: v.mode },
        proposalApplyOn(base),
      );
      toast(copy.proposed(who));
      await refreshAfterChange(qc);
      home();
    });

  // 다르게 해볼래요(분담): O-52 고르기 → 이전 제안을 대체해 보냄
  if (pick) {
    const sp = x.space;
    const plan = planSummary({
      myIncome: c.myIncome,
      partnerIncome: c.partnerIncome,
      partnerUnknown: c.partnerUnknown,
      myAllowance: c.myAllowance,
      partnerAllowance: c.partnerAllowance,
      fixedTotal: sp.fixed_total,
      loanRepayment: sp.loan_repayment,
      livingBudget: sp.living_budget,
    });
    return (
      <QuestionLayout
        title={copy.differently}
        help={copy.applyNote(base === null ? '' : formatMonthDay(proposalApplyOn(base)))}
        onBack={() => setPick(null)}
        primary={{
          label: copy.proposeTo(who),
          disabled: !pick.mode || base === null,
          loading: busy,
        }}
        onSubmit={() => void sendDifferent(pick)}
      >
        <SplitPicker
          label={copy.differently}
          value={pick}
          onChange={setPick}
          total={plan.commonFund}
          myName={c.myName}
          partnerName={c.partnerName}
          myIncome={c.myIncome ?? 0}
          partnerIncome={c.partnerIncome ?? 0}
          partnerUnknown={c.partnerUnknown}
        />
      </QuestionLayout>
    );
  }

  const answer = open && !mine;
  return (
    <QuestionLayout
      title={copy.from(who)}
      help={
        !open
          ? undefined
          : p.together
            ? copy.togetherNote
            : copy.applyNote(formatMonthDay(p.apply_on))
      }
      onBack={home}
      primary={answer ? { label: copy.like, loading: busy } : undefined}
      onSubmit={answer ? () => void like() : undefined}
    >
      <section className="hg-card hg-stack" aria-label={line.label}>
        <div className="hg-card__top">
          <span className="hg-card__label">{line.label}</span>
          {p.together && open ? (
            <Badge kind="warn">{copy.together}</Badge>
          ) : (
            <Badge kind={p.status === 'applied' ? 'done' : 'temp'}>{copy.status[p.status]}</Badge>
          )}
        </div>
        <p className="hg-card__value">{copy.change(line.before, line.after)}</p>
      </section>
      {answer && (
        <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
          {p.item === 'split' && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPick(splitOfProposal(p.after, c.starter))}
            >
              {copy.differently}
            </Button>
          )}
          {(p.item === 'goal_amount' || p.item === 'goal_deadline') && p.target_id && (
            // 목표 수정 화면에서 고친 안이 이 제안을 대체
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                nav(
                  `/goals/${p.target_id}/edit/${p.item === 'goal_amount' ? 'amount' : 'deadline'}`,
                )
              }
            >
              {copy.differently}
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => void oppose()}>
            {copy.oppose}
          </Button>
        </div>
      )}
      {open && mine && (
        <div className="hg-row">
          <Button variant="secondary" disabled={busy} onClick={() => void withdraw()}>
            {p.seen_at ? copy.withdraw : copy.cancelSend}
          </Button>
        </div>
      )}
    </QuestionLayout>
  );
}
