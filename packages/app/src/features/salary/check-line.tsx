import type { PayCheckLine } from '@sweetwo/api';
import { formatDot2, todayKst } from '@sweetwo/core';
import { BottomSheet, Button, Lead, leadOf, TransferRow } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { money, useMask } from '../../shared/mask';
import { quietly, toast } from '../../shared/toast';
import { copy } from './copy';
import { useCheck, type CheckEntry, type CheckResult } from './data';
import { useSavingItems } from './saving';

const LINE_NAMES = { fixed: '고정지출', living: '생활비', allowance: '용돈' } as const;

/**
 * 줄 앞 칸(홈 H-03, W-02, W-05 같음, 2026-11-09): 종류 아이콘 + 영역 색 원(ui lead-kinds.ts ‘line’ 표).
 * 목표 금액이 있는 저금 줄은 아이콘 대신 진행 원(모은 금액 ÷ 목표 금액, 줄 아래 막대 대신). 장식이라 화면 읽기에서 숨김
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
  // v2.2 새 줄(보내기, 같이 쓰는 통장)은 화면 PR 전까지 저장된 이름만
  if (l.kind === 'send' || l.kind === 'shared_account') return l.name ?? '';
  return LINE_NAMES[l.kind];
}

const amountOf = (l: PayCheckLine) => l.actual ?? l.planned;

/**
 * 체크가 끝난 뒤 Toast(20 W-02 4·5번, 2026-11-12): 체크리스트가 이번에 끝났으면 그 하나만 “{월}월 월급 체크를 다 했어요”
 * (‘못 함’이 섞이면 “…마쳤어요”), 아니면 줄 Toast(저금 “{이름}에 {금액} 더했어요”, 지출 “체크했어요”, 못 함 “{이름}, 이번 달은 못 한 걸로 했어요”).
 * 모두 ‘되돌리기’ = 이 줄을 바꾸기 전 상태로
 */
export function checkToast(
  res: CheckResult,
  o: {
    line: PayCheckLine;
    name: string;
    goalName?: string;
    amount: string;
    to: 'checked' | 'skipped';
    personName: (id: string | null) => string | null;
    undo: () => void;
  },
) {
  if (res.r === 'already_checked')
    return toast(copy.alreadyChecked(o.personName(o.line.checked_by) ?? ''));
  if (res.r === 'closed') return toast(copy.closed);
  const undo = { label: copy.undo, onClick: o.undo };
  if (res.finish) return toast(copy.monthFinished(res.finish.start, res.finish.kind), undo);
  if (o.to === 'skipped') return toast(copy.skippedDone(o.name), undo);
  toast(
    o.line.kind === 'saving' ? copy.addedToGoal(o.goalName ?? o.name, o.amount) : copy.checked,
    undo,
  );
}

