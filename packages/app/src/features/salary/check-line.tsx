import type { PayCheckLine } from '@sweetwo/api';
import { formatMonthDay, todayKst } from '@sweetwo/core';
import { TransferRow } from '@sweetwo/ui';
import { money, useMask } from '../../shared/mask';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useCheck } from './data';

const LINE_NAMES = { fixed: '고정지출', living: '생활비', allowance: '용돈' } as const;

/**
 * 저금 줄 목표 이름. 합쳐서 모드에서 내 목표 줄은 앞에 주인 이름(“찬우 자기계발”, 20 W-01 3번).
 * 배우자 내 목표가 ‘금액만 보여 주기’면 서버가 이미 “개인 목표”로 줌(space_goals)
 */
export const goalLineName =
  (
    goals: { id: string; name: string; owner_user_id: string | null }[],
    personName: (id: string | null) => string | null,
    joint: boolean,
  ) =>
  (id: string | null | undefined) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return '';
    return joint && g.owner_user_id
      ? `${personName(g.owner_user_id) ?? ''} ${g.name}`.trim()
      : g.name;
  };

/** 줄 이름: 저금은 목표 이름, 용돈은 “{이름} 용돈”(합쳐서), 직접 추가 줄은 그 이름 */
export function lineName(
  l: Pick<PayCheckLine, 'kind' | 'goal_id' | 'user_id' | 'name'>,
  goalName: (id: string | null) => string,
  personName: (id: string | null) => string | null,
  joint = false,
) {
  if (l.kind === 'saving') return goalName(l.goal_id);
  if (l.kind === 'custom') return l.name ?? '';
  if (l.kind === 'allowance' && joint)
    return `${personName(l.user_id) ?? ''} ${LINE_NAMES.allowance}`;
  return LINE_NAMES[l.kind];
}

const amountOf = (l: PayCheckLine) => l.actual ?? l.planned;

/**
 * 체크리스트 줄 하나(W-02, H-03, W-05). 디자인 시스템 TransferRow(체크 칸 + 이름 + 금액).
 * 체크 = 바로 완료, 저금이면 목표에 더하고 Toast “{목표}에 {금액} 더했어요” + 되돌리기. 다시 누르면 풀림.
 */
export function CheckLine({
  line,
  name,
  personName,
  meId,
  readOnly,
  onOther,
  onSkip,
}: {
  line: PayCheckLine;
  name: string;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  /** 지난 사이클(읽기 전용) */
  readOnly?: boolean;
  /** ⋯ 다른 금액(W-02a) */
  onOther?: () => void;
  /** W-05 ‘이번 달은 못 했어요’ */
  onSkip?: () => void;
}) {
  const { masked } = useMask();
  const check = useCheck();
  const done = line.state === 'checked';
  const skipped = line.state === 'skipped';
  const amount = money(amountOf(line), masked);

  const toggle = async () => {
    try {
      const r = await check(line, done || skipped ? 'wait' : 'checked');
      if (r === 'already_checked')
        return toast(copy.alreadyChecked(personName(line.checked_by) ?? ''));
      if (r === 'closed') return toast(copy.closed);
      if (r === 'queued') return; // 오프라인: “연결되면 자동으로 저장돼요”는 이미 띄움
      if (done || skipped) return;
      const undo = { label: copy.undo, onClick: () => void check(line, 'wait') };
      toast(line.kind === 'saving' ? copy.addedToGoal(name, amount) : copy.checked, undo);
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void toggle() });
    }
  };

  const when = line.checked_at ? formatMonthDay(line.checked_at.slice(0, 10)) : null;
  const meta = skipped
    ? copy.skipped
    : done && when
      ? line.checked_by && line.checked_by !== meId
        ? copy.checkedBy(personName(line.checked_by) ?? '', when)
        : copy.checkedOn(when)
      : undefined;
  const open = !done && !skipped && !readOnly;
  return (
    <TransferRow
      label={name}
      amount={amount}
      done={done || skipped}
      checkLabel={copy.checkLabel(name)}
      onToggle={readOnly ? undefined : () => void toggle()}
      disabled={readOnly}
      meta={meta}
      actions={
        open && (onOther || onSkip) ? (
          <>
            {onOther && (
              <button type="button" className="hg-btn hg-btn--link" onClick={onOther}>
                {copy.otherAmount}
              </button>
            )}
            {onSkip && (
              <button type="button" className="hg-btn hg-btn--link" onClick={onSkip}>
                {copy.skipped}
              </button>
            )}
          </>
        ) : undefined
      }
    />
  );
}

/** 오늘 기준 사이클 기간 “10.25 ~ 11.24” */
export const periodText = (start: string, end: string) =>
  copy.period(start.slice(5).replace('-', '.'), end.slice(5).replace('-', '.'));
export const isPast = (end: string) => end < todayKst();
