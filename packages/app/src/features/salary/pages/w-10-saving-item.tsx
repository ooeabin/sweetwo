import { fetchGoalLines, qk, restoreTrash, trashGoals } from '@sweetwo/api';
import { formatDateFull, formatYm } from '@sweetwo/core';
import {
  Badge,
  Button,
  ListRow,
  Menu,
  PageHeader,
  SectionHeader,
  type MenuAction,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { CheckLine } from '../check-line';
import { copy } from '../copy';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems } from '../saving';
import { AchieveWatch } from '../saving-parts';
import { AfterChoice } from './w-12a-saving-after';

// W-10 저금 항목 상세(20, ADR 0007). 머리(‹ 이름 ⋯) → 모은 돈 → 목표 금액 카드(진행, 기한, 월 필요액)
// → 매달 카드(매달 금액 + 이번 달 줄) → (달성했는데 아직 고르지 않았으면) 달성 뒤 질문 → 모은 기록 → 정보.
// ⋯ = 이름 바꾸기, 지우기(묻지 않고 휴지통 + 되돌리기). 파트너 저금 항목(각자)은 보기만. 그만 모은 항목은 기록만.
export function W10SavingItem() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const { masked } = useMask();
  const lines = useQuery({ queryKey: qk.goalLines(id), queryFn: () => fetchGoalLines(id) });
  const [all, setAll] = useState(false);
  const m = (v: number) => money(v, masked);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  if (!d.ready) return <LoadingFrame current="salary" sub="detail" />;
  const i = d.byId(id);
  // 방금 추가한 항목은 목록을 다시 받을 때까지 기다림
  if (!i && d.fetching) return <LoadingFrame current="salary" sub="detail" />;
  if (!i) return <Navigate to={salaryPaths.checklist} replace />;
  const g = i.goal;
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved, qk.trash].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  const nameOf = (uid: string | null) => (uid === d.meId ? d.myName : uid ? d.partnerName : '');
  const closed = i.state === 'closed';
  const actions: MenuAction[] = [
    ...(closed ? [] : [{ label: copy.rename, onSelect: () => nav(savingPaths.edit(id, 'name')) }]),
    {
      label: copy.remove,
      danger: true,
      onSelect: () =>
        void trashGoals([g.id])
          .then(refresh)
          .then(() => {
            toast(copy.removed, {
              label: copy.undo,
              onClick: () => quietly(restoreTrash('goal', g.id).then(refresh)),
            });
            nav(salaryPaths.checklist, { replace: true });
          })
          .catch(() => toast(copy.loadFailed)),
    },
  ];
  // 매달 금액 바꾸기 → 이 줄 금액만(W-10a monthly, 2026-11-09 round 3 W-01 전체 대신)
  const splitTo = savingPaths.edit(id, 'monthly');
  // 모은 기록: 체크리스트 달마다(최근 것부터), 체크 안 한 이번 달 줄은 빼고
  const records = (lines.data ?? [])
    .filter((l) => l.pay_checklist && l.state !== 'wait')
    .sort((a, b) =>
      (a.pay_checklist?.cycle_start ?? '') < (b.pay_checklist?.cycle_start ?? '') ? 1 : -1,
    );
  const recordText = (l: (typeof records)[number]) => {
    const label = l.pay_checklist?.label ?? '';
    if (l.state === 'skipped') return copy.historySkipped(label);
    const v = l.actual ?? l.planned;
    return l.actual !== null && l.actual !== l.planned
      ? copy.historyOther(label, m(v))
      : copy.historyChecked(label, m(v));
  };

  const body = (
    <div key="l" className="hg-stack hg-goaldetail" style={{ gap: 'var(--space-8)' }}>
      <AchieveWatch />
      <PageHeader
        title={g.name}
        backLabel={copy.back}
        backTo={copy.tabTitle}
        onBack={back}
        action={i.canEdit ? <Menu label={copy.menu} actions={actions} /> : undefined}
      />
      <section className="hg-goalbox" aria-label={copy.savedLabel}>
        <span className="hg-card__label">{copy.savedLabel}</span>
        <p className="hg-goalhero__amount">{m(i.saved)}</p>
        {i.owner === 'partner' && <p className="hg-help">{copy.partnerItem(i.ownerName)}</p>}
        {closed && <p className="hg-help">{copy.closedNote}</p>}
      </section>
      {!closed &&
        (i.target !== null ? (
          <section className="hg-goalbox" aria-label={copy.setTarget}>
            <div className="hg-goalbox__head">
              <b>
                {i.state === 'achieved'
                  ? copy.reachedAll(m(i.target))
                  : copy.targetOf(m(i.target), i.pct ?? 0)}
              </b>
              {i.state === 'achieved' ? (
                <Badge kind="achieved">{copy.achieved}</Badge>
              ) : (
                i.canEdit && (
                  <button
                    type="button"
                    className="hg-btn hg-btn--link"
                    onClick={() => nav(savingPaths.edit(id, 'amount'))}
                  >
                    {copy.edit}
                  </button>
                )
              )}
            </div>
            {i.state !== 'achieved' && (
              <div className="hg-goalbox__bar" role="img" aria-label={`${g.name} ${i.pct ?? 0}%`}>
                <i style={{ width: `${i.bar}%` }} />
              </div>
            )}
            {i.state !== 'achieved' && (
              <div className="hg-goalbox__meta">
                {i.deadline ? (
                  i.canEdit ? (
                    <button
                      type="button"
                      className="hg-goalbox__metabtn"
                      onClick={() => nav(savingPaths.edit(id, 'deadline'))}
                    >
                      {copy.until(formatYm(i.deadline))}
                    </button>
                  ) : (
                    <span>{copy.until(formatYm(i.deadline))}</span>
                  )
                ) : i.canEdit ? (
                  <button
                    type="button"
                    className="hg-btn hg-btn--link hg-btn--accent"
                    onClick={() => nav(savingPaths.edit(id, 'deadline'))}
                  >
                    {copy.setDeadline}
                  </button>
                ) : (
                  <span />
                )}
                {i.eta && <span>{copy.expected(formatYm(i.eta))}</span>}
              </div>
            )}
            {i.state !== 'achieved' && i.need !== null && (
              <span className="hg-goalbox__sub">{copy.needPerMonth(m(i.need))}</span>
            )}
            {/* 월 필요액 > 매달 금액이면 사실 한 줄 + 할 일(2026-11-09, 배지 아님) */}
            {i.state !== 'achieved' && i.late !== null && (
              <>
                <span className="hg-goalbox__sub">{copy.lateBy(i.late)}</span>
                {i.canEdit && (
                  <span className="hg-row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="hg-btn hg-btn--link"
                      onClick={() => nav(splitTo)}
                    >
                      {copy.changeMonthly}
                    </button>
                    <button
                      type="button"
                      className="hg-btn hg-btn--link"
                      onClick={() => nav(savingPaths.edit(id, 'deadline'))}
                    >
                      {copy.changeDeadline}
                    </button>
                  </span>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="hg-card hg-card--fill hg-stack" aria-label={copy.setTarget}>
            <span className="hg-card__meta">{copy.noTarget}</span>
            {i.canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => nav(`${savingPaths.edit(id, 'amount')}?first=1`)}
              >
                {copy.setTarget}
              </Button>
            )}
          </section>
        ))}
      {!closed && (
        <section className="hg-goalbox" aria-label={copy.monthlyOf(m(i.monthly))}>
          <div className="hg-goalbox__head">
            <b>{copy.monthlyOf(m(i.monthly))}</b>
            {i.canEdit && (
              <button type="button" className="hg-btn hg-btn--link" onClick={() => nav(splitTo)}>
                {copy.change}
              </button>
            )}
          </div>
          {i.thisMonth && (
            <div className="hg-checklist__list">
              <CheckLine
                line={i.thisMonth}
                goalName={g.name}
                name={copy.thisMonth}
                personName={nameOf}
                meId={d.meId}
                // 각자 모드 파트너 줄은 보기만(2026-11-03 대신 체크 없앰)
                viewOnly={i.owner === 'partner'}
              />
            </div>
          )}
        </section>
      )}
      {/* 달성했는데 아직 고르지 않았으면 W-12a와 같은 질문(20 W-10 5번) */}
      {i.state === 'achieved' && i.canEdit && <AfterChoice item={i} />}
      <section className="hg-stack" aria-label={copy.history}>
        <SectionHeader title={copy.history} />
        {records.length || g.start_saved > 0 ? (
          <div className="hg-list">
            {(all ? records : records.slice(0, 12)).map((l) => (
              <ListRow
                key={l.id}
                label={recordText(l)}
                sub={
                  l.checked_at && d.joint && l.checked_by
                    ? `${formatDateFull(l.checked_at.slice(0, 10))}, ${nameOf(l.checked_by)}`
                    : l.checked_at
                      ? formatDateFull(l.checked_at.slice(0, 10))
                      : undefined
                }
              />
            ))}
            {/* 시작할 때 모은 돈(2026-11-09): 기록의 처음이라 최근 것부터 보여 주는 목록 맨 아래, 더보기와 상관없이 늘 */}
            {g.start_saved > 0 && (
              <ListRow
                label={copy.historyStart(m(g.start_saved))}
                sub={formatDateFull(g.created_at.slice(0, 10))}
              />
            )}
          </div>
        ) : (
          <p className="hg-help" style={{ margin: 0 }}>
            {copy.noHistory}
          </p>
        )}
        {!all && records.length > 12 && (
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setAll(true)}
          >
            {copy.more}
          </button>
        )}
      </section>
      <section className="hg-stack" aria-label={copy.info}>
        <SectionHeader title={copy.info} />
        <div className="hg-list">
          <ListRow label={copy.createdOn(formatDateFull(g.created_at.slice(0, 10)))} />
          {d.joined && g.created_by && <ListRow label={copy.createdBy(nameOf(g.created_by))} />}
        </div>
      </section>
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
