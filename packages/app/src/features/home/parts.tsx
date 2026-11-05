import type { Goal, PayChecklist } from '@sweetwo/api';
import { defaultGoalPreset, formatDateWeekday } from '@sweetwo/core';
import {
  Badge,
  Button,
  Icon,
  goalPhotoArt,
  Lead,
  Ring,
  SectionHeader,
  goalIcon,
} from '@sweetwo/ui';
import { PersonDot } from '../../shared/person';
import { money, useMask } from '../../shared/mask';
import { CheckLine, doneCount, LineLead, lineName } from '../salary';
import { copy } from './copy';

/** 목표 그림(2026-11-04 그 종류 지정 사진. 사진이 없으면 O-21과 같은 템플릿 아이콘) */
function GoalLead({ template }: { template: string }) {
  const photo = goalPhotoArt(defaultGoalPreset(template));
  return photo ? <Lead photo={photo} /> : <Lead icon={goalIcon(template)} />;
}
const pctOf = (saved: number, target: number | null) =>
  target ? Math.min(Math.floor((saved * 100) / target), 100) : 0;

/**
 * H-02 목표(2026-11-03 다시 짬, 카카오T·카카오페이 진행 막대처럼): 큰 카드 하나 대신 한 카드 안에 목표 줄 최대 4개.
 * 줄 = 그림 + 이름(내 목표는 작은 “나”) + “95만 / 1억 5,000만 원” + 오른쪽 % + 아래 얇은 막대(예상 달은 목표 탭).
 * 순서: 우리 목표 → 비상금 → 내 목표(배우자 미합류·혼자 쓰기면 우리 → 내 → 비상금). 금액 없는 목표는 % 대신 ‘금액 정하기’(→ G-03 금액).
 * 이번 달 저금 체크는 위 이번 달 체크리스트에서만. 줄 → G-02. ‘지연’ 배지는 홈에 없음.
 */
