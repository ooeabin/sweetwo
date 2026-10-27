import type { Goal, PayChecklist } from '@sweetwo/api';
import { formatDateWeekday, formatYm, goalEta, templateByKey } from '@sweetwo/core';
import {
  Badge,
  Button,
  Icon,
  Illustration,
  Lead,
  ListRow,
  Meter,
  Ring,
  SectionHeader,
} from '@sweetwo/ui';
import { useState } from 'react';
import { PersonDot } from '../../shared/person';
import { money, useMask } from '../../shared/mask';
import { CheckLine, doneCount, lineName, toAllocGoal } from '../salary';
import { copy } from './copy';

/** 목표 그림(템플릿 그림, 직접 만든 목표는 깃발) */
function GoalLead({ template }: { template: string }) {
  const art = templateByKey(template)?.illustration;
  return art ? <Lead art={<Illustration name={art} />} /> : <Lead icon="flag-pennant" />;
}
const pctOf = (saved: number, target: number | null) =>
  target ? Math.min(Math.floor((saved * 100) / target), 100) : 0;

/**
 * H-02 목표: 1순위 큰 카드(그림, 모은 돈 / 목표 금액, Meter, 예상, 이번 달 줄 체크) + 나머지 2~4순위 작은 줄 + 목표 더보기.
 * 1순위 = 우리 목표 1순위(비상금 다음), 없으면 비상금. 배우자 미합류·혼자 쓰기면 우리 목표 → 내 목표 → 비상금.
 * 내 목표 줄에는 작은 “나”(혼자 쓰기는 없음). 금액 없는 목표는 % 대신 ‘금액 정하기’(→ G-03 금액).
 */
export function GoalsCard({
  goals,
  savedOf,
  monthly,
  list,
  personName,
  meId,
  joined = true,
  solo = false,
  go,
}: {
  goals: Goal[];
  savedOf: (g: Goal) => number;
  /** 그 목표 저금 줄 금액(이번 분배표) */
  monthly: (g: Goal) => number;
  list: PayChecklist | undefined;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  /** 배우자가 합류했는지(미합류·혼자 쓰기면 1순위를 내 목표까지 봄) */
  joined?: boolean;
  solo?: boolean;
  go: (to: string) => void;
}) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const live = goals.filter((g) => g.status === 'active' || g.status === 'delayed');
  const ours = live.filter((g) => g.template !== 'emergency' && g.owner_user_id === null);
  const mine = live.filter((g) => g.template !== 'emergency' && g.owner_user_id === meId);
  const emergency = live.find((g) => g.template === 'emergency');
  const top = joined ? (ours[0] ?? emergency) : (ours[0] ?? mine[0] ?? emergency);
  const rest = [...ours, ...(emergency ? [emergency] : []), ...mine]
    .filter((g) => g !== top)
    .slice(0, 3);
  if (!top) return null;
  const saved = savedOf(top);
  const eta = goalEta(toAllocGoal({ ...top, other_held: saved }), monthly(top));
  const line = list?.pay_check_line.find((l) => l.kind === 'saving' && l.goal_id === top.id);
  const late = eta.lateMonths !== null && eta.lateMonths > 0;
  return (
    <section className="hg-stack" aria-label={copy.goals}>
      <SectionHeader title={copy.goals} more={{ label: copy.moreGoals, href: '/goals' }} />
      <div className="hg-card hg-stack">
        <Meter
          name={top.name}
          tone={top.template === 'emergency' ? 'safety' : 'goal'}
          pct={pctOf(saved, top.target_amount)}
          sub={
            top.target_amount
              ? `${copy.goalAmount(m(saved), m(top.target_amount))}${eta.expected ? `, ${copy.expected(formatYm(eta.expected))}` : ''}`
              : copy.setAmount
          }
          badge={late ? <Badge kind="warn">{copy.delayed}</Badge> : undefined}
          lead={<GoalLead template={top.template} />}
        />
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            go(top.target_amount ? `/goals/${top.id}` : `/goals/${top.id}/edit/amount`)
          }
        >
          {top.target_amount ? copy.seeGoal : copy.setAmount}
        </button>
        {line && (
          <CheckLine
            line={line}
            name={
              line.state === 'checked'
                ? copy.thisMonthDone(m(line.actual ?? line.planned))
                : copy.thisMonthTodo(m(line.planned))
            }
            personName={personName}
            meId={meId}
          />
        )}
      </div>
      {rest.length > 0 && (
        <div className="hg-list">
          {rest.map((g) => (
            <ListRow
              key={g.id}
              lead={<GoalLead template={g.template} />}
              label={
                g.owner_user_id === meId && !solo ? (
                  <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                    {g.name}
                    <Badge kind="temp">{copy.mineMark}</Badge>
                  </span>
                ) : (
                  g.name
                )
              }
              value={g.target_amount ? `${pctOf(savedOf(g), g.target_amount)}%` : copy.setAmount}
              onClick={() => go(g.target_amount ? `/goals/${g.id}` : `/goals/${g.id}/edit/amount`)}
            />
          ))}
        </div>
      )}
      {!ours.length && !mine.length && (
        <Button variant="secondary" onClick={() => go('/goals/new')}>
          {copy.addGoal}
        </Button>
      )}
    </section>
  );
}

