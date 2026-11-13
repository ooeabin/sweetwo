import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import {
  checklistFinish,
  confirmFinish,
  formatMonthDay,
  manualCount,
  monthProgress,
  type MonthProgress,
} from '@sweetwo/core';
import { PlanBar } from '@sweetwo/ui';
import { useState } from 'react';
import { track } from '../../shared/analytics';
import { money } from '../../shared/mask';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { shareReceipt, type ReceiptImageModel } from './receipt-image';

// W-01 ↔ W-02 잇기(docs/spec/20-salary-plan.md W-02 1번, 2026-11-09).
// MonthBar: W-02 머리 진행 막대(W-01과 같은 PlanBar, 보낸 만큼 채움) + “체크한 금액 142만 원 / 342만 원”.
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
 * W-02 머리 진행 막대. 화면 읽기는 막대 이름 “5개 중 2개 완료”(다 하면 “다 보냈어요”) + 아래 한 줄 “체크한 금액 …”.
 * 다 끝난 달(모든 줄이 체크 또는 ‘못 함’, 지난 달 포함, 2026-11-12 W-02 끝 화면 대신): 막대 아래 굵은 한 줄
 * “10월 월급 체크를 다 했어요”(‘못 함’이 섞이면 “…마쳤어요”) + 체크한 금액, 오른쪽 ‘공유하기’(달 결과 이미지)
 */
export function MonthBar({
  list,
  income,
  masked,
  share,
}: {
  list: PayChecklist;
  income: number;
  masked: boolean;
  /** 다 끝난 달 한 줄의 ‘공유하기’ 재료 */
  share?: MonthShare;
}) {
  const p = monthProgress({ income, lines: list.pay_check_line });
  // 확인 끝(07 7장, 2026-11-13): 손 줄이 있으면 손 줄만, 자동 줄뿐이면 모두 확인됐을 때
  const finish =
    manualCount(list.pay_check_line) > 0
      ? confirmFinish(list.pay_check_line)
      : checklistFinish(list.pay_check_line);
  const [sharing, setSharing] = useState(false);
  const caption = copy.sentOfPlan(money(p.sent, masked), money(p.planned, masked));
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
  return (
    <PlanBar
      flat
      progress
      label={p.complete ? copy.allDone : copy.progress(p.total, p.done)}
      parts={partsOf(p)}
      title={finish ? copy.monthFinished(list.cycle_start, finish) : undefined}
      caption={caption}
      action={
        finish && share ? (
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
    people: share.people.map((x) => (x.starter ? 1 : 2)),
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
