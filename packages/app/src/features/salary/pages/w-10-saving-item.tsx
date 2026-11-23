import { fetchGoalLines, qk, restoreTrash, trashGoals } from '@sweetwo/api';
import { formatDateFull, formatYm, kstDateOf as kstDay, savingRemain } from '@sweetwo/core';
import {
  Badge,
  Button,
  Icon,
  ListRow,
  Menu,
  PageHeader,
  SectionHeader,
  SkelRows,
  type MenuAction,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { CheckLine } from '../check-line';
import { copy } from '../copy';
import { planPath, salaryPaths, savingPaths, togetherPaths } from '../paths';
import { BundleCard } from '../bundle-parts';
import {
  bundleOfGoal,
  useBundles,
  useGoalMoves,
  useMoveReasons,
  useTogetherRealtime,
} from '../together';
import { BundleAchieveWatch } from './w-12-bundle-achieved';
import { useSavingRealtime } from '../data';
import { trackSharedGoal, useSavingItems } from '../saving';
import { AchieveWatch, SavingAskSheet, SavingLoadError } from '../saving-parts';
import { AfterChoice } from './w-12a-saving-after';

// W-10 저금 항목 상세(20, ADR 0007). 머리(‹ 이름 ⋯) → 저금 한 카드(모은 금액 + 막대 + 목표 금액 한 줄, 나머지 ‘자세히 보기’, 2026-11-15)
// → 매달 카드(매달 금액 + 이번 달 줄) → (달성했는데 아직 고르지 않았으면) 달성 뒤 질문 → 저금 내역 → 정보.
// ⋯ = 이름 바꾸기, 지우기(묻지 않고 휴지통 + 되돌리기). 파트너 저금 항목(각자)은 보기만. 그만 모은 항목은 기록만.
// 합쳐서 모드는 주인이 있는 저금도 두 사람 모두 고침(2026-11-12 D1). 보기만·그만 모음·해제 대기 안내는 머리 아래 회색 한 줄(S7-08·S7-09),
// 해제 대기 중 고치기 버튼은 비활성. 모은 금액을 누르면 저금 내역으로(S7-10). 상대 변경은 Realtime(S7-02)
export function W10SavingItem() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const { masked } = useMask();
  const lines = useQuery({ queryKey: qk.goalLines(id), queryFn: () => fetchGoalLines(id) });
  const [all, setAll] = useState(false);
  // 저금 카드 ‘자세히 보기’(기한, 월 필요액, 예상, 남은 금액). 처음엔 접힘(2026-11-15 3차 검토)
  const [more, setMore] = useState(false);
  const historyRef = useRef<HTMLElement>(null);
  const [params, setParams] = useSearchParams();
  const bundles = useBundles();
  const moves = useGoalMoves(id);
  const reasons = useMoveReasons(id);
  useSavingRealtime(d.ready ? d.space.id : null);
  useTogetherRealtime(d.ready ? d.space.id : null);
  const m = (v: number) => money(v, masked);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  // 못 불러오면 오류 카드 + 다시 시도(13 공통 상태 7번, 2026-11-12 S7-04)
  if (!d.ready && d.failed) return <SavingLoadError onBack={back} onRetry={d.retry} />;
  if (!d.ready) return <LoadingFrame current="salary" sub="detail" />;
  const i = d.byId(id);
  // 방금 추가한 항목은 목록을 다시 받을 때까지 기다림
  if (!i && d.fetching) return <LoadingFrame current="salary" sub="detail" />;
  if (!i) return <Navigate to={salaryPaths.checklist} replace />;
  const g = i.goal;
  // 묶음(각자 계열 같이 모으기, 2026-11-13): 맨 위 묶음 카드. 상대 저금은 각자 금액을 둘 다 켰을 때만 금액을 보여 줌(G1, 서버도 자름)
  const bundle = bundleOfGoal(bundles.data, id);
  const hideAmounts =
    i.owner === 'partner' && !!g.bundle_id && !(bundle?.show_each && !bundle.percent_only);
  const ask = params.get('ask');
  const closeAsk = () => {
    params.delete('ask');
    setParams(params, { replace: true });
  };
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved, qk.trash].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  const nameOf = (uid: string | null) => (uid === d.meId ? d.myName : uid ? d.partnerName : '');
  const closed = i.state === 'closed';
  // 같이 계열(합쳐서 + 연결, 공동 저금): 월 필요액은 둘이 같이(2026-11-14)
  const together = (d.joint && d.joined) || i.owner === 'ours';
  // 해제 대기 중: 고칠 수 있는 사람에게도 버튼은 보이되 비활성(20 W-10 예외, S7-09)
  const locked = i.mayEdit && d.pending;
  const showEdit = i.canEdit || locked;
  const toHistory = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    historyRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  // v2.2 ⋯: 모은 금액 바로잡기, 쓸 곳 메모, 같이 모으기 시작하기(각자 계열 + 연결 + 내 저금 + 아직 안 묶음)
  const canBundle =
    !d.joint && d.space.couple_state === 'connected' && i.owner === 'mine' && !g.bundle_id;
  const actions: MenuAction[] = [
    ...(closed ? [] : [{ label: copy.rename, onSelect: () => nav(savingPaths.edit(id, 'name')) }]),
    { label: copy.menuAdjust, onSelect: () => nav(`${togetherPaths.adjust(id)}/1`) },
    ...(closed
      ? []
      : [
          {
            label: copy.menuNotes,
            // 묶인 저금은 묶음 메모(둘이 같이 봄), 아니면 이 저금 메모
            onSelect: () =>
              nav(g.bundle_id ? togetherPaths.bundleNotes(g.bundle_id) : togetherPaths.notes(id)),
          },
        ]),
    ...(canBundle && !closed
      ? [{ label: copy.menuBundle, onSelect: () => nav(togetherPaths.bundleNew(id)) }]
      : []),
    {
      label: copy.remove,
      danger: true,
      onSelect: () =>
        void trashGoals([g.id])
          .then(refresh)
          .then(() => {
            trackSharedGoal(d);
            carryToast(copy.removed, {
              label: copy.undo,
              onClick: () => quietly(restoreTrash('goal', g.id).then(refresh)),
            });
            nav(salaryPaths.checklist, { replace: true });
          })
          .catch(() => toast(copy.loadFailed)),
    },
  ];
  // 목표 금액 줄은 그만 모은 저금이 아닐 때만
  const showTarget = !closed;
  const remain = savingRemain({ target: i.target, saved: i.saved, deadline: g.deadline });
  // ‘매달 금액 바꾸기’ → W-01 영수증에서 이 저금 줄 금액 시트를 연 채(2026-11-09, 여유 자금을 같이 봄)
  const splitTo = planPath({ line: id });
  // 저금 내역: 체크리스트 달마다(최근 것부터), 체크 안 한 이번 달 줄은 빼고
  const records = (lines.data ?? [])
    .filter((l) => l.pay_checklist && l.state !== 'wait')
    .sort((a, b) =>
      (a.pay_checklist?.cycle_start ?? '') < (b.pay_checklist?.cycle_start ?? '') ? 1 : -1,
    );
  // 돈 움직임(수입 적기, 자동 넣기, 바로잡기, 잔액 맞추기, 냈어요 −, 2026-11-13). 사유 글은 넣은 사람에게만(goal_move_reasons)
  // 모은 내역 줄(2026-11-23 바탕 기준): 이름 + 날짜, 오른쪽 “+30만 원”(빼기는 −)
  const moveRow = (x: NonNullable<typeof moves.data>[number]) => {
    const sign = x.kind === 'in' ? '+' : '−';
    const name = x.money_in_id
      ? copy.historyMoneyInName
      : x.reason_code === 'auto'
        ? copy.historyAutoName
        : x.reason_code === 'reconcile'
          ? copy.historyReconcileName
          : x.reason_code === 'note_paid'
            ? copy.historyNotePaidName
            : copy.historyAdjustName;
    return { label: name, value: `${sign}${m(x.amount)}` };
  };
  const recordRow = (l: (typeof records)[number]) => {
    const label = l.pay_checklist?.label ?? '';
    if (l.state === 'skipped') return { label: copy.historySkipped(label), value: undefined };
    const v = l.actual ?? l.planned;
    // 나가는 날 앱이 자동 확인한 줄(checked_by 없음)은 “자동으로 넣었어요”(2026-11-23, 날짜 없는 사람 자동 넣기와 같은 말)
    if (l.auto && l.state === 'checked' && !l.checked_by)
      return { label: copy.historyAutoName, value: `+${m(v)}` };
    return {
      label: l.actual !== null && l.actual !== l.planned ? copy.historyOtherName(label) : label,
      value: `+${m(v)}`,
    };
  };
  const history = [
    ...records.map((l) => ({
      key: l.id,
      at: l.checked_at ?? `${l.pay_checklist?.cycle_start ?? ''}T00:00:00+09:00`,
      ...recordRow(l),
      to: undefined as string | undefined,
      sub:
        l.checked_at && d.joint && l.checked_by
          ? `${formatDateFull(kstDay(l.checked_at))}, ${nameOf(l.checked_by)}`
          : l.checked_at
            ? formatDateFull(kstDay(l.checked_at))
            : undefined,
    })),
    ...(moves.data ?? [])
      .filter((x) => x.reason_code !== null)
      .map((x) => ({
        key: x.id,
        at: x.created_at,
        ...moveRow(x),
        sub: [formatDateFull(kstDay(x.created_at)), reasons.data?.[x.id]]
          .filter(Boolean)
          .join(', '),
        // 내가 적은 수입 적기 줄은 수입 기록(W-20b)에서 고치기·지우기(2026-11-14 M6)
        to: x.money_in_id && x.created_by === d.meId ? togetherPaths.moneyInList : undefined,
      })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const body = (
    <div key="l" className="hg-stack hg-goaldetail" style={{ gap: 0 }}>
      <AchieveWatch />
      <PageHeader
        title={g.name}
        backLabel={copy.back}
        backTo={copy.tabTitle}
        onBack={back}
        action={i.canEdit ? <Menu label={copy.menu} actions={actions} /> : undefined}
      />
      <div className="hg-page hg-page--w10">
        {/* 맨 위 회색 한 줄(W-01 파트너 탭과 같음, 2026-11-12 S7-08·S7-09) */}
        {!i.mayEdit ? (
          <p className="hg-q__help" style={{ margin: 0 }}>
            {hideAmounts ? copy.partnerBundleItem(i.ownerName) : copy.partnerItem(i.ownerName)}
          </p>
        ) : closed ? (
          <p className="hg-q__help" style={{ margin: 0 }}>
            {copy.closedNote}
          </p>
        ) : (
          locked && (
            <p className="hg-q__help" style={{ margin: 0 }}>
              {copy.itemPending}
            </p>
          )
        )}
        {/* 묶음 카드(20 W-10 0번): 합계, 각자 금액은 둘 다 켰을 때, 퍼센트만이면 %. ⋯ → W-15a */}
        {bundle && (
          <BundleCard
            bundle={bundle}
            masked={masked}
            myName={d.myName}
            partnerName={d.partnerName}
            share={i.owner === 'mine' ? i.saved : null}
            onClick={
              bundle.goals.some((x) => x.mine)
                ? () => nav(togetherPaths.bundleEdit(bundle.id))
                : undefined
            }
          />
        )}
        {/* 아직 안 들어간 묶음(상대가 만듦): 들어가기(20 W-10 0c, 2026-11-14 H1) */}
        {bundle && !bundle.goals.some((x) => x.mine) && !d.pending && (
          <Button
            variant="secondary"
            block
            onClick={() => nav(togetherPaths.bundleJoin(bundle.id))}
          >
            {copy.bundleJoinCta}
          </Button>
        )}
        {/* 저금 위쪽(20 W-10, 2026-11-23 바탕 기준): 이름표 + 큰 금액 + 막대 + 한 줄(목표 금액의 %). 아래 항목 줄(기한, 매달 모으는 금액,
          목표 금액, 이번 달)은 줄마다 누르면 고치는 화면. 월 필요액·예상·‘매달 금액 바꾸기’만 ‘자세히 보기’ 아래. 묶인 저금은 이 위쪽 없이
          묶음 카드 한 장(합계 + ‘내 몫’ 한 줄, 2026-11-16) */}
        {!hideAmounts && !g.bundle_id && (
          <section className="hg-fdhero" aria-label={copy.savedLabel}>
            {/* 누르면 아래 모은 내역으로(20 W-10 2번) */}
            <button type="button" className="hg-fdhero__jump" onClick={toHistory}>
              <span className="hg-fdhero__label">{copy.savedLabel}</span>
              <span className="hg-fdhero__amt">{m(i.saved)}</span>
            </button>
            {showTarget && i.target !== null && (
              <>
                {i.state !== 'achieved' && (
                  <div
                    className="hg-fdhero__bar"
                    role="img"
                    aria-label={`${g.name} ${i.pct ?? 0}%`}
                  >
                    <i style={{ width: `${i.bar}%` }} />
                  </div>
                )}
                <p className="hg-fdhero__line">
                  {i.state === 'achieved'
                    ? copy.reachedAll(m(i.target))
                    : copy.targetOf(m(i.target), i.pct ?? 0)}
                  {i.state === 'achieved' && <Badge kind="achieved">{copy.achieved}</Badge>}
                </p>
              </>
            )}
            {showTarget && i.target === null && <p className="hg-fdhero__line">{copy.noTarget}</p>}
          </section>
        )}
        {!hideAmounts && !g.bundle_id && (
          <div className="hg-list hg-list--plain">
            {/* 기한: 있으면 날짜, 없으면 ‘정하기’. 아래 보조 줄 = 기한까지 남은 금액(같은 날짜를 두 번 쓰지 않음) */}
            {showTarget &&
              i.target !== null &&
              i.state !== 'achieved' &&
              (i.deadline || showEdit) && (
                <ListRow
                  label={copy.rowDeadline}
                  sub={i.deadline && remain ? copy.remainMore(m(remain.remain)) : undefined}
                  value={i.deadline ? formatYm(i.deadline) : copy.rowSet}
                  soft
                  onClick={
                    showEdit && !locked ? () => nav(savingPaths.edit(id, 'deadline')) : undefined
                  }
                />
              )}
            {!closed && (i.monthly > 0 || i.owner !== 'partner' || d.joint) && (
              <ListRow
                label={copy.rowMonthly}
                value={i.monthly === 0 && i.canEdit && !locked ? copy.rowSet : m(i.monthly)}
                soft
                onClick={
                  showEdit && !locked
                    ? () =>
                        nav(
                          i.monthly === 0 && i.canEdit ? splitTo : savingPaths.edit(id, 'monthly'),
                        )
                    : undefined
                }
              />
            )}
            {showTarget && (i.target !== null || showEdit) && (
              <ListRow
                label={copy.rowTarget}
                value={i.target !== null ? m(i.target) : copy.rowSet}
                soft
                onClick={
                  showEdit && !locked && i.state !== 'achieved'
                    ? () =>
                        nav(
                          i.target === null
                            ? `${savingPaths.edit(id, 'amount')}?first=1`
                            : savingPaths.edit(id, 'amount'),
                        )
                    : undefined
                }
              />
            )}
            {!closed && i.thisMonth && (
              <div className="hg-checklist__list">
                <CheckLine
                  line={i.thisMonth}
                  goalName={g.name}
                  name={copy.thisMonth}
                  personName={nameOf}
                  meId={d.meId}
                  entry="w10"
                  // W-02와 같은 상태 줄(2026-11-23 ‘바탕 정리 2’): 할 일은 오렌지 점 + ›, 끝남은 ✓. 줄을 누르면 줄 시트
                  sub=""
                  // 각자 모드 파트너 줄은 보기만(2026-11-03 대신 체크 없앰). 합쳐서는 공동 체크리스트라 누구나(D1)
                  viewOnly={i.owner === 'partner' && !d.joint}
                />
              </div>
            )}
          </div>
        )}
        {!hideAmounts &&
          !g.bundle_id &&
          showTarget &&
          i.target !== null &&
          i.state !== 'achieved' &&
          (i.need !== null || i.eta || (i.late !== null && showEdit)) && (
            <>
              <button
                type="button"
                className="hg-btn hg-btn--link hg-page__more"
                aria-expanded={more}
                aria-controls="w-10-more"
                onClick={() => setMore((x) => !x)}
              >
                {more ? copy.foldClose : copy.foldOpen}
                <Icon name={more ? 'chevron-up' : 'chevron-down'} size={16} />
              </button>
              {more && (
                <div id="w-10-more" className="hg-page__fold">
                  {i.need !== null && (
                    <span className="hg-page__foldline">
                      {together
                        ? copy.needPerMonthTogether(m(i.need), i.monthly ? m(i.monthly) : undefined)
                        : copy.needPerMonth(m(i.need), i.monthly ? m(i.monthly) : undefined)}
                    </span>
                  )}
                  {/* 예상(20 W-10 3a): “지금 속도면 …에 다 모아요” 한 번만 */}
                  {i.eta && (
                    <span className="hg-page__foldline">{copy.etaAt(formatYm(i.eta))}</span>
                  )}
                  {/* 월 필요액 > 매달 금액이면 할 일(2026-11-09, 배지 아님). 기한 바꾸기는 위 기한 줄에 */}
                  {i.late !== null && showEdit && (
                    <button
                      type="button"
                      className="hg-btn hg-btn--link"
                      style={{ alignSelf: 'flex-start' }}
                      disabled={locked}
                      onClick={() => nav(splitTo)}
                    >
                      {copy.changeMonthly}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        {/* 달성했는데 아직 고르지 않았으면 W-12a와 같은 질문(20 W-10 5번) */}
        {i.state === 'achieved' && i.canEdit && <AfterChoice item={i} />}
        {!hideAmounts && <div className="hg-page__band" aria-hidden="true" />}
        {!hideAmounts && (
          <section
            ref={historyRef}
            className="hg-page__section"
            aria-label={copy.history}
            style={{ scrollMarginTop: 'var(--space-6)' }}
          >
            <SectionHeader title={copy.history} />
            {/* 불러오는 중은 뼈대(빈 상태 문장이 먼저 보이지 않게, S7-03), 못 불러오면 다시 시도(S7-04) */}
            {lines.isLoading ? (
              <SkelRows
                rows={[
                  [120, 72],
                  [96, 72],
                ]}
              />
            ) : lines.isError && !lines.data ? (
              <section className="hg-card hg-card--fill hg-stack" role="status">
                <p className="hg-card__meta">{copy.loadFailed}</p>
                <button
                  type="button"
                  className="hg-btn hg-btn--link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => void lines.refetch()}
                >
                  {copy.retry}
                </button>
              </section>
            ) : history.length || g.start_saved > 0 ? (
              <div className="hg-list hg-list--plain">
                {(all ? history : history.slice(0, 12)).map((h) => (
                  <ListRow
                    key={h.key}
                    label={h.label}
                    sub={h.sub || undefined}
                    value={h.value}
                    onClick={h.to ? () => nav(h.to ?? '') : undefined}
                  />
                ))}
                {/* 시작할 때 모은 금액(2026-11-09): 기록의 처음이라 최근 것부터 보여 주는 목록 맨 아래, 더보기와 상관없이 늘 */}
                {g.start_saved > 0 && (
                  <ListRow
                    label={copy.historyStartName}
                    sub={formatDateFull(kstDay(g.created_at))}
                    value={`+${m(g.start_saved)}`}
                  />
                )}
              </div>
            ) : (
              <p className="hg-help hg-empty__line" style={{ margin: 0 }}>
                {copy.noHistory}
              </p>
            )}
            {!all && history.length > 12 && (
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
        {/* 정보(2026-11-23 바탕 기준): 라벨-값 두 줄 */}
        <div className="hg-page__band" aria-hidden="true" />
        <section className="hg-page__info" aria-label={copy.info}>
          <div className="hg-fdinfo">
            <span>{copy.createdOnLabel}</span>
            <span>{formatDateFull(kstDay(g.created_at))}</span>
          </div>
          {g.created_by && (
            <div className="hg-fdinfo">
              <span>{copy.createdByLabel}</span>
              <span>{g.created_by === d.meId ? copy.createdByMe : nameOf(g.created_by)}</span>
            </div>
          )}
        </section>
        <BundleAchieveWatch />
        {/* W-11 끝(20 W-11 고친 점): 각자 계열 연결이면 “{이름}님과 같이 모을까요?”, 미합류면 초대 */}
        {(ask === 'bundle' || ask === 'invite') && (
          <SavingAskSheet ask={ask} goalId={id} partnerName={d.partnerName} onClose={closeAsk} />
        )}
      </div>
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