/**
 * 체크리스트 줄 하나(W-02, W-05, W-10). 디자인 시스템 TransferRow(체크 칸 + 이름 + 금액).
 * 체크 = 바로 완료, 저금이면 저금 항목 모은 금액에 더하고 Toast + 되돌리기. 다시 누르면 풀림.
 * ‘못 함’ 줄(2026-11-12 D2)은 빈 원·취소선 없음 + 보조 줄 “이번 달은 못 했어요”, 화면 읽기 “{이름} 못 함”. 체크 칸을 누르면 체크.
 * 줄(이름·금액)을 누르면 시트: ‘보냈어요’(체크) + ‘다른 금액으로 보냈어요’(W-02a) + W-05는 ‘이번 달은 못 했어요’
 * + 저금 줄은 글자 버튼 ‘저금 보기’(W-10, 체크한 줄도). 줄마다 링크를 반복하지 않음(2026-11-03).
 * 목표 금액이 있는 저금 줄은 보조 줄에 “2,700만 / 1억 5,000만 원”(progress), 진행은 줄 앞 진행 원(LineLead).
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
  entry = 'w02',
  changed = false,
  auto,
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
  /** 시트 ‘다른 금액으로 보냈어요’(W-02a) */
  onOther?: () => void;
  /** W-05 ‘이번 달은 못 했어요’ */
  onSkip?: () => void;
  /** 저금 줄 시트 ‘저금 보기’(W-10) */
  onItem?: () => void;
  /** 저금 줄 진행 글자(목표 금액이 있을 때, 체크한 사람·때 자리) */
  progress?: ReactNode;
  /** 줄 앞 아이콘(홈) */
  lead?: ReactNode;
  /** 분석 checklist_line_checked entry */
  entry?: CheckEntry;
  /** 상대가 방금 바꿈(2초 강조) */
  changed?: boolean;
  /** 자동 줄 알약 글자(2026-11-13 W-02 2번 “26일 자동”, “자동 확인”) */
  auto?: string;
}) {
  const { masked } = useMask();
  const check = useCheck(entry);
  const [sheet, setSheet] = useState(false);
  // 저장하는 동안(2026-11-06): 누른 쪽 모양을 바로 보여 주고 두 번 누르기를 막음. 실패하면 원래대로
  const [pending, setPending] = useState<'checked' | 'wait' | null>(null);
  const done = line.state === 'checked';
  const skipped = line.state === 'skipped';
  const amount = money(amountOf(line), masked);

  // 체크 칸: 체크한 줄은 풂, 체크 안 한 줄과 ‘못 함’ 줄은 체크(2026-11-12 D2)
  const toggle = async () => {
    if (pending) return;
    const to = done ? 'wait' : 'checked';
    const from = line.state as 'checked' | 'wait' | 'skipped';
    setPending(to);
    try {
      const res = await check(line, to);
      if (to === 'wait' && res.r === 'ok') return;
      checkToast(res, {
        line,
        name,
        goalName,
        amount: money(line.planned, masked),
        to: 'checked',
        personName,
        undo: () => quietly(check(line, from, undefined, 'toast')),
      });
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void toggle() });
    } finally {
      setPending(null);
    }
  };
  const shownDone = pending ? pending === 'checked' : done;

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
  // ‘못 함’은 목표 금액 진행 글자보다 먼저(체크 안 한 줄처럼 보이므로 이유를 보여 줌)
  const meta = skipped ? checkMeta : (progress ?? checkMeta);
  // 자동 줄은 자동 확인된 뒤에도 시트에서 건너뜀·다른 금액으로 바꿈(20 W-02 5번, 2026-11-13)
  const open = (!done || !!line.auto) && !readOnly && !viewOnly;
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
        checkLabel={
          viewOnly
            ? copy.viewLabel(name, line.state)
            : skipped && !pending
              ? copy.skippedLabel(name)
              : copy.checkLabel(name)
        }
        onToggle={readOnly || viewOnly ? undefined : () => void toggle()}
        disabled={readOnly}
        viewOnly={viewOnly}
        meta={meta}
        lead={lead}
        changed={changed}
        auto={auto}
        onOpen={canSheet ? () => setSheet(true) : undefined}
      />
      {sheet && (
        <BottomSheet
          title={copy.lineSheet(name, amount)}
          onClose={() => setSheet(false)}
          actions={
            <>
              {open && !done && (
                <Button block variant="primary" onClick={pick(() => void toggle())}>
                  {copy.sent}
                </Button>
              )}
              {open && onOther && (
                <Button block variant="secondary" onClick={pick(onOther)}>
                  {copy.otherAmount}
                </Button>
              )}
              {open && !skipped && onSkip && (
                <Button block variant="secondary" onClick={pick(onSkip)}>
                  {copy.skipThis}
                </Button>
              )}
              {/* 저금 보기는 글자 버튼(2026-11-12 S6-15, 20 W-02 6번) */}
              {onItem && (
                <Button block variant="link" onClick={pick(onItem)}>
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
