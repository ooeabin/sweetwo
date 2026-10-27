import {
  fetchHolidays,
  fetchPastChecklists,
  qk,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import { businessDayOnOrBefore, readWon, todayKst } from '@sweetwo/core';
import { AmountInput, QuestionLayout, Ring, SectionHeader, Tabs } from '@sweetwo/ui';
import { PersonDot } from '../../../shared/person';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { CheckLine, goalLineName, isPast, lineName, periodText } from '../check-line';
import { copy } from '../copy';
import {
  doneCount,
  useCheck,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  useSplits,
  waiting,
} from '../data';
import { salaryPaths } from '../paths';

// W-02 이번 달 월급(20). 디자인 시스템 Checklist 틀(TransferRow 줄). 저금 줄 먼저, 쓰는 돈 다음.
// 각자 모드 + 배우자 합류면 사람 탭(배우자 탭은 보기 + 대신 체크). 줄 ⋯ ‘다른 금액으로 보냈어요’ → W-02a.
// `?who=사람 id`면 그 사람 탭으로 엶(배우자 체크 다 함 알림). 마지막 줄을 체크하면 W-02 끝.
// ‹ › 지난 달 보기(읽기 전용). 월급날이 주말·공휴일이면 기간 시작을 직전 영업일로 표시(07 1장, 끌 수 있음).
// 상대가 이번 사이클에 분배표를 바꿨으면 맨 위 안내 한 줄(× 또는 다음 달에 사라짐).
export function W02Checklist() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const check = useCheck();
  const [params] = useSearchParams();
  const [who, setWho] = useState<string | null>(() => params.get('who'));
  const [other, setOther] = useState<PayCheckLine | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [ago, setAgo] = useState(0);
  const [hidden, setHidden] = useState<string | null>(null);
  const prevLeft = useRef<number | null>(null);
  const splits = useSplits();
  const holidays = useQuery({ queryKey: qk.holidays, queryFn: fetchHolidays });

  const meId = me.data?.id;
  const joint = space.data?.salary_mode === 'joint';
  const all = lists.data ?? [];
  const tab = who ?? (joint ? 'joint' : (meId ?? ''));
  const list: PayChecklist | undefined = all.find((c) =>
    tab === 'joint' ? c.owner_user_id === null : c.owner_user_id === tab,
  );
  const left = list ? waiting(list).length : null;
  const owner = tab === 'joint' ? null : tab;
  const today = todayKst();
  const past = useQuery({
    queryKey: qk.pastChecklists(owner, list?.cycle_start ?? today),
    queryFn: () => fetchPastChecklists(owner, list?.cycle_start ?? today),
    enabled: !!list,
  });

  // 마지막 줄을 체크하면 W-02 끝
  useEffect(() => {
    if (left === 0 && prevLeft.current !== null && prevLeft.current > 0) nav(salaryPaths.done);
    prevLeft.current = left;
  }, [left, nav]);

  if (!me.data || !space.data || !goals.data || lists.isLoading) return null;
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const goalName = goalLineName(goals.data, personName, joint);

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
          {
            value: meId ?? '',
            label: me.data.nickname ?? '',
            lead: (
              <PersonDot name={me.data.nickname ?? ''} starter={meId === space.data.created_by} />
            ),
          },
          {
            value: partner.data.id,
            label: partner.data.nickname ?? '',
            lead: (
              <PersonDot
                name={partner.data.nickname ?? ''}
                starter={partner.data.id === space.data.created_by}
              />
            ),
          },
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
  const shown = ago > 0 ? (past.data?.[ago - 1] ?? list) : list;
  const total = shown.pay_check_line.length;
  const done = doneCount(shown);
  const readOnly = ago > 0 || isPast(shown.cycle_end);
  const holidaySet = new Set((holidays.data ?? []).map((h) => h.date));
  const start =
    space.data.holiday_shift === false
      ? shown.cycle_start
      : businessDayOnOrBefore(shown.cycle_start, holidaySet);
  // 상대가 이번 사이클에 분배표를 바꿨으면 안내(20 ‘바뀐 직후 W-02 맨 위 안내 한 줄’)
  const split = (splits.data ?? []).find((x) => x.owner_user_id === owner);
  const changedBy =
    ago === 0 &&
    split?.updated_by &&
    split.updated_by !== meId &&
    split.updated_at.slice(0, 10) >= list.cycle_start
      ? personName(split.updated_by)
      : null;
  const noticeKey = split ? `sweetwo.split-notice.${split.id}` : '';
  const dismissed = (() => {
    if (hidden === split?.updated_at) return true;
    try {
      return localStorage.getItem(noticeKey) === split?.updated_at;
    } catch {
      return false;
    }
  })();
  const dismiss = () => {
    setHidden(split?.updated_at ?? null);
    try {
      localStorage.setItem(noticeKey, split?.updated_at ?? '');
    } catch {
      /* 저장 못 해도 이번 화면에서는 숨김 */
    }
  };
  const partnerTab = !joint && tab !== meId;
  const row = (l: PayCheckLine) => (
    <CheckLine
      key={l.id}
      line={l}
      name={lineName(l, goalName, personName, joint)}
      personName={personName}
      meId={meId}
      readOnly={readOnly}
      // 배우자 탭은 보기 + 대신 체크만(20 W-02 2번): ‘다른 금액’ 없음
      onOther={partnerTab ? undefined : () => setOther(l)}
    />
  );
  const more = (past.data?.length ?? 0) > ago;
  return (
    <QuestionLayout
      title={copy.cycleTitle(shown.label)}
      help={`${periodText(start, shown.cycle_end)}. ${done === total ? copy.allDone : copy.progress(total, done)}`}
      onBack={() => nav('/')}
    >
      <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
        <button
          type="button"
          className="hg-btn hg-btn--ghost hg-btn--sm"
          aria-label={copy.prevMonth}
          disabled={!more}
          onClick={() => setAgo(ago + 1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="hg-btn hg-btn--ghost hg-btn--sm"
          aria-label={copy.nextMonth}
          disabled={ago === 0}
          onClick={() => setAgo(ago - 1)}
        >
          ›
        </button>
      </div>
      {changedBy && !dismissed && (
        <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
          <p className="hg-q__help" style={{ flex: 1 }}>
            {copy.partnerChangedSplit(changedBy)}
          </p>
          <button
            type="button"
            className="hg-btn hg-btn--ghost hg-btn--sm"
            aria-label={copy.close}
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      )}
      {people && (
        <Tabs
          label={copy.cycleTitle(shown.label)}
          value={tab}
          onChange={(v) => {
            setWho(v);
            setAgo(0);
          }}
          items={people}
        />
      )}
      {(
        [
          [copy.savingGroup, shown.pay_check_line.filter((l) => l.kind === 'saving')],
          [copy.spendGroup, shown.pay_check_line.filter((l) => l.kind !== 'saving')],
        ] as const
      ).map(([title, ls]) => {
        // 묶음 카드(카카오뱅크 체크리스트처럼 머리에 한 개수/전체 원)
        const n = ls.filter((l) => l.state !== 'wait').length;
        return (
          <section key={title} className="hg-checkgroup" aria-label={title}>
            <SectionHeader
              title={title}
              lead={<Ring done={n} total={ls.length} label={copy.progress(ls.length, n)} />}
            />
            <div className="hg-checklist__list">{ls.map(row)}</div>
          </section>
        );
      })}
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
