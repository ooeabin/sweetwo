import {
  checkPayLine,
  fetchHolidays,
  fetchPastChecklists,
  qk,
  type PayChecklist,
  type PayCheckLine,
} from '@sweetwo/api';
import { businessDayOnOrBefore, readWon, todayKst } from '@sweetwo/core';
import { AmountInput, Button, IconButton, QuestionLayout, SectionHeader, Tabs } from '@sweetwo/ui';
import { LoadingFrame, MainFrame } from '../../frame';
import { money, useMask } from '../../../shared/mask';
import { PersonDot } from '../../../shared/person';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { quietly, toast } from '../../../shared/toast';
import { CheckLine, goalLineName, isPast, LineLead, lineName, periodText } from '../check-line';
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
import { salaryPaths, savingPaths } from '../paths';
import { useFirstSaving, useSavingItems } from '../saving';
import { AchieveWatch, FirstSavingRow, SavingMeta } from '../saving-parts';

// W-02 이번 달 월급(20) = 월급 탭 첫 화면(2026-11-08 ADR 0007, 앱 틀 안. 넓은 창 제목 줄 ‘+ 저금 항목 추가’, 좁은 창 + 버튼).
// 디자인 시스템 Checklist 틀(TransferRow 줄). 저금 줄 먼저(목표 금액이 있으면 진행), 쓰는 돈 다음. 저금 줄 시트 ‘저금 항목 보기’ → W-10.
// 각자 모드 + 파트너 합류면 사람 탭(파트너 탭은 보기만, 2026-11-03 대신 체크 없앰). 줄 ⋯ ‘다른 금액으로 보냈어요’ → W-02a.
// `?who=사람 id`면 그 사람 탭으로 엶(파트너 체크 다 함 알림). 마지막 줄을 체크하면 W-02 끝.
// ‹ › 지난 달 보기(읽기 전용). 월급날이 주말·공휴일이면 기간 시작을 직전 영업일로 표시(07 1장, 끌 수 있음).
// 상대가 이번 사이클에 월급 계획을 바꿨으면 맨 위 안내 한 줄(× 또는 다음 달에 사라짐).
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
  const saving = useSavingItems();
  const first = useFirstSaving();
  const { masked } = useMask();
  const group = useGroupCheck(masked);

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

  if (!me.data || !space.data || !goals.data || lists.isLoading)
    return <LoadingFrame current="salary" />;
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const goalName = goalLineName(goals.data, personName, joint);

  // W-02a 다른 금액. 어느 줄인지 제목에(2026-11-09 “생활비, 얼마를 보냈어요?”), 보조는 계획 금액과 차이
  if (other) {
    const v = amount ?? other.planned;
    const diff = v - other.planned;
    return (
      <QuestionLayout
        title={copy.howMuchFor(lineName(other, goalName, personName, joint))}
        help={
          diff < 0
            ? copy.lessThanPlan(readWon(-diff))
            : diff > 0
              ? copy.moreThanPlan(readWon(diff))
              : copy.planned(readWon(other.planned))
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
              <PersonDot
                name={me.data.nickname ?? ''}
                starter={meId === space.data.created_by}
                userId={meId}
              />
            ),
          },
          {
            value: partner.data.id,
            label: partner.data.nickname ?? '',
            lead: (
              <PersonDot
                name={partner.data.nickname ?? ''}
                starter={partner.data.id === space.data.created_by}
                userId={partner.data.id}
              />
            ),
          },
        ]
      : null;
  const pending = space.data.couple_state === 'unlink_pending';
  // 제목 줄 ‘+ 저금 추가’(넓은 창만, 좁은 창은 + 버튼, 20 W-02). 다른 메뉴 제목 줄 추가처럼 보조 버튼(2026-11-09).
  // 월급이 없거나 해제 대기 중이면 없음
  const page = {
    title: copy.tabTitle,
    actions:
      list && !pending ? (
        <Button variant="secondary" className="hg-wide-only" onClick={() => nav(savingPaths.add)}>
          {copy.addItem}
        </Button>
      ) : undefined,
  };
  if (!list) {
    // 월급 없음: 홈과 같은 빈 카드 + ‘월급 알려 주기’, 좁은 창 + 버튼 없음(20 W-11)
    return (
      <MainFrame
        current="salary"
        noAdd
        page={page}
        columns={[
          <section key="l" className="hg-card hg-card--fill hg-stack">
            <p className="hg-card__meta">{copy.noChecklist}</p>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => nav('/settings/me')}
            >
              {copy.tellSalary}
            </button>
          </section>,
        ]}
      />
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
  // 상대가 이번 사이클에 월급 계획을 바꿨으면 안내(20 ‘바뀐 직후 W-02 맨 위 안내 한 줄’)
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
  const itemOf = (id: string | null) => (saving.ready && id ? saving.byId(id) : undefined);
  const row = (l: PayCheckLine) => (
    <CheckLine
      key={l.id}
      line={l}
      name={lineName(l, goalName, personName, joint)}
      personName={personName}
      meId={meId}
      lead={<LineLead line={l} />}
      readOnly={readOnly}
      viewOnly={partnerTab}
      // 파트너 탭은 보기만(20 W-02 2번, 2026-11-03 대신 체크 없앰)
      onOther={partnerTab ? undefined : () => setOther(l)}
      // 지난 달은 읽기 전용이라 시트 없음(‘저금 항목 보기’도 이번 달만)
      onItem={
        !readOnly && l.kind === 'saving' && l.goal_id && itemOf(l.goal_id)
          ? () => nav(savingPaths.item(l.goal_id ?? ''))
          : undefined
      }
      progress={
        l.kind === 'saving' && itemOf(l.goal_id)?.target != null ? (
          <SavingMeta item={itemOf(l.goal_id)} masked={masked} />
        ) : undefined
      }
    />
  );
  const more = (past.data?.length ?? 0) > ago;
  const openList = () => nav(`${savingPaths.list}?from=checklist`);
  const column = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <AchieveWatch />
      {/* 2026-11-09 밀도: 제목 + 아래 기간·진행 한 줄, 지난 달·다음 달 ‹ ›는 같은 머리 오른쪽(진행 원 없음, 진행은 글자와 묶음 머리 개수) */}
      <section aria-label={copy.cycleTitle(shown.label)}>
        <SectionHeader
          title={copy.cycleTitle(shown.label)}
          meta={`${periodText(start, shown.cycle_end)}. ${done === total ? copy.allDone : copy.progress(total, done)}`}
          action={
            <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <IconButton
                icon="chevron-left"
                label={copy.prevMonth}
                small
                disabled={!more}
                onClick={() => setAgo(ago + 1)}
              />
              <IconButton
                icon="chevron-right"
                label={copy.nextMonth}
                small
                disabled={ago === 0}
                onClick={() => setAgo(ago - 1)}
              />
            </span>
          }
        />
      </section>
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
      {/* 각자 모드 파트너 탭은 보기만(2026-11-09): 맨 위 회색 한 줄 */}
      {partnerTab && (
        <p className="hg-q__help" style={{ margin: 0 }}>
          {copy.partnerChecklistView(partner.data?.nickname ?? '')}
        </p>
      )}
      {/* 묶음 카드 사이 12px(2026-11-09 밀도), 영역 사이는 24px */}
      <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        {(
          [
            [copy.savingGroup, shown.pay_check_line.filter((l) => l.kind === 'saving')],
            [copy.spendGroup, shown.pay_check_line.filter((l) => l.kind !== 'saving')],
          ] as const
        ).map(([title, ls]) => {
          // 묶음 카드(머리 “저금 0/2”). 저금 줄이 없으면 저금 묶음 없음
          const n = ls.filter((l) => l.state !== 'wait').length;
          if (!ls.length && title === copy.savingGroup) {
            // 내 저금이 없으면 저금 묶음에 빈 줄 ‘+ 저금 추가’(2026-11-09, 이번 달 내 탭·합쳐서만)
            if (!first.show || partnerTab || readOnly) return null;
            return (
              <section key={title} className="hg-checkgroup" aria-label={title}>
                <SectionHeader
                  variant="group"
                  title={title}
                  onTitle={openList}
                  titleLabel={copy.listOpen}
                />
                <FirstSavingRow from="salary" go={nav} />
              </section>
            );
          }
          const kind = title === copy.savingGroup ? 'saving' : 'spend';
          // 묶음 ‘모두 보냈어요’(2026-11-09 round 3): 이번 달 내(합쳐서면 공동) 체크리스트에서 체크 안 한 줄이 있을 때만
          const canAll = !readOnly && !partnerTab && n < ls.length;
          return (
            <section key={title} className="hg-checkgroup" aria-label={title}>
              <SectionHeader
                // 2026-11-09 밀도: 진행 원 대신 한 줄 “저금 0/2 ›”(개수는 조용한 글자, 화면 읽기는 문장)
                variant="group"
                title={title}
                count={`${n}/${ls.length}`}
                countLabel={copy.progress(ls.length, n)}
                // 저금 묶음 머리를 누르면 저금 목록(W-13, 2026-11-09 round 3)
                onTitle={kind === 'saving' ? openList : undefined}
                titleLabel={kind === 'saving' ? copy.listOpen : undefined}
                action={
                  canAll ? (
                    <button
                      type="button"
                      className="hg-btn hg-btn--link"
                      aria-label={copy.groupAllSentLabel(title)}
                      aria-busy={group.busy === kind || undefined}
                      disabled={!!group.busy}
                      onClick={() => void group.run(kind, ls)}
                    >
                      {copy.groupAllSent}
                    </button>
                  ) : undefined
                }
              />
              <div className="hg-checklist__list">{ls.map(row)}</div>
            </section>
          );
        })}
      </div>
      {/* 파트너 탭(각자)은 보기만이라 고치는 링크 없음(2026-11-09 round 3) */}
      {!partnerTab && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav(salaryPaths.split)}
        >
          {copy.editSplit}
        </button>
      )}
    </div>
  );
  return <MainFrame current="salary" page={page} columns={[column]} />;
}

