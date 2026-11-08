import type { PayChecklist } from '@sweetwo/api';
import { formatDateWeekday } from '@sweetwo/core';
import { Badge, Icon, Lead, Ring, SectionHeader } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { PersonDot } from '../../shared/person';
import { money, useMask } from '../../shared/mask';
import {
  CheckLine,
  doneCount,
  LineLead,
  lineName,
  salaryPaths,
  savingPaths,
  type SavingItem,
} from '../salary';
import { copy } from './copy';

/**
 * H-02 저금(19, ADR 0007): 한 카드 안 목표 금액이 있는 저금 항목 줄 최대 4개.
 * 줄 = 저금통 아이콘 + 이름(파트너 항목은 작은 이름 칩) + “2,700만 / 1억 5,000만 원” + 오른쪽 %(달성이면 ‘달성’ 배지) + 아래 얇은 막대.
 * 순서는 useSavingItems(내 것 → 파트너 것 → 우리 둘 것). 줄 → W-10. 이번 달 체크는 H-03에서만.
 * 목표 금액이 있는 항목이 없으면 없음(2026-11-09 회색 제안 문장 대신 H-03 저금 묶음 빈 줄 ‘+ 저금 추가’).
 */
export function SavingCard({ items, go }: { items: SavingItem[]; go: (to: string) => void }) {
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const list = items.slice(0, 4);
  if (!list.length) return null;
  return (
    <section className="hg-stack" aria-label={copy.savings}>
      <SectionHeader title={copy.savings} more={{ label: copy.toSplit, href: salaryPaths.split }} />
      <div className="hg-card hg-goallist">
        {list.map((i) => {
          const target = i.target ?? 0;
          return (
            <button
              key={i.goal.id}
              type="button"
              className="hg-goalrow"
              onClick={() => go(savingPaths.item(i.goal.id))}
            >
              <Lead icon="piggy-bank" />
              <span className="hg-goalrow__name">
                {i.goal.name}
                {i.owner === 'partner' && i.ownerName && <Badge kind="temp">{i.ownerName}</Badge>}
              </span>
              <span className="hg-goalrow__pct">
                {i.state === 'achieved' ? (
                  <Badge kind="achieved">{copy.achieved}</Badge>
                ) : (
                  <>
                    {i.pct ?? 0}
                    <small>%</small>
                  </>
                )}
              </span>
              <span className="hg-goalrow__sub">{copy.goalAmount(m(i.saved), m(target))}</span>
              {i.state !== 'achieved' && (
                <span className="hg-goalrow__bar" aria-hidden="true">
                  <i style={{ width: `${i.bar}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const SHOW = 3;

/**
 * H-03 이번 달 월급: “10월 월급” + “5개 중 2개 완료” + (내 저금이 없으면 첫 저금 빈 줄) + 줄 목록(저금 먼저) + ‘월급 계획 고치기’.
 * 다 했으면 “10월 월급 체크를 다 했어요” + 저금 합계, 줄은 숨김(펼치기 없음, 머리 링크 → W-02). 월급이 없으면 ‘월급 알려 주기’.
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
  locked = false,
  firstSaving,
}: {
  list: PayChecklist | undefined;
  partnerList?: PayChecklist;
  partnerName: string;
  /** 파트너가 시작한 사람인지(Avatar 색) */
  partnerStarter?: boolean;
  goalName: (id: string | null) => string;
  personName: (id: string | null) => string | null;
  meId: string | undefined;
  joint: boolean;
  go: (to: string) => void;
  /** 연결 해제 대기 중: 월급 계획을 고칠 수 없어서 ‘월급 계획 고치기’ 숨김(2026-11-03) */
  locked?: boolean;
  /** 첫 저금 빈 줄(salary FirstSavingRow, 2026-11-09): 내 저금이 없을 때 줄 목록 맨 위(저금 묶음 자리) */
  firstSaving?: ReactNode;
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
        {firstSaving}
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
                lead={<LineLead line={l} />}
              />
            ))}
          </div>
        )}
        {partnerList && (
          // 파트너 체크 현황(카카오뱅크 모임통장 멤버 줄처럼): Avatar + 문장 + 진행 원
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
  /** 날짜 칸 색(월급날 초록, 월급 전 확인 청록, 챙길 날 분홍, 저금 항목 기한 베이지, 만기 보라) */
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
 * H-05 다가오는 일정: 30일 안 월급날, 월급 전 확인, 챙길 날, 저금 항목 기한, 날짜순 최대 3개.
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
