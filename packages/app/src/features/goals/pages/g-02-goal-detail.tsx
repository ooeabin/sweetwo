import {
  fetchGoalLines,
  fetchGoalMoves,
  qk,
  trashGoals,
  updateGoal,
  type Goal,
} from '@sweetwo/api';
import { formatDateFull, formatMonthDay, formatYm } from '@sweetwo/core';
import {
  Badge,
  Button,
  ListRow,
  Menu,
  Meter,
  PageHeader,
  SectionHeader,
  type MenuAction,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { CheckLine } from '../../salary';
import { copy } from '../copy';
import { GoalArt } from '../goal-art';
import { heldMan, lateText } from '../goal-item-card';
import { useGoalsModel } from '../model';

const tone = (t: string) => (t === 'emergency' ? 'safety' : t === 'invest' ? 'invest' : 'goal');

// G-02 목표 상세(22). 헤더(종류 이름표, 이름, ⋯, 그림) → 진행 → 숫자 블록 → 이번 달(체크) → 넣기·빼기, 꺼내 쓰기
// → 기한 비교 → 모은 돈 기록 → 정보. ⋯ = 이름 변경, 보류·다시 모으기, 삭제(비상금 없음), 종류 바꾸기. 모두 바로 + 되돌리기.
// 배우자의 내 목표는 보기만. 진행 그래프, 월별 막대, 목표 사진, 상대 알림은 다음 단계.
export function G02GoalDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const { masked } = useMask();
  const lines = useQuery({ queryKey: qk.goalLines(id), queryFn: () => fetchGoalLines(id) });
  const moves = useQuery({ queryKey: qk.goalMoves(id), queryFn: () => fetchGoalMoves(id) });
  const m = (v: number) => money(v, masked);
  const back = () => nav('/goals');
  if (!d.ready) return <MainFrame current="goals" columns={[<div key="l" />]} />;
  const i = d.byId(id);
  if (!i) return <Navigate to="/goals" replace />;
  const g = i.goal;

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.goals }),
      qc.invalidateQueries({ queryKey: qk.splits }),
      qc.invalidateQueries({ queryKey: ['pay_checklist'] }),
      qc.invalidateQueries({ queryKey: qk.goalSaved }),
    ]);
  /** 바로 고치고 Toast + 되돌리기 */
  const change = async (patch: Partial<Goal>, done: string, after?: () => void) => {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, g[k as keyof Goal]]));
    try {
      await updateGoal(g.id, patch);
      await refresh();
      toast(done, {
        label: copy.undo,
        onClick: () => void updateGoal(g.id, before).then(refresh),
      });
      after?.();
    } catch {
      toast(copy.loadFailed);
    }
  };
  const emergency = g.template === 'emergency';
  const paused = g.status === 'paused';
  const partnerMoved =
    (lines.data ?? []).some(
      (l) => l.checked_by && l.checked_by !== d.meId && l.state === 'checked',
    ) || (moves.data ?? []).some((x) => x.created_by && x.created_by !== d.meId);
  const kindActions: MenuAction[] =
    d.solo || emergency
      ? []
      : g.owner_user_id === null
        ? [
            {
              label: copy.toMine,
              onSelect: () =>
                partnerMoved
                  ? toast(copy.cantToMine(d.partnerName))
                  : void change({ owner_user_id: d.meId, priority: 999 }, copy.changedKind),
            },
          ]
        : [
            {
              label: copy.toOurs,
              onSelect: () => void change({ owner_user_id: null, priority: 999 }, copy.changedKind),
            },
          ];
  const actions: MenuAction[] = [
    { label: copy.rename, icon: 'pencil', onSelect: () => nav(`/goals/${id}/edit/name`) },
    ...(emergency
      ? []
      : [
          {
            label: paused ? copy.resume : copy.pause,
            onSelect: () =>
              void change(
                { status: paused ? 'active' : 'paused' },
                paused ? copy.resumed : copy.paused,
              ),
          },
        ]),
    ...kindActions,
    ...(emergency
      ? []
      : [
          {
            label: copy.remove,
            icon: 'trash-2' as const,
            danger: true,
            onSelect: () =>
              void trashGoals([g.id])
                .then(refresh)
                .then(() => {
                  toast(copy.removed);
                  back();
                }),
          },
        ]),
  ];

  const late = i.lateMonths !== null && i.lateMonths > 0;
  const numbers: [string, string, string?][] = [
    ...(g.kind !== 'monthly' && g.target_amount !== null
      ? ([
          [copy.numTarget, m(g.target_amount), 'amount'],
          [copy.numSaved, m(i.saved)],
          [copy.numLeft, m(Math.max(g.target_amount - i.saved, 0))],
        ] as [string, string, string?][])
      : ([[copy.numSaved, m(i.saved)]] as [string, string, string?][])),
    [copy.numMonthly, m(i.monthly)],
    ...(g.kind === 'once'
      ? ([
          [copy.numDeadline, g.deadline ? formatYm(g.deadline) : copy.noDeadline, 'deadline'],
          ...(g.target_amount !== null
            ? [[copy.numExpected, i.expected ? formatYm(i.expected) : copy.expectUnknown]]
            : []),
        ] as [string, string, string?][])
      : []),
  ];
  const perPerson =
    i.perPerson.length > 1 ? i.perPerson.map((p) => `${p.name} ${m(p.amount)}`).join(' + ') : null;

  // 모은 돈 기록: 이미 모은 돈, 저금 줄(체크·못 함), 넣기·빼기·꺼내 쓰기
  type Row = { key: string; at: string; label: string; value: string };
  const history: Row[] = [
    ...(lines.data ?? [])
      .filter((l) => l.state !== 'wait')
      .map((l) => ({
        key: l.id,
        at: l.checked_at ?? '',
        label: copy.historyChecked(l.pay_checklist?.label ?? ''),
        value: l.state === 'skipped' ? copy.historySkipped : `+${m(l.actual ?? l.planned)}`,
      })),
    ...(moves.data ?? []).map((x) => ({
      key: x.id,
      at: x.created_at,
      label:
        x.kind === 'in' ? copy.historyIn : x.kind === 'out' ? copy.historyOut : copy.historyUse,
      value: `${x.kind === 'in' ? '+' : '−'}${m(x.amount)}`,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  if (g.other_held > 0)
    history.push({
      key: 'held',
      at: g.created_at,
      label: copy.historyHeld,
      value: `+${m(g.other_held)}`,
    });

  const kindLabel = d.solo
    ? null
    : i.group === 'ours'
      ? copy.kindOurs
      : i.group === 'mine'
        ? copy.kindMine
        : copy.kindPartner(d.partnerName);
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={g.name}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={back}
        action={i.canEdit ? <Menu label={copy.menu} actions={actions} /> : undefined}
      />
      {!i.canEdit && <p className="hg-help">{copy.viewOnly}</p>}
      {paused && (
        <div className="hg-banner hg-banner--info">
          <span>{copy.pausedNote}</span>
          {i.canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void change({ status: 'active' }, copy.resumed)}
            >
              {copy.resume}
            </Button>
          )}
        </div>
      )}
      <section className="hg-card hg-card--art hg-stack" aria-label={g.name}>
        <span className="hg-card__top">
          <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
            {kindLabel && <Badge kind="temp">{kindLabel}</Badge>}
            {late && <Badge kind="warn">{copy.status.delayed}</Badge>}
          </span>
        </span>
        <GoalArt g={i} />
        {g.kind !== 'monthly' && (
          <Meter
            name={g.name}
            sub={
              g.target_amount
                ? copy.heldOf(heldMan(i.saved, masked), heldMan(g.target_amount, masked))
                : undefined
            }
            pct={i.pct}
            tone={tone(g.template)}
          />
        )}
      </section>
      <div className="hg-stats">
        {numbers.map(([label, value, field]) => {
          const inner = (
            <>
              <span className="hg-stat__label">{label}</span>
              <span className="hg-stat__value">{value}</span>
              {label === copy.numMonthly && perPerson && (
                <span className="hg-stat__sub">{perPerson}</span>
              )}
            </>
          );
          return field && i.canEdit ? (
            <button
              key={label}
              type="button"
              className="hg-stat"
              onClick={() => nav(`/goals/${id}/edit/${field}`)}
            >
              {inner}
            </button>
          ) : (
            <div key={label} className="hg-stat">
              {inner}
            </div>
          );
        })}
      </div>
      {i.canEdit && history.length === 0 && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => nav(`/goals/${id}/move/held`)}
        >
          {copy.addHeld}
        </button>
      )}
      {i.thisMonth.length > 0 && (
        <div className="hg-checklist__list">
          {i.thisMonth.map((l) => (
            <CheckLine
              key={l.id}
              line={l}
              name={
                l.state === 'checked'
                  ? `${formatMonthDay((l.checked_at ?? '').slice(0, 10))}에 ${m(l.actual ?? l.planned)} 넣었어요`
                  : `${i.perPerson.length > 1 ? `${d.nameOf(l.user_id ?? null)}님 ` : ''}${copy.thisMonthTodo(m(l.planned))}`
              }
              personName={(x) => d.nameOf(x)}
              meId={d.meId}
            />
          ))}
        </div>
      )}
      {i.canEdit && (
        <div className="hg-row" style={{ gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={() => nav(`/goals/${id}/move`)}>
            {copy.inOut}
          </Button>
          <Button
            variant="secondary"
            onClick={() => nav(`/goals/${id}/spend`)}
            disabled={i.saved <= 0}
          >
            {copy.use}
          </Button>
          <Button variant="ghost" onClick={() => nav('/salary/split')}>
            {copy.changeMonthly}
          </Button>
        </div>
      )}
      {g.kind === 'once' && g.deadline && g.target_amount !== null && i.lateMonths !== null && (
        <section className="hg-card hg-card--fill hg-stack">
          <b>{late ? copy.lateLine(lateText(i.lateMonths)) : copy.onTime}</b>
          {late && <span className="hg-card__meta">{copy.lateHelp}</span>}
        </section>
      )}
      <section className="hg-stack" aria-label={copy.history}>
        <SectionHeader title={copy.history} />
        {history.length ? (
          <div className="hg-list">
            {history.map((r) => (
              <ListRow
                key={r.key}
                label={r.label}
                sub={r.at ? formatDateFull(r.at.slice(0, 10)) : undefined}
                value={r.value}
              />
            ))}
          </div>
        ) : (
          <p className="hg-help" style={{ margin: 0 }}>
            {copy.noHistory}
          </p>
        )}
      </section>
      <section className="hg-stack" aria-label={copy.info}>
        <SectionHeader title={copy.info} />
        <div className="hg-list">
          <ListRow label={copy.createdAt} value={formatDateFull(g.created_at.slice(0, 10))} />
        </div>
      </section>
    </div>
  );
  return <MainFrame current="goals" columns={[body]} />;
}
