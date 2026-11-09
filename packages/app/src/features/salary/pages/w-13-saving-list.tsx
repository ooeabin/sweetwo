import { Icon, ListRow, PageHeader } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSplits } from '../data';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingGoalRow } from '../saving-parts';

const ENTRIES = ['checklist', 'split', 'home'] as const;
type Entry = (typeof ENTRIES)[number] | 'direct';

// W-13 저금 목록(20, 2026-11-09 round 3): 월급 탭 저금 전체를 한곳에서. W-02·W-01 저금 묶음 머리, 홈 H-02 ‘전체 보기’에서 열림.
// 줄 = 홈 H-02와 같은 GoalRow(모은 금액 포함, 목표 금액이 없는 저금도). 순서 내 것 → 파트너 것(각자, 이름 칩, 보기만) → 우리 둘 것.
// 아래 ‘+ 저금 추가’(내 월급 계획이 있고 해제 대기가 아닐 때) → W-11a, 맨 아래 접힌 “그만 모은 저금 n개”(W-01 8번과 같음) → W-10.
export function W13SavingList() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const d = useSavingItems();
  const splits = useSplits();
  const { masked } = useMask();
  const [fold, setFold] = useState(false);
  const from = params.get('from');
  const entry: Entry = (ENTRIES as readonly string[]).includes(from ?? '')
    ? (from as Entry)
    : 'direct';
  const ready = d.ready;
  const count = d.ready ? d.live.length : 0;
  useEffect(() => {
    if (ready) track('saving_list_viewed', { entry, items_count: count });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  if (!d.ready) return <LoadingFrame current="salary" sub="detail" />;
  // 추가는 내(합쳐서면 공동) 월급 계획이 있고 해제 대기가 아닐 때만(20 W-11 예외)
  const mine = (splits.data ?? []).some((x) =>
    d.joint ? x.owner_user_id === null : x.owner_user_id === d.meId,
  );
  const canAdd = mine && !d.pending;
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.listTitle}
        backLabel={copy.back}
        backTo={copy.tabTitle}
        onBack={back}
      />
      {d.live.length ? (
        <div className="hg-card hg-goallist">
          {d.live.map((i) => (
            <SavingGoalRow
              key={i.goal.id}
              item={i}
              masked={masked}
              onClick={() => nav(savingPaths.item(i.goal.id))}
            />
          ))}
        </div>
      ) : (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.listEmpty}
        </p>
      )}
      {canAdd && (
        <div className="hg-list">
          <ListRow
            icon="plus"
            label={copy.listAdd}
            chevron={false}
            onClick={() => nav(`${savingPaths.add}/a?from=list`)}
          />
        </div>
      )}
      {d.closed.length > 0 && (
        <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="hg-foldrow"
            aria-expanded={fold}
            onClick={() => setFold((x) => !x)}
          >
            <span>{copy.closedFold(d.closed.length)}</span>
            <Icon name={fold ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {fold && (
            <div className="hg-list">
              {d.closed.map((i) => (
                <ListRow
                  key={i.goal.id}
                  label={i.goal.name}
                  value={money(i.saved, masked)}
                  onClick={() => nav(savingPaths.item(i.goal.id))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
