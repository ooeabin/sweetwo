import type { Proposal } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { ListRow } from '@sweetwo/ui';
import { copy } from './copy';
import { describe, type Names } from './values';

// 답 기다리는 제안 목록(P-11 6번): “{항목}” / “전 → 후” / 적용일. 함께 정하기면 그 문구
export function ProposalLines({
  proposals,
  names,
  label,
}: {
  proposals: Proposal[];
  names: Names;
  label: string;
}) {
  if (!proposals.length) return null;
  return (
    <div className="hg-list" role="list" aria-label={label}>
      {proposals.map((p) => {
        const d = describe(p, names);
        return (
          <div role="listitem" key={p.id}>
            <ListRow
              label={d.label}
              sub={copy.change(d.before, d.after)}
              value={p.together ? copy.together : copy.applyOn(formatMonthDay(p.apply_on))}
            />
          </div>
        );
      })}
    </div>
  );
}