/**
 * 묶음 ‘모두 보냈어요’(20 W-02 3a, 2026-11-09 round 3): 묶음의 체크 안 한 줄을 차례로 체크(줄마다 서버 check_pay_line,
 * 막히면 거기서 멈춤), 다 끝난 뒤 한 번만 다시 읽음(달성 축하는 AchieveWatch가 한 번에 봄).
 * Toast 한 번: 저금 묶음은 더한 금액 합, 쓰는 돈은 개수 + ‘되돌리기’(이번에 체크한 줄만 풂).
 * 오프라인이면 첫 줄에서 막혀 “인터넷에 연결되면 할 수 있어요”
 */
function useGroupCheck(masked: boolean) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goalSaved }),
    ]);
  const undo = (ids: string[]) =>
    quietly(
      (async () => {
        for (const id of ids) await checkPayLine(id, 'wait');
        await refresh();
      })(),
    );
  const run = async (group: 'saving' | 'spend', lines: PayCheckLine[]) => {
    if (busy) return;
    const todo = lines.filter((l) => l.state === 'wait');
    if (!todo.length) return;
    setBusy(group);
    const done: PayCheckLine[] = [];
    let stop: string | null = null;
    try {
      for (const l of todo) {
        const r = await checkPayLine(l.id, 'checked');
        if (r === 'closed') {
          stop = copy.closed;
          break;
        }
        // 합쳐서 모드에서 상대가 먼저 체크한 줄은 건너뜀
        if (r === 'ok') done.push(l);
      }
    } catch {
      stop = copy.failed;
    }
    await refresh().catch(() => undefined);
    setBusy(null);
    if (done.length)
      track('checklist_group_checked', {
        group,
        lines_count: done.length,
        all: done.length === todo.length,
      });
    if (stop && !done.length) return toast(stop);
    if (!done.length) return;
    const ids = done.map((l) => l.id);
    toast(
      group === 'saving'
        ? copy.groupSavingDone(
            done.length,
            money(
              done.reduce((t, l) => t + l.planned, 0),
              masked,
            ),
          )
        : copy.groupSpendDone(done.length),
      { label: copy.undo, onClick: () => undo(ids) },
    );
  };
  return { busy, run };
}
