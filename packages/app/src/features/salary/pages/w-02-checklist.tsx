import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { AmountInput, QuestionLayout, SectionHeader, Tabs } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { CheckLine, isPast, lineName, periodText } from '../check-line';
import { copy } from '../copy';
import {
  doneCount,
  useCheck,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  waiting,
} from '../data';
import { salaryPaths } from '../paths';

// W-02 이번 달 월급(20). 디자인 시스템 Checklist 틀(TransferRow 줄). 저금 줄 먼저, 쓰는 돈 다음.
// 각자 모드 + 배우자 합류면 사람 탭(배우자 탭은 보기 + 대신 체크). 줄 ⋯ ‘다른 금액으로 보냈어요’ → W-02a.
// 마지막 줄을 체크하면 W-02 끝. 지난 달 보기(‹ ›)는 다음 단계.
export function W02Checklist() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const check = useCheck();
  const [who, setWho] = useState<string | null>(null);
  const [other, setOther] = useState<PayCheckLine | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const prevLeft = useRef<number | null>(null);

  const meId = me.data?.id;
  const joint = space.data?.salary_mode === 'joint';
  const all = lists.data ?? [];
  const tab = who ?? (joint ? 'joint' : (meId ?? ''));
  const list: PayChecklist | undefined = all.find((c) =>
    tab === 'joint' ? c.owner_user_id === null : c.owner_user_id === tab,
  );
  const left = list ? waiting(list).length : null;

  // 마지막 줄을 체크하면 W-02 끝
  useEffect(() => {
    if (left === 0 && prevLeft.current !== null && prevLeft.current > 0) nav(salaryPaths.done);
    prevLeft.current = left;
  }, [left, nav]);

  if (!me.data || !space.data || !goals.data || lists.isLoading) return null;
  const goalName = (id: string | null) => goals.data.find((g) => g.id === id)?.name ?? '';
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);

  // W-02a 다른 금액
  if (other) {
    const v = amount ?? other.planned;
    const diff = v - other.planned;
    return (
      <QuestionLayout
        title={copy.howMuch}
        help={
          diff < 0
            ? copy.lessThanPlan(readWon(-diff))
            : diff > 0
              ? copy.moreThanPlan(readWon(diff))
              : undefined
        }
        onBack={() => setOther(null)}
        primary={{ label: copy.next }}
        onSubmit={() => {
          const line = other;
          setOther(null);
          setAmount(null);
          void check(line, 'checked', v).catch(() => toast(copy.failed));
        }}
      >
        <AmountInput
          label={copy.howMuch}
          value={v}
          onChange={(x) => setAmount(x ?? 0)}
          monthly
          allowZero
        />
      </QuestionLayout>
    );
  }

  const people =
    !joint && space.data.couple_state === 'connected' && partner.data
      ? [
          { value: meId ?? '', label: me.data.nickname ?? '' },
          { value: partner.data.id, label: partner.data.nickname ?? '' },
        ]
      : null;
  if (!list) {
    return (
      <QuestionLayout title={copy.noChecklist} onBack={() => nav('/')}>
        <button type="button" className="hg-btn hg-btn--link" onClick={() => nav('/settings/me')}>
          {copy.tellSalary}
        </button>
      </QuestionLayout>
    );
  }
  const total = list.pay_check_line.length;
  const done = doneCount(list);
  const readOnly = isPast(list.cycle_end);
  const row = (l: PayCheckLine) => (
    <CheckLine
      key={l.id}
      line={l}
      name={lineName(l, goalName, personName, joint)}
      personName={personName}
      meId={meId}
      readOnly={readOnly}
      onOther={() => setOther(l)}
    />
  );
  return (
    <QuestionLayout
      title={copy.cycleTitle(list.label)}
      help={`${periodText(list.cycle_start, list.cycle_end)}. ${done === total ? copy.allDone : copy.progress(total, done)}`}
      onBack={() => nav('/')}
    >
      {people && (
        <Tabs label={copy.cycleTitle(list.label)} value={tab} onChange={setWho} items={people} />
      )}
      <SectionHeader title={copy.savingGroup} />
      <div className="hg-checklist__list">
        {list.pay_check_line.filter((l) => l.kind === 'saving').map(row)}
      </div>
      <SectionHeader title={copy.spendGroup} />
      <div className="hg-checklist__list">
        {list.pay_check_line.filter((l) => l.kind !== 'saving').map(row)}
      </div>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => nav(salaryPaths.split)}
      >
        {copy.editSplit}
      </button>
    </QuestionLayout>
  );
}