/**
 * H-03 이번 달 월급: “10월 월급” + “5개 중 2개 했어요” + 줄 목록(저금 먼저) + ‘분배표 고치기’.
 * 다 했으면 “10월 월급을 다 나눴어요” + 저금 합계, 줄은 접힘(펼치기 가능). 월급이 없으면 ‘월급 알려 주기’.
 */
export function SalaryCard({
  list,
  partnerList,
  partnerName,
  partnerStarter = false,
  goalName,
  personName,
  meId,
  joint,
  go,
}: {
  list: PayChecklist | undefined;
  partnerList?: PayChecklist;
  partnerName: string;
  /** 배우자가 시작한 사람인지(Avatar 색) */
  partnerStarter?: boolean;
  goalName: (id: string | null) => string;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  joint: boolean;
  go: (to: string) => void;
}) {
  const { masked } = useMask();
  const [open, setOpen] = useState(false);
  if (!list) {
    return (
      <section className="hg-card hg-card--fill hg-stack">
        <p className="hg-card__meta">{copy.noSalary}</p>
        <button type="button" className="hg-btn hg-btn--link" onClick={() => go('/settings/me')}>
          {copy.tellSalary}
        </button>
      </section>
    );
  }
  const lines = [
    ...list.pay_check_line.filter((l) => l.kind === 'saving'),
    ...list.pay_check_line.filter((l) => l.kind !== 'saving'),
  ];
  const total = lines.length;
  const done = doneCount(list);
  const finished = total > 0 && done === total;
  const savedSum = lines
    .filter((l) => l.kind === 'saving' && l.state === 'checked')
    .reduce((s, l) => s + (l.actual ?? l.planned), 0);
  return (
    <section className="hg-stack" aria-label={list.label}>
      <SectionHeader
        title={list.label}
        lead={<Ring done={done} total={total} label={copy.progress(total, done)} />}
        more={{ label: copy.progress(total, done), href: '/salary' }}
      />
      <div className="hg-card hg-stack">
        {finished && (
          <p className="hg-card__meta">
            <Icon name="check" size={16} /> {copy.allDone(list.label)}.{' '}
            {savedSum > 0 && copy.savedThisMonth(money(savedSum, masked))}
          </p>
        )}
        {(!finished || open) && (
          <div className="hg-checklist__list">
            {lines.map((l) => (
              <CheckLine
                key={l.id}
                line={l}
                name={lineName(l, goalName, personName, joint)}
                personName={personName}
                meId={meId}
              />
            ))}
          </div>
        )}
        {finished && !open && (
          <button type="button" className="hg-btn hg-btn--link" onClick={() => setOpen(true)}>
            {copy.showLines}
          </button>
        )}
        {partnerList && (
          // 배우자 체크 현황(카카오뱅크 모임통장 멤버 줄처럼): Avatar + 문장 + 진행 원
          <button
            type="button"
            className="hg-person"
            onClick={() => go(`/salary?who=${partnerList.owner_user_id ?? ''}`)}
          >
            <PersonDot name={partnerName} starter={partnerStarter} />
            <span className="hg-person__text">
              {copy.partnerProgress(
                partnerName,
                partnerList.pay_check_line.length,
                doneCount(partnerList),
              )}
            </span>
            <Ring
              done={doneCount(partnerList)}
              total={partnerList.pay_check_line.length}
              label={copy.progress(partnerList.pay_check_line.length, doneCount(partnerList))}
            />
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        <button type="button" className="hg-btn hg-btn--link" onClick={() => go('/salary/split')}>
          {copy.editSplit}
        </button>
      </div>
    </section>
  );
}

export interface UpcomingItem {
  key: string;
  date: string;
  label: string;
  dday: number;
  to: string;
}

/** H-05 다가오는 일정: 30일 안 월급날, 월말 확인, 챙길 날, 목표 기한, 날짜순 최대 3개 */
export function UpcomingCard({ items, go }: { items: UpcomingItem[]; go: (to: string) => void }) {
  return (
    <section className="hg-stack" aria-label={copy.upcoming}>
      <SectionHeader
        title={copy.upcoming}
        more={{ label: copy.upcoming, href: '/calendar/list' }}
      />
      {items.length ? (
        <div className="hg-list">
          {items.map((e) => (
            <ListRow
              key={e.key}
              label={e.label}
              sub={formatDateWeekday(e.date)}
              value={copy.dday(e.dday)}
              onClick={() => go(e.to)}
            />
          ))}
        </div>
      ) : (
        <div className="hg-card hg-card--fill">
          <p className="hg-card__meta">{copy.noUpcoming}</p>
        </div>
      )}
    </section>
  );
}
