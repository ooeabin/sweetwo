import { achieveGoal, qk } from '@sweetwo/api';
import { reachedTarget } from '@sweetwo/core';
import { Badge, Lead, leadOf, ListRow, PageHeader, QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sharedCopy } from '../../shared/copy';
import { money, useMask } from '../../shared/mask';
import { hideToast } from '../../shared/toast';
import { MainFrame } from '../frame';
import { copy } from './copy';
import { savingPaths } from './paths';
import { useFirstSaving, useSavingItems, type SavingItem } from './saving';

/**
 * 저금 항목 줄(GoalRow, 홈 H-02와 저금 목록 W-13): 저금통 아이콘(goal 원, 진행 원 아님: %와 막대가 진행을 말함) + 이름(파트너 항목은 이름 칩) + 오른쪽 %(달성이면 ‘달성’ 배지)
 * + “2,700만 / 1억 5,000만 원” + 얇은 막대. 목표 금액이 없으면(W-13만) % 자리 비우고 “모은 금액 300만 원”, 막대 없음.
 */
export function SavingGoalRow({
  item: i,
  masked,
  onClick,
}: {
  item: SavingItem;
  masked: boolean;
  onClick: () => void;
}) {
  const m = (v: number) => money(v, masked);
  // 상대 ‘했어요만’ 저금: 이름 “개인 저금” + 이번 달 확인 여부만, 열지 않음(08 6장, 2026-11-13)
  if (i.private)
    return (
      <div className="hg-goalrow">
        <Lead {...leadOf('line', 'saving')} />
        <span className="hg-goalrow__name">
          {i.goal.name}
          {i.ownerName && <Badge kind="temp">{i.ownerName}</Badge>}
        </span>
        <span className="hg-goalrow__sub">
          {i.doneThisMonth ? copy.doneThisMonth : copy.notDoneYet}
        </span>
      </div>
    );
  return (
    <button type="button" className="hg-goalrow" onClick={onClick}>
      <Lead {...leadOf('line', 'saving')} />
      <span className="hg-goalrow__name">
        {i.goal.name}
        {i.owner === 'partner' && i.ownerName && <Badge kind="temp">{i.ownerName}</Badge>}
      </span>
      <span className="hg-goalrow__pct">
        {i.target === null ? null : i.state === 'achieved' ? (
          <Badge kind="achieved">{copy.achieved}</Badge>
        ) : (
          <>
            {i.pct ?? 0}
            <small>%</small>
          </>
        )}
      </span>
      <span className="hg-goalrow__sub">
        {i.target === null
          ? copy.listSaved(m(i.saved))
          : copy.itemProgress(m(i.saved), m(i.target))}
      </span>
      {i.target !== null && i.state !== 'achieved' && (
        <span className="hg-goalrow__bar" aria-hidden="true">
          <i style={{ width: `${i.bar}%` }} />
        </span>
      )}
    </button>
  );
}

/**
 * 저금 줄 보조 줄(20 W-02 4번): “2,700만 / 1억 5,000만 원”. 목표 금액이 없으면 없음.
 * 진행은 줄 앞 진행 원(LineLead, 2026-11-09 줄 아래 얇은 막대 대신, 줄 높이가 다른 줄과 같게)
 */
export function SavingMeta({ item, masked }: { item: SavingItem | undefined; masked: boolean }) {
  if (!item || item.target === null) return null;
  return <>{copy.itemProgress(money(item.saved, masked), money(item.target, masked))}</>;
}

/**
 * 첫 저금 빈 줄(2026-11-09, 20 ‘첫 저금’): 내 저금이 없을 때 체크리스트 저금 묶음 자리에 “+ 저금 추가 (여유 자금 {n})” → W-11a.
 * 파트너가 묶음에 안 든 저금이 있으면(각자) 제목 “{파트너}님 ‘결혼 비용’에 같이 모을까요?” + 보조 “여유 자금 {n}” → W-15.
 * 홈 H-03과 W-02에서 씀(H-02 회색 제안 문장 대신). 보여 줄 때가 아니면 null
 */
export function FirstSavingRow({
  from,
  go,
}: {
  from: 'home' | 'salary';
  go: (to: string) => void;
}) {
  const f = useFirstSaving();
  const { masked } = useMask();
  if (!f.show) return null;
  const left = money(f.left, masked);
  return (
    <div className="hg-list">
      <ListRow
        icon="plus"
        label={
          f.partnerGoal
            ? copy.firstSavingTogether(f.partnerName ?? '', f.partnerGoal.name)
            : copy.firstSaving(left)
        }
        sub={f.partnerGoal ? copy.firstSavingLeft(left) : undefined}
        chevron={false}
        onClick={() =>
          go(
            f.partnerGoal
              ? `/salary/bundles/new?goal=${encodeURIComponent(f.partnerGoal.id)}`
              : `${savingPaths.add}/a?from=${from}`,
          )
        }
      />
    </div>
  );
}