export function GoalsCard({
  goals,
  savedOf,
  meId,
  joined = true,
  solo = false,
  go,
}: {
  goals: Goal[];
  savedOf: (g: Goal) => number;
  meId: string | undefined;
  /** 배우자가 합류했는지(미합류·혼자 쓰기면 내 목표를 비상금보다 먼저) */
  joined?: boolean;
  solo?: boolean;
  go: (to: string) => void;
}) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const live = goals.filter((g) => g.status === 'active' || g.status === 'delayed');
  const ours = live.filter((g) => g.template !== 'emergency' && g.owner_user_id === null);
  const mine = live.filter((g) => g.template !== 'emergency' && g.owner_user_id === meId);
  const emergency = live.filter((g) => g.template === 'emergency');
  const list = (joined ? [...ours, ...emergency, ...mine] : [...ours, ...mine, ...emergency]).slice(
    0,
    4,
  );
  if (!list.length) return null;
  return (
    <section className="hg-stack" aria-label={copy.goals}>
      <SectionHeader title={copy.goals} more={{ label: copy.moreGoals, href: '/goals' }} />
      <div className="hg-card hg-goallist">
        {list.map((g) => {
          const saved = savedOf(g);
          const pct = pctOf(saved, g.target_amount);
          const to = g.target_amount ? `/goals/${g.id}` : `/goals/${g.id}/set-amount`;
          return (
            <button key={g.id} type="button" className="hg-goalrow" onClick={() => go(to)}>
              <GoalLead template={g.template} />
              <span className="hg-goalrow__name">
                {g.name}
                {g.owner_user_id === meId && !solo && <Badge kind="temp">{copy.mineMark}</Badge>}
              </span>
              <span className="hg-goalrow__pct">
                {g.target_amount ? (
                  <>
                    {pct}
                    <small>%</small>
                  </>
                ) : (
                  <span className="hg-goalrow__set">{copy.setAmount}</span>
                )}
              </span>
              <span className="hg-goalrow__sub">
                {/* 금액만(한 줄). 예상 달은 목표 탭에서 */}
                {g.target_amount ? copy.goalAmount(m(saved), m(g.target_amount)) : m(saved)}
              </span>
              {g.target_amount ? (
                <span className="hg-goalrow__bar" aria-hidden="true">
                  <i style={{ width: `${saved > 0 ? Math.max(pct, 2) : 0}%` }} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!ours.length && !mine.length && (
        <Button variant="secondary" onClick={() => go('/goals/new')}>
          {copy.addGoal}
        </Button>
      )}
    </section>
  );
}

const SHOW = 3;

/**
 * H-03 이번 달 월급: “10월 월급” + “5개 중 2개 완료” + 줄 목록(저금 먼저) + ‘월급 계획 고치기’.
 * 다 했으면 “10월 월급 체크를 다 했어요” + 저금 합계, 줄은 숨김(펼치기 없음, 머리 링크 → W-02). 월급이 없으면 ‘월급 알려 주기’.
 */
export function SalaryCard({
  list,
  partnerList,
  partnerName,
  partnerStarter = false,
  goalName,
  goalOf,
  personName,
  meId,
  joint,
  go,
  locked = false,
}: {
  list: PayChecklist | undefined;
  partnerList?: PayChecklist;
  partnerName: string;
  /** 배우자가 시작한 사람인지(Avatar 색) */
  partnerStarter?: boolean;
  goalName: (id: string | null) => string;
  /** 저금 줄 목표 템플릿(아이콘) */
  goalOf: (id: string | null) => { template: string; photo_path: string | null } | null;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  joint: boolean;
  go: (to: string) => void;
  /** 연결 해제 대기 중: 월급 계획을 고칠 수 없어서 ‘월급 계획 고치기’ 숨김(2026-11-03) */
  locked?: boolean;
}) {
  const { masked } = useMask();
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
    // 2026-11-03 다른 영역처럼 제목 줄은 카드 위(진행 원 + “9월 월급” + “5개 중 1개 완료 ›”), 줄마다 아이콘, 마지막 줄 선 없음
    <section className="hg-stack" aria-label={list.label}>
      <SectionHeader
        title={list.label}
        lead={<Ring done={done} total={total} label={copy.progress(total, done)} />}
        more={{ label: copy.progress(total, done), href: '/salary' }}
      />
      <div className="hg-card hg-stack hg-salarycard">
        {finished && (
          <p className="hg-card__meta">
            <Icon name="check" size={16} /> {copy.allDone(list.label)}.{' '}
            {savedSum > 0 && copy.savedThisMonth(money(savedSum, masked))}
          </p>
        )}
        {/* 다 했으면 줄 없이 한 줄 요약만(‘줄 펼치기’ 없음, 줄은 머리 링크 → W-02, 2026-11-03) */}
        {!finished && (
          <div className="hg-checklist__list">
            {/* 홈 맨 위(2026-11-03): 3줄까지만(저금 먼저). 나머지는 머리 ‘5개 중 2개 완료 ›’ → W-02 */}
            {lines.slice(0, SHOW).map((l) => (
              <CheckLine
                key={l.id}
                line={l}
                name={lineName(l, goalName, personName, joint)}
                personName={personName}
                meId={meId}
                lead={<LineLead line={l} goalOf={goalOf} />}
              />
            ))}
          </div>
        )}
        {partnerList && (
          // 배우자 체크 현황(카카오뱅크 모임통장 멤버 줄처럼): Avatar + 문장 + 진행 원
          <button
            type="button"
            className="hg-person"
            onClick={() => go(`/salary?who=${partnerList.owner_user_id ?? ''}`)}
          >
            <PersonDot
              name={partnerName}
              starter={partnerStarter}
              userId={partnerList.owner_user_id}
            />
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
        {!locked && (
          <button type="button" className="hg-btn hg-btn--link" onClick={() => go('/salary/split')}>
            {copy.editSplit}
          </button>
        )}
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
  /** 날짜 칸 색(월급날 초록, 월말 확인 청록, 챙길 날 분홍, 목표 기한 베이지, 만기 보라) */
  kind: 'payday' | 'review' | 'care' | 'goal' | 'maturity';
}

const KIND_TONE = {
  payday: 'invest',
  review: 'safety',
  care: 'together',
  goal: 'goal',
  maturity: 'family',
} as const;

/**
 * H-05 다가오는 일정: 30일 안 월급날, 월말 확인, 챙길 날, 목표 기한, 날짜순 최대 3개.
 * 2026-11-03 카카오톡 일정처럼 왼쪽 날짜 칸(“10월” / “22”, 종류별 옅은 영역 색) + 이름 + 요일, 오른쪽 D-day. 주 띠는 없앰.
 */
export function UpcomingCard({ items, go }: { items: UpcomingItem[]; go: (to: string) => void }) {
  return (
    <section className="hg-stack" aria-label={copy.upcoming}>
      <SectionHeader
        title={copy.upcoming}
        more={{ label: copy.moreCalendar, href: '/calendar/list' }}
      />
      {items.length ? (
        <div className="hg-card hg-daylist">
          {items.map((e) => {
            const [, mo, d] = e.date.split('-').map(Number) as [number, number, number];
            return (
              <button
                key={e.key}
                type="button"
                className="hg-dayrow"
                aria-label={`${e.label}, ${formatDateWeekday(e.date)}, ${copy.dday(e.dday)}`}
                onClick={() => go(e.to)}
              >
                <span
                  className={`hg-dayrow__date hg-dayrow__date--${KIND_TONE[e.kind]}`}
                  aria-hidden="true"
                >
                  <small>{copy.monthShort(mo)}</small>
                  <b>{d}</b>
                </span>
                <span className="hg-dayrow__text" aria-hidden="true">
                  <b>{e.label}</b>
                  <small>{formatDateWeekday(e.date).replace(/^.*?일 /, '')}</small>
                </span>
                <span className="hg-dayrow__dday" aria-hidden="true">
                  {copy.dday(e.dday)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="hg-card hg-card--fill">
          <p className="hg-card__meta">{copy.noUpcoming}</p>
        </div>
      )}
    </section>
  );
}
