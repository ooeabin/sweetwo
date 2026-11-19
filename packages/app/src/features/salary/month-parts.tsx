import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import {
  checkCells,
  checkHeadline,
  checklistFinish,
  confirmFinish,
  formatMonthDay,
  manualCount,
  monthProgress,
  type MonthProgress,
} from '@sweetwo/core';
import { SectionHeader, StepBar } from '@sweetwo/ui';
import { useState, type ReactNode } from 'react';
import { track } from '../../shared/analytics';
import { money } from '../../shared/mask';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { shareReceipt, type ReceiptImageModel } from './receipt-image';

// W-01 ↔ W-02 잇기(docs/spec/20-salary-plan.md W-02 1번, 2026-11-09).
// MonthBar: W-02 머리 진행 막대 하나(확인한 줄 수 ÷ 줄 수, 2026-11-15 3차 검토: 범례 없는 3색 막대 대신) + “확인한 금액 142만 원 / 342만 원”.
// 다 끝난 달은 그 아래 굵은 한 줄 + ‘공유하기’(2026-11-12 W-02 끝 화면과 달 결과 카드 1b 대신, 사용자 결정 A)

type Person = { id: string; nickname: string | null; monthly_income: number | null };

/** 체크리스트 주인의 수입(각자 = 그 사람 실수령, 합쳐서 = 두 사람 합). 지금 프로필 값 */
export function incomeOf(owner: string | null, me: Person, partner: Person | null | undefined) {
  if (owner === null) return (me.monthly_income ?? 0) + (partner?.monthly_income ?? 0);
  const who = owner === me.id ? me : partner;
  return who?.monthly_income ?? 0;
}

const partsOf = (p: MonthProgress) => [
  { kind: 'saving' as const, percent: p.ratio.saving, fill: p.fill.saving },
  { kind: 'spend' as const, percent: p.ratio.spend, fill: p.fill.spend },
  { kind: 'free' as const, percent: p.ratio.free ?? 0 },
];

/** 공유 이미지 재료(달 결과, W-01과 같은 canvas) */
export type MonthShare = {
  /** 받은 날(기간 시작, 영업일 당김 반영) */
  received: string;
  people: { id: string; name: string; starter: boolean }[];
  nameOf: (l: PayCheckLine) => string;
  whose: 'self' | 'partner' | 'joint';
  screen: 'checklist' | 'past';
};

/**
 * W-02 상단 묶음(2026-11-19, 카드 없이 바탕 위): 작은 회색 줄 “11월 25일 월급” + 오른쪽 ‹ ›(`nav`), 큰 숫자 한 줄
 * (월급날 전 “D-6”, 확인 중 “3개 남음”, 다 확인 “확인 끝”, core `checkHeadline`), 칸 나눔 진행 막대(`StepBar`, core `checkCells`).
 * 월급날 전(미리 보기, `preview`)은 막대 없음. 없앤 문장(“계획한 … 중 … 확인했어요”, 기간, 날짜 제목)은 화면 읽기 이름에만 남김.
 * 다 끝났으면(`확인 끝`) 큰 숫자 줄 오른쪽에 ‘공유하기’(달 결과 이미지) 글자 버튼
 */