/**
 * 달성 지켜보기(20 W-12): 고칠 수 있는 저금 항목의 모은 금액(서버 goal_saved_sums) ≥ 목표 금액이 되면 서버에 달성 표시(achieve_goal)하고,
 * 이 사람이 처음이면 축하 화면으로. 합쳐서 모드 다른 사람은 다음에 앱을 열 때 한 번. 파트너 저금 항목(각자)은 알림만.
 * 홈, 월급 탭(W-02), 월급 전 확인(W-05, 2026-11-12 S6-09), 저금 상세에 붙음. 축하로 넘어갈 때 떠 있는 Toast(체크 ‘되돌리기’)를 닫음. 그 전에 되돌리거나
 * 다른 곳에서 체크를 풀어 모은 금액이 목표 금액 아래로 내려가면 서버(check_pay_line)가 달성을 되돌림.
 */
export function AchieveWatch({ from }: { from?: 'checklist' } = {}) {
  const d = useSavingItems();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tried = useRef(new Set<string>());
  // 한 번에 하나만(2026-11-09 round 3 ‘모두 보냈어요’로 여러 항목이 한 번에 닿을 때): 축하로 넘어가는 동안 다른 항목을
  // 서버에 ‘봄’으로 남기지 않음. 남은 항목은 다음에 홈·월급 탭을 열 때 한 번씩
  const inflight = useRef(false);
  const [tick, setTick] = useState(0);
  const meId = d.ready ? d.meId : null;
  const items = useRef<SavingItem[] | null>(null);
  items.current = d.ready ? d.live : null;
  // 상태·모은 금액이 바뀔 때만 다시 봄
  const key = (items.current ?? [])
    .map((i) => `${i.goal.id}:${i.goal.status}:${i.saved}:${(i.goal.achieved_seen ?? []).length}`)
    .join('|');
  useEffect(() => {
    const list = items.current;
    if (!meId || !list || inflight.current) return;
    // 체크를 풀어 목표 금액 아래로 내려가면 서버가 ‘모으는 중’으로 되돌림(2026-11-09). 다시 닿으면 또 축하.
    // 상태를 다시 읽기 전에 모은 금액이 먼저 내려와도 잊음(2026-11-12 S6-04: 같은 화면에서 바로 다시 체크)
    for (const i of list)
      if (i.goal.target_amount !== null && i.saved < i.goal.target_amount)
        tried.current.delete(i.goal.id);
    const next = list.find(
      (i) =>
        i.canEdit &&
        !tried.current.has(i.goal.id) &&
        (reachedTarget(i.goal, i.saved) ||
          (i.state === 'achieved' && !(i.goal.achieved_seen ?? []).includes(meId))),
    );
    if (!next) return;
    tried.current.add(next.goal.id);
    inflight.current = true;
    void achieveGoal(next.goal.id)
      .then(async (show) => {
        if (!show) {
          inflight.current = false;
          await qc.invalidateQueries({ queryKey: qk.goals });
          setTick((x) => x + 1);
          return;
        }
        // 축하 화면 위에 체크 ‘되돌리기’ 토스트가 남지 않게 닫고 넘어감(2026-11-09)
        hideToast(1500);
        // 체크리스트(W-02·W-05)에서 닿았으면 W-12a 뒤 W-02로 돌아옴(2026-11-12 S6-09)
        nav(`${savingPaths.achieved(next.goal.id)}${from ? `?from=${from}` : ''}`);
        void qc.invalidateQueries({ queryKey: qk.goals });
      })
      .catch(() => {
        inflight.current = false;
        setTick((x) => x + 1);
      });
  }, [meId, key, tick, nav, qc, from]);
  return null;
}

/**
 * 저금 화면을 못 불러옴(13 공통 상태 7번, 2026-11-12 QA 7구간 S7-04): W-10·W-13 = ‘‹ 저금’ 머리 + 오류 카드
 * “잠시 문제가 생겼어요” + ‘다시 시도’(월급 탭 SalaryLoadError와 같은 모양)
 */
export function SavingLoadError({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <MainFrame
      sub="detail"
      current="salary"
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
          <PageHeader
            title={copy.listTitle}
            backLabel={copy.back}
            backTo={copy.tabTitle}
            onBack={onBack}
          />
          <section className="hg-card hg-card--fill hg-stack" role="status">
            <p className="hg-card__title">{sharedCopy.errorTitle}</p>
            <p className="hg-card__meta">{sharedCopy.errorBody}</p>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              style={{ alignSelf: 'flex-start' }}
              onClick={onRetry}
            >
              {sharedCopy.retry}
            </button>
          </section>
        </div>,
      ]}
    />
  );
}

/** 질문 화면(W-10a, W-12, W-12a)을 못 불러옴(S7-04): W-05와 같은 오류 질문 화면 + ‘다시 시도’ */
export function SavingQuestionError({
  onBack,
  onRetry,
}: {
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <QuestionLayout
      title={sharedCopy.errorTitle}
      help={sharedCopy.errorBody}
      onBack={onBack}
      primary={{ label: sharedCopy.retry }}
      onSubmit={onRetry}
    />
  );
}
