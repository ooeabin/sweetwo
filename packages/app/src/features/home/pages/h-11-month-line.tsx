import type { HomeMonthLine } from '@sweetwo/core';
import { HubLine } from '@sweetwo/ui';
import { spoken } from '../../../shared/masked-text';
import { sharedCopy } from '../../../shared/copy';
import { PeriodLine } from '../../salary';
import { copy } from '../copy';

/**
 * H-11 이번 달 한 줄(19 ‘H-11 상태’, core pickMonthLine). 날짜 없는 사람은 H-13 기간 한 줄(salary PeriodLine).
 * 늦은 확인이 있으면 문장 아래 회색 “지난 달 n개 늦게 확인할 수 있어요” + “확인하기 ›”. 못 불러오면 13 공통 7번 카드
 */
export function H11MonthLine({
  line,
  go,
  onRetry,
}: {
  line: HomeMonthLine;
  go: (to: string) => void;
  onRetry: () => void;
}) {
  if (line.kind === 'error')
    return (
      <section className="hg-card hg-card--fill hg-stack hg-hub__wide" role="status">
        <p className="hg-card__title">{sharedCopy.errorTitle}</p>
        <p className="hg-card__meta">{sharedCopy.errorBody}</p>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={onRetry}
        >
          {sharedCopy.retry}
        </button>
      </section>
    );
  if (line.kind === 'period') return <PeriodLine period={line.period} onGo={() => go(line.to)} />;

  let text: string;
  let sub: string | undefined;
  let goText: string | undefined;
  const late = 'late' in line && line.late > 0 ? copy.lateLeft(line.late) : undefined;
  switch (line.kind) {
    case 'no_salary':
      text = copy.noSalary;
      goText = copy.goSalary;
      break;
    case 'non_manager':
      text = copy.nonManager;
      break;
    case 'first':
      text = line.date ? copy.monthFirst(line.date) : copy.monthFirstNoDate;
      break;
    case 'review':
      text = copy.monthReview(line.cycleStart, line.left);
      sub = late;
      goText = copy.goCheck;
      break;
    case 'payday':
      text = copy.monthPayday(line.left);
      sub = late;
      goText = copy.goCheck;
      break;
    case 'auto_only':
      text = copy.monthAutoOnly;
      sub =
        late ??
        (line.next
          ? copy.autoNext(Number(line.next.date.slice(8, 10)), line.next.count)
          : undefined);
      goText = late ? copy.goCheck : copy.goView;
      break;
    case 'done':
      text = copy.monthDone(line.cycleStart, line.finish);
      sub = late ?? copy.untilNext(line.daysLeft);
      goText = late ? copy.goCheck : copy.goView;
      break;
  }
  return (
    <HubLine
      text={text}
      sub={sub}
      go={goText}
      label={spoken([text, sub, goText].filter(Boolean).join(', '))}
      onClick={() => go(line.to)}
    />
  );
}
