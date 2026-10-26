import {
  fetchGoalLines,
  fetchGoalMoves,
  qk,
  restoreTrash,
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
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { CheckLine } from '../../salary';
import { checkPath, GUIDES, readPath } from '../../settings';
import { copy } from '../copy';
import { GoalArt } from '../goal-art';
import { heldMan, lateText } from '../goal-item-card';
import { useGoalsModel } from '../model';

const tone = (t: string) => (t === 'emergency' ? 'safety' : t === 'invest' ? 'invest' : 'goal');

/** 목표 유형별 도움말 1개(22 G-02 12번). 체크리스트 항목이나 읽을거리 */
const guideTitle = (key: string) => GUIDES.find((x) => x.key === key)?.title ?? '';
const HELP: Record<string, { label: string; to: string } | undefined> = {
  home: { label: copy.helpLabels.home, to: checkPath('subscription') },
  emergency: { label: guideTitle('emergency'), to: readPath('emergency') },
  baby: { label: copy.helpLabels.baby, to: checkPath('baby') },
  retirement: { label: guideTitle('retirement'), to: readPath('retirement') },
  wedding: { label: copy.helpLabels.wedding, to: checkPath('wedding-budget') },
};

// G-02 목표 상세(22). 헤더(종류 이름표, 이름, ⋯, 그림) → 진행 → 숫자 블록 → 이번 달(체크) → 넣기·빼기, 꺼내 쓰기
// → 기한 비교 → 모은 돈 기록 → 정보. ⋯ = 이름 변경, 보류·다시 모으기, 삭제(비상금 없음), 종류 바꾸기. 모두 바로 + 되돌리기.
// 배우자의 내 목표는 보기만. 달성했으면 “400만 원 모았어요” + ‘이 돈을 썼나요?’. 매년 목표는 다음에 쓰는 달·회차.
// 월별 기록(최근 12개월 + 더보기), 정보(만든 날·만든 사람·주인), 도움말(목표 유형별 1개). 진행 그래프·월별 막대·목표 사진은 다음 단계.
export function G02GoalDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useGoalsModel();
  const { masked } = useMask();
  const lines = useQuery({ queryKey: qk.goalLines(id), queryFn: () => fetchGoalLines(id) });
  const moves = useQuery({ queryKey: qk.goalMoves(id), queryFn: () => fetchGoalMoves(id) });
  const [all, setAll] = useState(false);
  const m = (v: number) => money(v, masked);
  const back = () => nav('/goals');
  if (!d.ready) return <LoadingFrame current="goals" />;
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
                  toast(copy.removed, {
                    label: copy.undo,
                    onClick: () => void restoreTrash('goal', g.id).then(refresh),
                  });
                  back();
                }),
          },
        ]),
  ];

  const late = i.lateMonths !== null && i.lateMonths > 0;
  // 매년 목표 회차 = 만든 해부터 센 해(쓰는 달이 지난 해마다 1씩) [확인 필요]
  const round = Math.max(
    (i.nextUse ? Number(i.nextUse.slice(0, 4)) : new Date().getFullYear()) -
      Number(g.created_at.slice(0, 4)) +
      (i.nextUse && i.nextUse.slice(0, 4) === g.created_at.slice(0, 4) ? 1 : 0),
    1,
  );
  const pending = d.space.couple_state === 'unlink_pending';
  // 매달 넣을 돈 바꾸기 → W-01 이 목표 주인 탭(우리 목표는 내 탭)
  const splitTo = `/salary/split${g.owner_user_id && g.owner_user_id !== d.meId ? `?who=${g.owner_user_id}` : ''}`;
  const help = HELP[g.template];
  // 월별 기록: 체크리스트 달마다 저금 줄 금액, 넣은 돈, 상태(최근 것부터)
  const records = (lines.data ?? [])
    .filter((l) => l.pay_checklist)
    .sort((a, b) =>
      (a.pay_checklist?.cycle_start ?? '') < (b.pay_checklist?.cycle_start ?? '') ? 1 : -1,
    );
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
      : g.kind === 'yearly'
        ? ([
            [copy.numNextUse, i.nextUse ? formatYm(i.nextUse) : copy.noDeadline, 'deadline'],
            [copy.numRound, copy.round(round)],
          ] as [string, string, string?][])
        : []),
  ];
  const perPerson =
    i.perPerson.length > 1 ? i.perPerson.map((p) => `${p.name} ${m(p.amount)}`).join(' + ') : null;

  // 모은 돈 기록: 이미 모은 돈, 저금 줄(체크·못 함), 넣기·빼기·꺼내 쓰기
  type Row = { key: string; at: string; label: string; value: string; who?: string | null };
  const history: Row[] = [
    ...(lines.data ?? [])
      .filter((l) => l.state !== 'wait')
      .map((l) => ({
        key: l.id,
        at: l.checked_at ?? '',
        label: copy.historyChecked(l.pay_checklist?.label ?? ''),
        value: l.state === 'skipped' ? copy.historySkipped : `+${m(l.actual ?? l.planned)}`,
        who: l.checked_by,
      })),
    ...(moves.data ?? []).map((x) => ({
      key: x.id,
      at: x.created_at,
      label:
        x.kind === 'in' ? copy.historyIn : x.kind === 'out' ? copy.historyOut : copy.historyUse,
      value: `${x.kind === 'in' ? '+' : '−'}${m(x.amount)}`,
      who: x.created_by,
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
      {(g.status === 'achieved' || g.status === 'used') && (
        <section className="hg-card hg-card--fill hg-stack">
          <b>{copy.savedAll(m(i.saved))}</b>
          {g.status === 'achieved' && i.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => nav(`/goals/${id}/use`)}>
              {copy.usedQ}
            </Button>
          )}
        </section>
      )}
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
          <Button variant="ghost" disabled={pending} onClick={() => nav(splitTo)}>
            {copy.changeMonthly}
          </Button>
        </div>
      )}
      {g.kind === 'once' && g.deadline && g.target_amount !== null && i.lateMonths !== null && (
        <section className="hg-card hg-card--fill hg-stack">
          <b>{late ? copy.lateLine(lateText(i.lateMonths)) : copy.onTime}</b>
          {late && <span className="hg-card__meta">{copy.lateHelp}</span>}
          {late && i.canEdit && !pending && (
            <Button variant="secondary" size="sm" onClick={() => nav(splitTo)}>
              {copy.changeMonthly}
            </Button>
          )}
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
                sub={
                  r.at
                    ? r.who && !d.solo
                      ? copy.byWho(formatDateFull(r.at.slice(0, 10)), d.nameOf(r.who))
                      : formatDateFull(r.at.slice(0, 10))
                    : undefined
                }
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
      {records.length > 0 && (
        <section className="hg-stack" aria-label={copy.records}>
          <SectionHeader title={copy.records} />
          <table className="hg-table">
            <thead>
              <tr>
                <th scope="col">{copy.recordMonth}</th>
                <th scope="col">{copy.recordPlanned}</th>
                <th scope="col">{copy.recordPut}</th>
                <th scope="col">{copy.recordStateTitle}</th>
              </tr>
            </thead>
            <tbody>
              {(all ? records : records.slice(0, 12)).map((l) => (
                <tr key={l.id}>
                  <td>{l.pay_checklist?.label}</td>
                  <td>{m(l.planned)}</td>
                  <td>{l.state === 'checked' ? m(l.actual ?? l.planned) : '-'}</td>
                  <td>
                    {
                      copy.recordState[
                        l.state === 'checked' && l.actual !== null && l.actual !== l.planned
                          ? 'other'
                          : l.state
                      ]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      )}
      <section className="hg-stack" aria-label={copy.info}>
        <SectionHeader title={copy.info} />
        <div className="hg-list">
          <ListRow label={copy.createdAt} value={formatDateFull(g.created_at.slice(0, 10))} />
          {!d.solo && g.created_by && (
            <ListRow label={copy.createdBy} value={d.nameOf(g.created_by)} chevron={false} />
          )}
          {!d.solo && g.owner_user_id && (
            <ListRow label={copy.ownerOf} value={d.nameOf(g.owner_user_id)} chevron={false} />
          )}
        </div>
      </section>
      {help && (
        <section className="hg-stack" aria-label={copy.help}>
          <SectionHeader title={copy.help} />
          <div className="hg-list">
            <ListRow label={help.label} onClick={() => nav(help.to)} />
          </div>
        </section>
      )}
    </div>
  );
  return <MainFrame current="goals" columns={[body]} />;
}
