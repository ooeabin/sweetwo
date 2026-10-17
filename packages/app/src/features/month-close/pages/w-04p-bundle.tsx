import { respondProposal } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { Badge, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ProposalInline,
  describeProposal,
  proposalCopy,
  recalcPendingShares,
  refreshAfterChange,
  useProposalActions,
} from '../../proposals';
import { copy } from '../copy';
import { useCloseData } from '../data';

// W-04p 월말 정리 제안 응답(docs/spec/21-month-close.md, 받은 사람). 묶음의 바뀐 값 전부를 카드로:
// 열린 항목은 좋아요 / 다르게 해볼래요(G-08, 용돈 없음) / 반대, 답한 항목은 상태만.
// ‘모두 좋아요’ = 남은 열린 항목 전부 좋아요(반대한 항목이 생기면 “나머지 {n}개 좋아요”). 누르지 않아도 기준일에 적용.
export function W04pBundle() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useCloseData();
  const bundle = d.proposals.filter((p) => p.month_close_id === id);
  const open = bundle.filter((p) => p.status === 'open');
  const who = d.couple?.partnerName ?? '';
  const act = useProposalActions(open[0] ?? null, { who, partner: who });
  if (d.loading || !d.me || !d.couple) return null;
  const c = d.couple;
  const names = { myId: d.me.id, myName: c.myName, partnerName: c.partnerName, starter: c.starter };
  const goals = d.goals.map((g) => ({ id: g.id, name: g.name }));
  const applyOn = bundle.map((p) => p.apply_on).sort()[0];
  const answered = bundle.length - open.length;
  const likeAll = () =>
    act.run(async () => {
      for (const p of open) await respondProposal(p.id, 'like');
      await recalcPendingShares();
      await refreshAfterChange(qc);
    });

  return (
    <QuestionLayout
      title={copy.bundleTitle(c.partnerName, d.month)}
      help={applyOn ? copy.applyFrom(formatMonthDay(applyOn)) : undefined}
      onBack={() => nav('/')}
      primary={
        open.length
          ? { label: answered ? copy.restLike(open.length) : copy.allLike, loading: act.busy }
          : { label: copy.toMonth }
      }
      onSubmit={() => (open.length ? void likeAll() : nav('/'))}
    >
      {bundle.map((p) => {
        if (p.status === 'open')
          return (
            <ProposalInline
              key={p.id}
              p={p}
              names={names}
              goals={goals}
              onDifferent={p.item !== 'allowance' ? () => nav(`/proposals/${p.id}`) : undefined}
            />
          );
        const line = describeProposal(p, names, goals);
        return (
          <section
            key={p.id}
            className="hg-card hg-row"
            style={{ justifyContent: 'space-between' }}
          >
            <span>
              {line.label} {proposalCopy.change(line.before, line.after)}
            </span>
            <Badge kind={p.status === 'applied' ? 'done' : 'warn'}>
              {proposalCopy.status[p.status as keyof typeof proposalCopy.status] ?? ''}
            </Badge>
          </section>
        );
      })}
      {!open.length && <p className="hg-help">{copy.bundleDone}</p>}
    </QuestionLayout>
  );
}
