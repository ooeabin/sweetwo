import type { PayCheckLine } from '@sweetwo/api';
import { defaultGoalPreset, formatDot2, todayKst } from '@sweetwo/core';
import {
  BottomSheet,
  Button,
  goalIcon,
  goalPhotoArt,
  icon3d,
  type IconName,
  Lead,
  TransferRow,
} from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { money, useMask } from '../../shared/mask';
import { usePhotoUrls } from '../../shared/photo';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { useCheck } from './data';

const LINE_NAMES = { fixed: '고정지출', living: '생활비', allowance: '용돈' } as const;

/** 쓰는 돈 줄 아이콘(홈 체크리스트, W-02, W-05 같음) */
const LINE_ICON = {
  fixed: 'calendar-check',
  living: 'shopping-bag',
  allowance: 'coins',
  custom: 'wallet',
} as const satisfies Record<string, IconName>;

/** 쓰는 돈 줄 3D 아이콘(2026-11-05, Illustrations D): 파일이 없으면 위 Phosphor 아이콘 */
const LINE_ART = {
  fixed: 'line-fixed',
  living: 'line-living',
  allowance: 'line-allowance',
  custom: 'line-custom',
} as const;

/** 줄 앞 아이콘(2026-11-03): 저금은 그 목표 사진(올린 사진 → 종류 지정 사진 → 목표 아이콘), 쓰는 돈은 종류 3D 아이콘(2026-11-05) */
export function LineLead({
  line,
  goalOf,
}: {
  line: Pick<PayCheckLine, 'kind' | 'goal_id'>;
  /** 저금 줄의 목표(종류, 올린 사진 경로) */
  goalOf: (id: string | null) => { template: string; photo_path: string | null } | null;
}) {
  const g = line.kind === 'saving' ? goalOf(line.goal_id) : null;
  // 올린 사진(서명 주소) → 그 종류 지정 사진 → 목표 아이콘(2026-11-05)
  const uploaded = usePhotoUrls([g?.photo_path])[g?.photo_path ?? ''];
  if (line.kind === 'saving') {
    const t = g?.template ?? 'custom';
    return <Lead icon={goalIcon(t)} photo={uploaded ?? goalPhotoArt(defaultGoalPreset(t))} />;
  }
  const k = line.kind as keyof typeof LINE_ICON;
  return <Lead icon={LINE_ICON[k]} art3d={icon3d(LINE_ART[k])} />;
}

/**
 * 저금 줄 목표 이름. 합쳐서 모드에서 내 목표 줄은 앞에 주인 이름(“찬우 자기계발”, 20 W-01 3번).
 * 파트너 내 목표가 ‘금액만 보여 주기’면 서버가 이미 “개인 목표”로 줌(space_goals)
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
 * 줄(이름·금액)을 누르면 시트: ‘보냈어요’(체크) + ‘다른 금액으로 보냈어요’(W-02) / ‘이번 달은 못 했어요’(W-05).
 * 줄마다 링크를 반복하지 않음(2026-11-03).
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
  lead,
}: {
  line: PayCheckLine;
  name: string;
  /** 토스트 “{목표}에 {금액} 더했어요”의 목표 이름(줄 글자가 목표 이름이 아닌 곳: 홈 큰 카드, 목표 상세) */
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
  /** 줄 앞 아이콘(홈) */
  lead?: ReactNode;
}) {
  const { masked } = useMask();
  const check = useCheck();
  const [sheet, setSheet] = useState(false);
  const done = line.state === 'checked';
  const skipped = line.state === 'skipped';
  const amount = money(amountOf(line), masked);

  const toggle = async () => {
    try {
      const r = await check(line, done || skipped ? 'wait' : 'checked');
      if (r === 'already_checked')
        return toast(copy.alreadyChecked(personName(line.checked_by) ?? ''));
      if (r === 'closed') return toast(copy.closed);
      if (done || skipped) return;
      const undo = { label: copy.undo, onClick: () => void check(line, 'wait') };
      toast(
        line.kind === 'saving' ? copy.addedToGoal(goalName ?? name, amount) : copy.checked,
        undo,
      );
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void toggle() });
    }
  };

  const when = line.checked_at ? formatDot2(line.checked_at.slice(0, 10)) : null;
  const meta = skipped ? (
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
  const open = !done && !skipped && !readOnly && !viewOnly;
  const pick = (f: () => void) => () => {
    setSheet(false);
    f();
  };
  return (
    <>
      <TransferRow
        label={name}
        amount={amount}
        done={done || skipped}
        checkLabel={viewOnly ? copy.viewLabel(name, done || skipped) : copy.checkLabel(name)}
        onToggle={readOnly || viewOnly ? undefined : () => void toggle()}
        disabled={readOnly}
        viewOnly={viewOnly}
        meta={meta}
        lead={lead}
        onOpen={open && (onOther || onSkip) ? () => setSheet(true) : undefined}
      />
      {sheet && (
        <BottomSheet
          title={copy.lineSheet(name, amount)}
          onClose={() => setSheet(false)}
          actions={
            <>
              <Button block variant="primary" onClick={pick(() => void toggle())}>
                {copy.sent}
              </Button>
              {onOther && (
                <Button block variant="secondary" onClick={pick(onOther)}>
                  {copy.otherAmount}
                </Button>
              )}
              {onSkip && (
                <Button block variant="secondary" onClick={pick(onSkip)}>
                  {copy.skipped}
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
