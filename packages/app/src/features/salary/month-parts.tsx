import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import { formatMonthDay, monthProgress, type MonthProgress } from '@sweetwo/core';
import {
  PlanBar,
  ReceiptCard,
  ReceiptHead,
  ReceiptRows,
  ReceiptSection,
  ReceiptStage,
  ReceiptTotal,
  type ReceiptLine,
} from '@sweetwo/ui';
import { useState } from 'react';
import { track } from '../../shared/analytics';
import { money } from '../../shared/mask';
import { PersonDot } from '../../shared/person';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { shareReceipt, type ReceiptImageModel } from './receipt-image';

// W-01 ↔ W-02 잇기(docs/spec/20-salary-plan.md W-02 1번·W-02 끝, 2026-11-09).
// MonthBar: W-02 머리 진행 막대(W-01과 같은 PlanBar, 보낸 만큼 채움) + “보낸 금액 142만 원 / 342만 원”.
// MonthResult: 다 끝난 달 결과 카드(W-01 영수증 모양, 제목 “11월 월급”, 실제 보낸 금액, ‘못 함’, 공유하기).

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

/** W-02 머리 진행 막대. 화면 읽기는 막대 이름 “5개 중 2개 완료”(다 하면 “다 보냈어요”) + 아래 한 줄 */
export function MonthBar({
  list,
  income,
  masked,
}: {
  list: PayChecklist;
  income: number;
  masked: boolean;
}) {
  const p = monthProgress({ income, lines: list.pay_check_line });
  return (
    <PlanBar
      flat
      progress
      label={p.complete ? copy.allDone : copy.progress(p.total, p.done)}
      parts={partsOf(p)}
      caption={copy.sentOfPlan(money(p.sent, masked), money(p.planned, masked))}
    />
  );
}

/**
 * 달 결과 카드(W-02 끝, 다 끝난 W-02, 지난 달 보기). 머리 = 제목(달) + 수입 + “10월 25일 받음”,
 * PlanBar 진행 모드, 저금·지출 묶음(실제 보낸 금액, 다른 금액이면 “계획 80만 원”, ‘못 함’은 stone “못 함”이고 합에서 뺌),
 * 합계 ‘보낸 금액’ + ‘여유 자금’(수입 − 보낸 금액). 아래 ‘공유하기’(W-01과 같은 canvas 이미지, 제목 = 달 이름)
 */
export function MonthResult({
  list,
  income,
  received,
  people,
  nameOf,
  masked,
  whose,
  screen,
}: {
  list: PayChecklist;
  income: number;
  /** 받은 날(기간 시작, 영업일 당김 반영) */
  received: string;
  people: { id: string; name: string; starter: boolean }[];
  nameOf: (l: PayCheckLine) => string;
  masked: boolean;
  whose: 'self' | 'partner' | 'joint';
  screen: 'done' | 'checklist' | 'past';
}) {
  const [sharing, setSharing] = useState(false);
  const p = monthProgress({ income, lines: list.pay_check_line });
  const won = (v: number) => money(v, masked);
  const savingLines = list.pay_check_line.filter((l) => l.kind === 'saving');
  const spendLines = list.pay_check_line.filter((l) => l.kind !== 'saving');
  const rowOf = (l: PayCheckLine) => {
    const name = nameOf(l);
    if (l.state !== 'checked')
      return {
        name,
        amount: copy.skippedShort,
        muted: true,
        label: `${name} ${copy.skippedShort}`,
      };
    const sent = l.actual ?? l.planned;
    const sub = sent !== l.planned ? copy.planned(won(l.planned)) : undefined;
    return {
      name,
      amount: won(sent),
      sub,
      label: [name, won(sent), sub].filter(Boolean).join(', '),
    };
  };
  const lines = (ls: PayCheckLine[]): ReceiptLine[] => ls.map((l) => ({ id: l.id, ...rowOf(l) }));
  const totals = [
    { label: copy.sentTotal, amount: won(p.sent) },
    p.left >= 0
      ? { label: copy.leftoverLabel, amount: won(p.left), strong: true }
      : { label: copy.leftoverLabel, amount: copy.short(won(-p.left)), strong: true, short: true },
  ];
  const sub = copy.received(formatMonthDay(received));
  const sections = [
    { title: copy.savingGroup, subtotal: won(p.savingSent), ls: savingLines },
    { title: copy.spendGroup, subtotal: won(p.spendSent), ls: spendLines },
  ].filter((s) => s.ls.length > 0);
  const lead =
    people.length > 1 ? (
      <span className="hg-avatars">
        {people.map((x) => (
          <PersonDot
            key={x.id}
            name={x.name}
            starter={x.starter}
            userId={x.id}
            className="hg-avatar--lg"
          />
        ))}
      </span>
    ) : people[0] ? (
      <PersonDot
        name={people[0].name}
        starter={people[0].starter}
        userId={people[0].id}
        className="hg-avatar--lg"
      />
    ) : null;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const model: ReceiptImageModel = {
      people: people.map((x) => (x.starter ? 1 : 2)),
      title: list.label,
      amount: won(income),
      sub,
      bar: partsOf(p),
      progress: true,
      legend: [],
      sections: sections.map((s) => ({
        title: s.title,
        subtotal: s.subtotal,
        rows: s.ls.map((l) => {
          const r = rowOf(l);
          return { name: r.name, amount: r.amount, sub: r.sub, muted: r.muted };
        }),
      })),
      totals,
    };
    try {
      const r = await shareReceipt(model, copy.monthImageName(list.cycle_start.slice(0, 7)));
      track('month_result_shared', {
        result: r,
        masked,
        whose,
        screen,
        skipped: p.done - p.checked,
      });
      if (r === 'downloaded') toast(copy.imageSaved);
    } catch {
      track('month_result_shared', {
        result: 'failed',
        masked,
        whose,
        screen,
        skipped: p.done - p.checked,
      });
      toast(copy.failed);
    } finally {
      setSharing(false);
    }
  };

  return (
    <ReceiptStage label={copy.resultLabel(list.label)}>
      <ReceiptCard>
        <ReceiptHead lead={lead} title={list.label} amount={won(income)} sub={sub} />
        <PlanBar
          progress
          label={p.complete ? copy.allDone : copy.progress(p.total, p.done)}
          parts={partsOf(p)}
        />
        {sections.map((s) => (
          <ReceiptSection key={s.title} title={s.title} subtotal={s.subtotal}>
            <ReceiptRows label={s.title} lines={lines(s.ls)} labels={ROW_LABELS} />
          </ReceiptSection>
        ))}
        <ReceiptTotal rows={totals} />
      </ReceiptCard>
      <div className="hg-receipt-actions">
        <button
          type="button"
          className="hg-btn hg-btn--link"
          aria-busy={sharing || undefined}
          onClick={() => void share()}
        >
          {copy.share}
        </button>
      </div>
    </ReceiptStage>
  );
}

const ROW_LABELS = {
  handle: copy.handle,
  up: copy.moveUp,
  down: copy.moveDown,
  moved: copy.moved,
  remove: copy.remove,
  removeLabel: copy.removeLabel,
  locked: copy.locked,
};
