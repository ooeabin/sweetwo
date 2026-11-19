import { fetchMoneyIns, qk } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { AddRow, ListRow, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { money } from '../../shared/mask';
import { speakMasked, spoken } from '../../shared/masked-text';
import { copy } from './copy';

/**
 * W-02 ‘수입’ 묶음(20 W-20 고친 점, 2026-11-16 4차 검토 R4-7): 이번 달(from~to, KST 받은 날)에 내가 적은 수입 기록.
 * 줄 = 종류 + 받은 날, 오른쪽 금액. 누르면 W-20b 수입 기록(고치기·지우기). 기록이 없으면 아무것도 그리지 않음(onAdd가 있으면 머리 + “+ 수입 적기”만)
 */
export function MoneyInRows({
  meId,
  from,
  to,
  masked,
  onOpen,
  onAdd,
}: {
  meId: string;
  from: string;
  to: string;
  masked: boolean;
  onOpen: () => void;
  /** 있으면 묶음 맨 아래 “+ 수입 적기”(기록이 없어도 묶음을 그림, W-02 2026-11-18) */
  onAdd?: () => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const rows = (ins.data ?? []).filter(
    (r) => r.owner_user_id === meId && r.received_on >= from && r.received_on <= to,
  );
  if (!rows.length && !onAdd) return null;
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
      {onAdd && <AddRow block label={copy.moneyIn} onClick={onAdd} />}
    </section>
  );
}

/**
 * W-02 수입 한 줄(2026-11-19): “수입” + 오른쪽 이번 달 수입 합(기록이 있으면, 누르면 W-20b) + “+ 적기”(W-20).
 * 기존 ‘수입’ 카드와 기록 줄 목록은 W-20b로 넘김
 */
export function MoneyInLine({
  meId,
  from,
  to,
  masked,
  onOpen,
  onAdd,
}: {
  meId: string;
  from: string;
  to: string;
  masked: boolean;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const rows = (ins.data ?? []).filter(
    (r) => r.owner_user_id === meId && r.received_on >= from && r.received_on <= to,
  );
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <section className="hg-sechead hg-sechead--group" aria-label={copy.incomeLine}>
      <h2 className="hg-sechead__title">{copy.incomeLine}</h2>
      <span className="hg-sechead__action" style={{ gap: 'var(--space-2)' }}>
        {rows.length > 0 && (
          <button
            type="button"
            className="hg-btn hg-btn--link"
            aria-label={spoken(copy.incomeSumLabel(money(sum, masked)))}
            onClick={onOpen}
          >
            {money(sum, masked)}
          </button>
        )}
        {onAdd && (
          <AddRow
            label={copy.incomeAdd}
            ariaLabel={copy.incomeAddLabel}
            className="hg-addrow--inline"
            onClick={onAdd}
          />
        )}
      </span>
    </section>
  );
}
