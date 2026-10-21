import type { PartnerActivity } from '@sweetwo/api';
import { maskMoney, notiTime, readWon } from '@sweetwo/core';
import { ListRow, SectionHeader } from '@sweetwo/ui';
import { useMask } from '../../shared/mask';
import { copy } from './copy';

const LINES: Record<string, string> = {
  living: copy.roles.living,
  goal_fund: copy.roles.goalFund,
  emergency: copy.roles.emergency,
  allowance: copy.roles.allowance,
};

/** 활동 한 건 문구(19 H-08, 30 7장). ‘합계만’ 상대 명의 항목은 이름 없이 */
export function activityText(a: PartnerActivity, partner: string): string {
  if (a.kind === 'notice') return a.name ?? '';
  if (a.kind === 'split_done') {
    const line = a.name ? LINES[a.name] : undefined;
    return line ? copy.activitySplit(partner, line) : copy.activitySplitAny(partner);
  }
  if (a.kind === 'emergency_in' || a.kind === 'emergency_out')
    return copy.activityEmergency(partner, a.kind === 'emergency_in', readWon(Number(a.name ?? 0)));
  if (a.name === null) return copy.activitySum;
  return a.kind === 'asset_added'
    ? copy.activityAdded(partner, a.name)
    : copy.activityChanged(partner, a.name);
}

// H-08 배우자 활동(19 이번 달 9번): 오른쪽 단 카드, 최근 5건 → 관련 화면. 배우자 미합류, 혼자 쓰기면 카드 없음.
export function H08Activity({
  items,
  partner,
  onOpen,
}: {
  items: PartnerActivity[];
  partner: string;
  onOpen: (to: string) => void;
}) {
  const { masked } = useMask();
  const title = copy.activity(partner);
  return (
    <section className="hg-stack" aria-label={title}>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <p className="hg-card__meta">{copy.activityEmpty}</p>
      ) : (
        <div className="hg-list">
          {items.map((a) => {
            const text = activityText(a, partner);
            return (
              <ListRow
                key={`${a.kind}-${a.ref}`}
                label={masked ? maskMoney(text) : text}
                sub={notiTime(a.at)}
                onClick={() => onOpen(a.target)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
