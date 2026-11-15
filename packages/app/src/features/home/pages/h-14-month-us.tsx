import { dismissMonthUs, qk } from '@sweetwo/api';
import { formatMonthDay, monthUsSaving, type MonthUsCard } from '@sweetwo/core';
import { IconButton, ListRow } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';

/**
 * H-14 이번 달 우리 둘(19, 3차 검토 D3, 2026-11-15): 매달 한 번(월급날 다음 날, 날짜 없으면 1일) 서버가 만든 카드
 * (month_us_card, 보낸 지 14일 안, 닫지 않음). 각자 계열 두 사람, 한 사람 관리형의 관리하지 않는 쪽만.
 * 줄 셋: 모은 금액(처음은 지금까지 합, 그 뒤 지난 카드보다 +/−, ‘했어요만’ 공개면 개수만, core monthUsSaving)
 * → W-13, 다가올 경조사·기념일(30일 안) → Y-01, 내 용돈(있을 때만) → W-01. 오른쪽 위 닫기 ✕
 */
export function H14MonthUs({
  card,
  money,
  go,
}: {
  card: NonNullable<MonthUsCard>;
  money: (v: number) => string;
  go: (to: string) => void;
}) {
  const qc = useQueryClient();
  const saving = monthUsSaving(card);
  const seen = useRef('');
  useEffect(() => {
    if (seen.current === card.id) return;
    seen.current = card.id;
    track('month_us_viewed', { saving: saving.kind, care_count: card.care_count });
  }, [card.id, card.care_count, saving.kind]);

  let savingText: string | undefined;
  switch (saving.kind) {
    case 'hidden':
      savingText = copy.monthUsHidden(saving.count);
      break;
    case 'first':
      savingText = copy.monthUsFirst(money(saving.total));
      break;
    case 'up':
      savingText = copy.monthUsUp(money(saving.amount));
      break;
    case 'down':
      savingText = copy.monthUsDown(money(saving.amount));
      break;
    case 'same':
      savingText = copy.monthUsSame;
      break;
  }
  const first = card.care[0];
  const firstText = first ? copy.monthUsCareOne(first.name, formatMonthDay(first.on)) : '';
  const careText = !first
    ? copy.monthUsCareNone
    : card.care_count > 1
      ? copy.monthUsCareMore(firstText, card.care_count - 1)
      : firstText;

  return (
    <section className="hg-card hg-card--fill hg-stack hg-hub__wide" aria-label={copy.monthUsTitle}>
      <div className="hg-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="hg-card__title">{copy.monthUsTitle}</h2>
        <IconButton
          icon="x"
          label={copy.monthUsClose}
          ghost
          onClick={() => {
            track('month_us_dismissed', {});
            void dismissMonthUs(card.id)
              .catch(() => undefined)
              .finally(() => void qc.invalidateQueries({ queryKey: qk.monthUs }));
            qc.setQueryData(qk.monthUs, null);
          }}
        />
      </div>
      <div>
        {savingText && (
          <ListRow
            label={copy.monthUsSaving}
            value={savingText}
            onClick={() => go('/salary/items?from=home')}
          />
        )}
        <ListRow label={copy.monthUsCare} value={careText} onClick={() => go('/calendar')} />
        {card.allowance !== null && (
          <ListRow
            label={copy.monthUsAllowance}
            value={money(card.allowance)}
            onClick={() => go('/salary?view=plan')}
          />
        )}
      </div>
    </section>
  );
}
