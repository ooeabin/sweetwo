import {
  fetchGoalLines,
  fetchGoalMoves,
  qk,
  restoreTrash,
  setGoalOwner,
  setGoalPhoto,
  trashGoals,
  updateGoal,
  type Goal,
} from '@sweetwo/api';
import {
  formatDateFull,
  formatMonthDay,
  formatYm,
  goalBars,
  goalProgress,
  todayKst,
} from '@sweetwo/core';
import {
  Badge,
  BarChart,
  Button,
  Icon,
  LineChart,
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
import { PersonDot } from '../../../shared/person';
import { toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { CheckLine } from '../../salary';
import { checkPath, GUIDES, readPath } from '../../settings';
import { copy } from '../copy';
import { GoalArt } from '../goal-art';
import { lateText } from '../goal-item-card';
import { useGoalsModel } from '../model';

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
  // 내 목표로 바꾸기: 화면이 모르는 사이 배우자가 모았으면 서버가 막음(22 ‘목표 종류’)
  const toMine = async () => {
    try {
      const r = await setGoalOwner(g.id, d.meId, 999);
      if (r === 'partner_saved') {
        toast(copy.cantToMine(d.partnerName));
        return void refresh();
      }
      await refresh();
      toast(copy.changedKind, {
        label: copy.undo,
        onClick: () => void setGoalOwner(g.id, null, g.priority).then(refresh),
      });
    } catch {
      toast(copy.loadFailed);
    }
  };
  // 목표 사진 지우기 → 회색 기본 그림(프로필 사진처럼 되돌리기 없음)
  const clearPhoto = async () => {
    try {
      await setGoalPhoto(g.id, null);
      await qc.invalidateQueries({ queryKey: qk.goals });
      toast(copy.photoRemoved);
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
                partnerMoved ? toast(copy.cantToMine(d.partnerName)) : void toMine(),
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

  // 아직 모은 돈이 없으면 지연으로 보지 않음(2026-11-03)
  const late = i.lateMonths !== null && i.lateMonths > 0 && i.saved > 0;
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
  // 9번 진행 그래프(계획 점선, 실제 실선)와 10a번 월별 저금 막대(최근 6개월)
  const today = todayKst();
  const kst = (iso: string) => todayKst(new Date(iso));
  const progress =
    g.kind === 'once'
      ? goalProgress({
          start: kst(g.created_at),
          now: today,
          held: g.other_held,
          monthly: i.monthly,
          flows: [
            ...(lines.data ?? [])
              .filter((l) => l.state === 'checked' && l.pay_checklist)
              .map((l) => ({
                ym: l.pay_checklist?.cycle_start.slice(0, 7) ?? '',
                amount: l.actual ?? l.planned,
              })),
            ...(moves.data ?? []).map((x) => ({
              ym: kst(x.created_at).slice(0, 7),
              amount: x.kind === 'in' ? x.amount : -x.amount,
            })),
          ],
        })
      : [];
  const bars = goalBars(
    records.map((l) => ({
      ym: l.pay_checklist?.cycle_start.slice(0, 7) ?? '',
      planned: l.planned,
      actual: l.state === 'checked' ? (l.actual ?? l.planned) : 0,
    })),
    today,
  );
  const man = (v: number) => Math.round(v / 10_000);
  const barPlanned = bars.reduce((a, b) => a + b.planned, 0);
  const barActual = bars.reduce((a, b) => a + b.actual, 0);
  const barPct = barPlanned ? Math.floor((barActual * 100) / barPlanned) : 100;
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
    // 영역 사이 32px(홈과 같음, 2026-11-03)
    <div key="l" className="hg-stack hg-goaldetail" style={{ gap: 'var(--space-8)' }}>
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
      {/* 2026-11-03 시안 B3(사진 히어로 + 묶음 카드, ANZ·Monzo처럼): 위 사진 꽉 차게 → 둥근 판 위 배지, 이름, 모은 돈,
          버튼 2개 → 목표 카드(목표 금액의 %, 막대, 기한·예상) → 매달 카드(사람별). 숫자 칸(hg-stats)은 이 카드들로 바꿈 */}
      <section className="hg-goalhero" aria-label={g.name}>
        <GoalArt g={i} hero />
        {i.canEdit && (
          <button
            type="button"
            className="hg-goalhero__change"
            onClick={() => nav(`/goals/${id}/photo`)}
          >
            <Icon name="camera" size={16} />
            {copy.photoChange}
          </button>
        )}
        <div className="hg-goalhero__sheet">
          {(kindLabel || late) && (
            <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
              {kindLabel && <Badge kind="temp">{kindLabel}</Badge>}
              {late && <Badge kind="warn">{copy.status.delayed}</Badge>}
            </span>
          )}
          <p className="hg-goalhero__name">{g.name}</p>
          <p className="hg-goalhero__amount">{m(i.saved)}</p>
          {g.photo_path && i.canEdit && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => void clearPhoto()}
            >
              {copy.photoRemove}
            </button>
          )}
          {i.canEdit && (
            <div className="hg-goalhero__actions">
              <Button
                variant="secondary"
                block
                onClick={() => nav(`/goals/${id}/spend`)}
                disabled={i.saved <= 0}
              >
                {copy.use}
              </Button>
              <Button variant="primary" block onClick={() => nav(`/goals/${id}/move`)}>
                {copy.inOut}
              </Button>
            </div>
          )}
        </div>
      </section>
      {g.kind !== 'monthly' && (
        <section className="hg-goalbox" aria-label={copy.numTarget}>
          <div className="hg-goalbox__head">
            <b>
              {g.target_amount !== null
                ? copy.boxTarget(m(g.target_amount), Math.round(i.pct))
                : copy.setAmount}
            </b>
            {i.canEdit && (
              <button
                type="button"
                className="hg-btn hg-btn--link"
                onClick={() =>
                  nav(
                    g.target_amount === null
                      ? `/goals/${id}/set-amount`
                      : `/goals/${id}/edit/amount`,
                  )
                }
              >
                {g.target_amount === null ? copy.boxSet : copy.boxEdit}
              </button>
            )}
          </div>
          {g.target_amount !== null && (
            <div
              className="hg-goalbox__bar"
              role="img"
              aria-label={`${g.name} ${Math.round(i.pct)}%`}
            >
              <i style={{ width: `${Math.min(Math.max(i.pct, i.saved > 0 ? 2 : 0), 100)}%` }} />
            </div>
          )}
          <div className="hg-goalbox__meta">
            {g.kind === 'yearly' ? (
              <>
                <span>{i.nextUse ? copy.yearlyUse(formatYm(i.nextUse)) : copy.noDeadline}</span>
                <span>{copy.round(round)}</span>
              </>
            ) : (
              <>
                {i.canEdit ? (
                  <button
                    type="button"
                    className="hg-goalbox__metabtn"
                    aria-label={`${copy.numDeadline} ${g.deadline ? formatYm(g.deadline) : copy.noDeadline}`}
                    onClick={() => nav(`/goals/${id}/edit/deadline`)}
                  >
                    {g.deadline ? copy.boxUntil(formatYm(g.deadline)) : copy.noDeadline}
                  </button>
                ) : (
                  <span>{g.deadline ? copy.boxUntil(formatYm(g.deadline)) : copy.noDeadline}</span>
                )}
                {g.target_amount !== null && (
                  <span>
                    {i.expected ? copy.boxExpected(formatYm(i.expected)) : copy.expectUnknown}
                  </span>
                )}
              </>
            )}
          </div>
        </section>
      )}
      <section className="hg-goalbox" aria-label={copy.numMonthly}>
        <div className="hg-goalbox__head">
          <b>{copy.boxMonthly(m(i.monthly))}</b>
          {i.canEdit && !pending && (
            <button type="button" className="hg-btn hg-btn--link" onClick={() => nav(splitTo)}>
              {copy.boxChange}
            </button>
          )}
        </div>
        {i.perPerson.length > 1 &&
          i.perPerson.map((p) => (
            <div key={p.userId} className="hg-goalbox__person">
              <PersonDot
                name={p.name}
                starter={p.userId === d.space.created_by}
                userId={p.userId}
                className="hg-avatar--sm"
              />
              <span>{p.name}</span>
              <b>{m(p.amount)}</b>
            </div>
          ))}
      </section>
      {(g.status === 'achieved' || g.status === 'used') && (
        <section className="hg-card hg-card--fill hg-stack">
          <b>
            {g.status === 'used'
              ? // 사용 완료: 꺼내 쓴 돈 합(22 접힌 목록 4번, 2026-11-03)
                copy.spentAll(
                  m(
                    (moves.data ?? [])
                      .filter((x) => x.kind === 'use')
                      .reduce((t, x) => t + x.amount, 0),
                  ),
                )
              : copy.savedAll(m(i.saved))}
          </b>
          {g.status === 'achieved' && i.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => nav(`/goals/${id}/use`)}>
              {copy.usedQ}
            </Button>
          )}
        </section>
      )}
      {progress.length > 1 && (
        <LineChart
          label={copy.graphTitle}
          value={m(i.saved)}
          points={progress.map((p) => ({
            label: formatYm(p.ym),
            value: p.actual,
            expected: p.plan,
            mark: p.milestone,
          }))}
          format={m}
          name={copy.graphActual}
          expectedName={copy.graphPlan}
          expectedText={copy.graphPlanText}
          plotLabel={copy.graphTitle}
        />
      )}
      {/* ‘이미 모은 돈 넣기’는 넣기·빼기 첫 질문으로 합침(입구 하나, 2026-11-03) */}
      {i.thisMonth.length > 0 && (
        <div className="hg-checklist__list">
          {i.thisMonth.map((l) => (
            <CheckLine
              key={l.id}
              line={l}
              goalName={g.name}
              name={
                l.state === 'checked'
                  ? `${formatMonthDay((l.checked_at ?? '').slice(0, 10))}에 ${m(l.actual ?? l.planned)} 넣었어요`
                  : // 두 사람 줄이 있을 때 배우자 줄만 이름(내 줄은 이름 없이, 2026-11-03 내 줄에 배우자 이름이 붙던 문제)
                    `${
                      i.perPerson.length > 1 && (l.user_id ?? d.lineOwner[l.id] ?? null) !== d.meId
                        ? `${d.nameOf(l.user_id ?? d.lineOwner[l.id] ?? null)}님 `
                        : ''
                    }${copy.thisMonthTodo(m(l.planned))}`
              }
              personName={(x) => d.nameOf(x)}
              meId={d.meId}
            />
          ))}
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
      {bars.length > 0 && (
        <BarChart
          label={copy.barsTitle}
          value={m(Math.round(barActual / bars.length))}
          delta={{ dir: barPct >= 100 ? 'up' : 'down', text: copy.barsPct(barPct) }}
          note={copy.barsNote(man(i.monthly))}
          plotLabel={copy.barsTitle}
          bars={bars.map((b) => ({
            key: b.ym,
            label: copy.monthLabel(b.month),
            diff: b.diff,
            diffText: b.diff > 0 ? `+${man(b.diff)}` : b.diff < 0 ? `−${man(-b.diff)}` : '0',
            tip: copy.barTip(b.month, m(b.actual), b.diff, m(Math.abs(b.diff))),
            now: b.now,
          }))}
        />
      )}
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
  return <MainFrame sub="detail" current="goals" columns={[body]} />;
}