export function MonthBar({
  list,
  income,
  masked,
  share,
  shownStart,
  headlineLines,
  nav,
  lateOpen = 0,
  period,
}: {
  list: PayChecklist;
  income: number;
  masked: boolean;
  /** ‘공유하기’ 재료 */
  share?: MonthShare;
  /** 보여 줄 월급날(앞당기기, useShownPayday). 없으면 사이클 첫날 */
  shownStart?: string;
  /** 큰 숫자를 셀 줄(한 사람 관리형이면 내가 맡은 줄만). 없으면 모든 줄 */
  headlineLines?: PayCheckLine[];
  /** 오른쪽 ‹ › */
  nav?: ReactNode;
  /** 지금 늦게 확인할 수 있는 손 줄 수. 있으면 공유를 띄우지 않음(2026-11-13 UX B M2) */
  lateOpen?: number;
  /** 화면 읽기용 기간 “09.25 ~ 10.24” */
  period: string;
}) {
  const p = monthProgress({ income, lines: list.pay_check_line });
  const head = checkHeadline({ lines: headlineLines ?? list.pay_check_line });
  const cells = checkCells(list.pay_check_line);
  const finish =
    lateOpen > 0
      ? null
      : manualCount(list.pay_check_line) > 0
        ? confirmFinish(list.pay_check_line)
        : checklistFinish(list.pay_check_line);
  const [sharing, setSharing] = useState(false);
  const run = async () => {
    if (sharing || !share) return;
    setSharing(true);
    const props = { masked, whose: share.whose, screen: share.screen, skipped: p.done - p.checked };
    try {
      const r = await shareReceipt(
        monthImage(list, income, masked, share, p),
        copy.monthImageName(list.cycle_start.slice(0, 7)),
      );
      track('month_result_shared', { result: r, ...props });
      if (r === 'downloaded') toast(copy.imageSaved);
    } catch {
      track('month_result_shared', { result: 'failed', ...props });
      toast(copy.failed);
    } finally {
      setSharing(false);
    }
  };
  const name = copy.cycleOf(shownStart ?? list.cycle_start);
  return (
    <section
      className="hg-stack"
      style={{ gap: 'var(--space-2)' }}
      aria-label={copy.topLabel(name, period, money(p.sent, masked), money(p.planned, masked))}
    >
      <div className="hg-row" style={{ flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <p className="hg-card__meta" style={{ margin: 0 }}>
          {name}
        </p>
        {nav}
      </div>
      <SectionHeader
        title={head.text}
        action={
          head.kind === 'done' && finish && share ? (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              aria-busy={sharing || undefined}
              onClick={() => void run()}
            >
              {copy.share}
            </button>
          ) : undefined
        }
      />
      <StepBar
        total={cells.total}
        filled={cells.filled}
        segmented={cells.segmented}
        label={copy.stepLabel(cells.total, cells.filled)}
      />
    </section>
  );
}

/** 월급날 전(미리 보기) 상단: 회색 줄 + “D-6”. 막대 없음 */
export function PreviewTop({ name, headline }: { name: string; headline: string }) {
  return (
    <section
      className="hg-stack"
      style={{ gap: 'var(--space-2)' }}
      aria-label={`${name}, ${copy.dayLabel(headline)}`}
    >
      <p className="hg-card__meta" style={{ margin: 0 }}>
        {name}
      </p>
      <SectionHeader title={headline} />
    </section>
  );
}

/**
 * 달 결과 공유 이미지(W-01 영수증과 같은 canvas): 머리 = 달 이름 + 수입 + “10월 25일 받음”, 진행 막대,
 * 저금·지출 묶음(실제 보낸 금액, 다른 금액이면 “계획 80만 원”, ‘못 함’은 “못 함”이고 합에서 뺌), 합계 ‘체크한 금액’ + ‘여유 자금’
 */
function monthImage(
  list: PayChecklist,
  income: number,
  masked: boolean,
  share: MonthShare,
  p: MonthProgress,
): ReceiptImageModel {
  const won = (v: number) => money(v, masked);
  const rowOf = (l: PayCheckLine) => {
    const name = share.nameOf(l);
    if (l.state !== 'checked') return { name, amount: copy.skippedShort, muted: true };
    const sent = l.actual ?? l.planned;
    return {
      name,
      amount: won(sent),
      sub: sent !== l.planned ? copy.planned(won(l.planned)) : undefined,
    };
  };
  const sections = [
    {
      title: copy.savingGroup,
      subtotal: won(p.savingSent),
      ls: list.pay_check_line.filter((l) => l.kind === 'saving'),
    },
    {
      title: copy.spendGroup,
      subtotal: won(p.spendSent),
      ls: list.pay_check_line.filter((l) => l.kind !== 'saving'),
    },
  ].filter((x) => x.ls.length > 0);
  return {
    people: share.people.map((x) => ({ no: x.starter ? 1 : 2, name: x.name })),
    title: copy.cycleOf(list.cycle_start),
    amount: won(income),
    sub: copy.received(formatMonthDay(share.received)),
    bar: partsOf(p),
    progress: true,
    legend: [],
    sections: sections.map((x) => ({
      title: x.title,
      subtotal: x.subtotal,
      rows: x.ls.map(rowOf),
    })),
    totals: [
      { label: copy.sentTotal, amount: won(p.sent) },
      p.left >= 0
        ? { label: copy.leftoverLabel, amount: won(p.left), strong: true }
        : {
            label: copy.leftoverLabel,
            amount: copy.short(won(-p.left)),
            strong: true,
            short: true,
          },
    ],
  };
}
