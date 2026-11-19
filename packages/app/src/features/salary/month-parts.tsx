import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import { formatMonthDay, monthProgress, type MonthProgress } from '@sweetwo/core';
import { useState, type CSSProperties, type ReactNode } from 'react';
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
 * W-02 ‘공유하기’ 글자 버튼(다 확인 상태, 달 결과 이미지, W-01 영수증 공유와 같은 canvas). 분석 `month_result_shared`
 */
export function ShareLink({
  list,
  income,
  masked,
  share,
}: {
  list: PayChecklist;
  income: number;
  masked: boolean;
  share: MonthShare;
}) {
  const p = monthProgress({ income, lines: list.pay_check_line });
  const [sharing, setSharing] = useState(false);
  const run = async () => {
    if (sharing) return;
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
    <button
      type="button"
      className="hg-btn hg-btn--link"
      aria-busy={sharing || undefined}
      onClick={() => void run()}
    >
      {copy.share}
    </button>
  );
}

/**
 * W-02 상단(2026-11-19 확정 시안, 카드 없이 바탕 위 가운데): 날짜 알약(`pill`) → 큰 금액(이번 사이클 계획 합, text-display) → 보조 한 줄
 * (월급날 전 “D-6, 5개”, 확인 중 “5개 중 2개 확인”). 다 확인 상태(`done`)는 알약 아래 그림 자리(`art`, 파일이 없으면 null = 숨김)
 * → 제목 → 흰 알약 “저축·투자 139만 원 모았어요”(`saved`, 없으면 숨김) → 공유하기, 화면 위 420px 축하 배경(`hg-w02done__bg`)
 */
export function MonthHero({
  pill,
  amount,
  meta,
  done,
}: {
  pill: ReactNode;
  amount?: string;
  meta?: string;
  done?: { title: string; saved?: ReactNode; art: ReactNode; extra?: ReactNode; burst?: boolean };
}) {
  return (
    <section className="hg-w02hero">
      {done && <div className="hg-w02done__bg hg-celebrate-bg" aria-hidden="true" />}
      {pill}
      {done ? (
        <>
          {done.art}
          <h2 className="hg-w02hero__title">{done.title}</h2>
          {done.saved && (
            <p className="hg-w02hero__saved">
              <span>{done.saved}</span>
            </p>
          )}
          {done.extra}
          {done.burst && <Confetti />}
        </>
      ) : (
        <>
          {amount && <p className="hg-w02hero__amt">{amount}</p>}
          {meta && <p className="hg-w02hero__meta">{meta}</p>}
        </>
      )}
    </section>
  );
}

const PIECES = [
  { l: '16%', x: '-60px', y: '90px', r: '-140deg', c: 'var(--accent-app)' },
  { l: '84%', x: '60px', y: '100px', r: '160deg', c: 'var(--brand-soft)' },
  { l: '28%', x: '-30px', y: '140px', r: '200deg', c: 'var(--ink)' },
  { l: '72%', x: '40px', y: '130px', r: '-190deg', c: 'var(--brand)' },
  { l: '40%', x: '-20px', y: '70px', r: '120deg', c: 'var(--brand-soft)' },
  { l: '60%', x: '30px', y: '80px', r: '-120deg', c: 'var(--accent-app)' },
];

/** 마지막 줄을 확인해 다 확인 상태가 된 순간 한 번 흩어지는 조각(‘동작 줄이기’면 CSS가 숨김) */
function Confetti() {
  return (
    <>
      {PIECES.map((p, i) => (
        <i
          key={i}
          className="hg-confetti"
          aria-hidden="true"
          style={
            {
              left: p.l,
              background: p.c,
              '--cx': p.x,
              '--cy': p.y,
              '--cr': p.r,
            } as CSSProperties
          }
        />
      ))}
    </>
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
