import { fetchMoneyIns, qk } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { ListRow, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { money } from '../../shared/mask';
import { speakMasked } from '../../shared/masked-text';
import { copy } from './copy';

/**
 * W-02 ‘받은 돈’ 묶음(20 W-20 고친 점, 2026-11-16 4차 검토 R4-7): 이번 달(from~to, KST 받은 날)에 내가 적은 받은 돈 기록.
 * 줄 = 종류 + 받은 날, 오른쪽 금액. 누르면 W-20b 받은 돈 기록(고치기·지우기). 기록이 없으면 아무것도 그리지 않음
 */
export function MoneyInRows({
  meId,
  from,
  to,
  masked,
  onOpen,
}: {
  meId: string;
  from: string;
  to: string;
  masked: boolean;
  onOpen: () => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const rows = (ins.data ?? []).filter(
    (r) => r.owner_user_id === meId && r.received_on >= from && r.received_on <= to,
  );
  if (!rows.length) return null;
  return (
    <section className="hg-checkgroup" aria-label={copy.moneyInGroup}>
      <SectionHeader variant="group" title={copy.moneyInGroup} />
      <div className="hg-list hg-list--plain">
        {rows.map((r) => (
          <ListRow
            key={r.id}
            label={copy.moneyInKinds[r.kind]}
            sub={formatMonthDay(r.received_on)}
            value={speakMasked(money(r.amount, masked))}
            onClick={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
