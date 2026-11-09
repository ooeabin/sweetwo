import type { PayCheckLine } from '@sweetwo/api';
import { formatDot2, todayKst } from '@sweetwo/core';
import { BottomSheet, Button, Lead, leadOf, TransferRow } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { money, useMask } from '../../shared/mask';
import { quietly, toast } from '../../shared/toast';
import { copy } from './copy';
import { useCheck } from './data';
import { useSavingItems } from './saving';

const LINE_NAMES = { fixed: '고정지출', living: '생활비', allowance: '용돈' } as const;

/**
 * 줄 앞 칸(홈 H-03, W-02, W-05 같음, 2026-11-09): 종류 아이콘 + 영역 색 원(ui lead-kinds.ts ‘line’ 표).
 * 목표 금액이 있는 저금 줄은 아이콘 대신 진행 원(모은 돈 ÷ 목표 금액, 줄 아래 막대 대신). 장식이라 화면 읽기에서 숨김
 */
export function LineLead({ line }: { line: Pick<PayCheckLine, 'kind' | 'goal_id'> }) {
  const saving = useSavingItems();
  const item =
    line.kind === 'saving' && line.goal_id && saving.ready ? saving.byId(line.goal_id) : undefined;
  const spec = leadOf('line', line.kind);
  return item && item.target !== null ? (
    <Lead progress={item.bar} />
  ) : (
    <Lead icon={spec.icon} tone={spec.tone} />
  );
}

/**
 * 저금 줄 이름 = 저금 항목 이름. 합쳐서 모드에서 각자일 때 만든 항목 줄은 앞에 주인 이름(“찬우 적금”, 20 W-01 3번).
 * 파트너 저금 항목이 ‘금액만 보여 주기’면 서버가 이미 “개인 저금”으로 줌(space_goals)
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

/** 줄 이름: 저금은 저금 항목 이름, 용돈은 “{이름} 용돈”(합쳐서), 직접 추가 줄은 그 이름 */
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
 * 체크리스트 줄 하나(W-02, H-03, W-05, W-10). 디자인 시스템 TransferRow(체크 칸 + 이름 + 금액).
 * 체크 = 바로 완료, 저금이면 저금 항목 모은 돈에 더하고 Toast “{이름}에 {금액} 더했어요” + 되돌리기. 다시 누르면 풀림.
 * 줄(이름·금액)을 누르면 시트: ‘보냈어요’(체크) + ‘다른 금액으로 보냈어요’(W-02) / ‘이번 달은 못 했어요’(W-05)
 * + 저금 줄은 ‘저금 항목 보기’(W-10, 체크한 줄도). 줄마다 링크를 반복하지 않음(2026-11-03).
 * 목표 금액이 있는 저금 줄은 보조 줄에 “2,700만 / 1억 5,000만 원”(progress), 진행은 줄 앞 진행 원(LineLead, 2026-11-09 막대 없앰).
 */
export function CheckLine({
  line,
  name,
  goalName,
  personName,
  meId,
  readOnly,
  viewOnly = false,
  onOther,
  onSkip,
  onItem,
  progress,
  lead,
}: {
  line: PayCheckLine;
  name: string;
  /** 토스트 “{이름}에 {금액} 더했어요”의 저금 항목 이름(줄 글자가 이름이 아닌 곳: 저금 항목 상세) */
  goalName?: string;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  /** 지난 사이클(읽기 전용) */
  readOnly?: boolean;
  /** 파트너 줄 보기만(2026-11-03 대신 체크 없앰): 체크 칸 없이 상태만 */
  viewOnly?: boolean;
  /** ⋯ 다른 금액(W-02a) */
  onOther?: () => void;
  /** W-05 ‘이번 달은 못 했어요’ */
  onSkip?: () => void;
  /** 저금 줄 시트 ‘저금 항목 보기’(W-10) */
  onItem?: () => void;
  /** 저금 줄 진행 글자(목표 금액이 있을 때, 체크한 사람·때 자리) */
  progress?: ReactNode;
  /** 줄 앞 아이콘(홈) */
  lead?: ReactNode;
}) {
  const { masked } = useMask();
  const check = useCheck();
  const [sheet, setSheet] = useState(false);
  // 저장하는 동안(2026-11-06): 누른 쪽 모양을 바로 보여 주고 두 번 누르기를 막음. 실패하면 원래대로
  const [pending, setPending] = useState<'checked' | 'wait' | null>(null);
  const done = line.state === 'checked';
  const skipped = line.state === 'skipped';
  const amount = money(amountOf(line), masked);

  const toggle = async () => {
    if (pending) return;
    const to = done || skipped ? 'wait' : 'checked';
    setPending(to);
    try {
      const r = await check(line, to);
      if (r === 'already_checked')
        return toast(copy.alreadyChecked(personName(line.checked_by) ?? ''));
      if (r === 'closed') return toast(copy.closed);
      if (done || skipped) return;
      const undo = { label: copy.undo, onClick: () => quietly(check(line, 'wait')) };
      toast(
        line.kind === 'saving' ? copy.addedToGoal(goalName ?? name, amount) : copy.checked,
        undo,
      );
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void toggle() });
    } finally {
      setPending(null);
    }
  };
  const shownDone = pending ? pending === 'checked' : done || skipped;

  const when = line.checked_at ? formatDot2(line.checked_at.slice(0, 10)) : null;
  const checkMeta = skipped ? (
    copy.skipped
  ) : done && when ? (
    line.checked_by && line.checked_by !== meId ? (
      <>
        <span className="hg-transfer__who">{personName(line.checked_by) ?? ''}</span>
        {copy.checkedAt(when)}
      </>
    ) : (
      copy.checkedAt(when)
    )
  ) : undefined;
  const meta = progress ?? checkMeta;
  const open = !done && !skipped && !readOnly && !viewOnly;
  const canSheet = (open && (onOther || onSkip)) || !!onItem;
  const pick = (f: () => void) => () => {
    setSheet(false);
    f();
  };
  return (
    <>
      <TransferRow
        label={name}
        amount={amount}
        done={shownDone}
        busy={!!pending}
        checkLabel={viewOnly ? copy.viewLabel(name, done || skipped) : copy.checkLabel(name)}
        onToggle={readOnly || viewOnly ? undefined : () => void toggle()}
        disabled={readOnly}
        viewOnly={viewOnly}
        meta={meta}
        lead={lead}
        onOpen={canSheet ? () => setSheet(true) : undefined}
      />
      {sheet && (
        <BottomSheet
          title={copy.lineSheet(name, amount)}
          onClose={() => setSheet(false)}
          actions={
            <>
              {open && (
                <Button block variant="primary" onClick={pick(() => void toggle())}>
                  {copy.sent}
                </Button>
              )}
              {open && onOther && (
                <Button block variant="secondary" onClick={pick(onOther)}>
                  {copy.otherAmount}
                </Button>
              )}
              {open && onSkip && (
                <Button block variant="secondary" onClick={pick(onSkip)}>
                  {copy.skipped}
                </Button>
              )}
              {onItem && (
                <Button block variant="ghost" onClick={pick(onItem)}>
                  {copy.seeItem}
                </Button>
              )}
            </>
          }
        />
      )}
    </>
  );
}

/** 오늘 기준 사이클 기간 “10.25 ~ 11.24” */
export const periodText = (start: string, end: string) =>
  copy.period(start.slice(5).replace('-', '.'), end.slice(5).replace('-', '.'));
export const isPast = (end: string) => end < todayKst();
