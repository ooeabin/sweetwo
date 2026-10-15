import { markProposalSeen, type Proposal } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { Badge, Button } from '@sweetwo/ui';
import { useEffect, useRef } from 'react';
import { useProposalActions } from './actions';
import { copy } from './copy';
import { describe, nameOf, type GoalName, type Names } from './values';

// 제안 중 카드(22 목표 수정 5·6번): G-02 머리 아래. 보낸 사람 = 보내기 취소 / 철회, 받은 사람 = 좋아요 / 다르게 해볼래요 / 반대
export function ProposalInline({
  p,
  names,
  goals,
  onDifferent,
}: {
  p: Proposal;
  names: Names;
  goals: GoalName[];
  /** 다르게 해볼래요(목표 금액·기한) */
  onDifferent?: () => void;
}) {
  const mine = p.proposer === names.myId;
  const who = nameOf(names, p.proposer);
  const act = useProposalActions(p, { who, partner: names.partnerName });
  const line = describe(p, names, goals);

  const seen = useRef(false);
  useEffect(() => {
    if (mine || p.seen_at || seen.current) return;
    seen.current = true;
    void markProposalSeen(p.id).catch(() => undefined);
  }, [p, mine]);

  return (
    <section className="hg-card hg-stack" aria-label={copy.from(who)}>
      <div className="hg-card__top">
        <span className="hg-card__label">{copy.from(who)}</span>
        {p.together ? (
          <Badge kind="warn">{copy.together}</Badge>
        ) : (
          <Badge kind="temp">{copy.status.open}</Badge>
        )}
      </div>
      <p style={{ margin: 0 }}>
        <b>
          {line.label} {copy.change(line.before, line.after)}
        </b>
      </p>
      <p className="hg-card__meta">
        {p.together ? copy.togetherNote : copy.applyNote(formatMonthDay(p.apply_on))}
      </p>
      <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {mine ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={act.busy}
            onClick={() => void act.withdraw()}
          >
            {p.seen_at ? copy.withdraw : copy.cancelSend}
          </Button>
        ) : (
          <>
            <Button variant="primary" size="sm" disabled={act.busy} onClick={() => void act.like()}>
              {copy.like}
            </Button>
            {onDifferent && (
              <Button variant="secondary" size="sm" disabled={act.busy} onClick={onDifferent}>
                {copy.differently}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={act.busy}
              onClick={() => void act.oppose()}
            >
              {copy.oppose}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
