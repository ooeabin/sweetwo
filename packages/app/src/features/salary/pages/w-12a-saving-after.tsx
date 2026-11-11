import {
  keepSavingItem,
  qk,
  reopenSavingItem,
  stopSavingItem,
  unkeepSavingItem,
} from '@sweetwo/api';
import { ChoiceCards, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { salaryPaths, savingPaths } from '../paths';
import { useSavingItems, type SavingItem } from '../saving';

type After = 'keep' | 'stop' | 'retarget';

/** 선택지(2026-11-09 round 3): 보조 한 줄씩, 셋째 ‘목표 금액을 새로 정할게요’ = 저장하지 않고 W-10a 새 목표 금액으로 */
const OPTIONS: { value: After; label: string; sub: string }[] = [
  { value: 'keep', label: copy.afterKeep, sub: copy.afterKeepSub },
  { value: 'stop', label: copy.afterStop, sub: copy.afterStopSub },
  { value: 'retarget', label: copy.afterRetarget, sub: copy.afterRetargetSub },
];

/**
 * W-12a 달성 뒤(20): “이 저금 항목을 어떻게 할까요?” ‘계속 모을게요’(목표 금액·기한만 지우고 줄은 그대로) /
 * ‘그만할게요’(월급 계획에서 줄을 빼고 기록만 남김). 둘 다 바로 저장 + Toast ‘되돌리기’. 상대 알림은 서버(우리 둘 항목만)
 */
function useAfter(item: SavingItem) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    Promise.all(
      [qk.goals, qk.splits, ['pay_checklist'], qk.goalSaved].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  const choose = async (v: After) => {
    if (busy) return false;
    // 새 목표 금액: 여기서는 저장하지 않고 W-10a로(저장·되돌리기·분석은 그 화면)
    if (v === 'retarget') {
      nav(`${savingPaths.edit(item.goal.id, 'amount')}?retarget=1`);
      return false;
    }
    setBusy(true);
    const g = item.goal;
    try {
      if (v === 'keep') {
        await keepSavingItem(g.id);
        carryToast(copy.keptToast, {
          label: copy.undo,
          onClick: () =>
            quietly(
              unkeepSavingItem(g.id, g.target_amount ?? 0, g.deadline?.slice(0, 10) ?? null).then(
                refresh,
              ),
            ),
        });
      } else {
        await stopSavingItem(g.id);
        carryToast(copy.stoppedToast, {
          label: copy.undo,
          onClick: () => quietly(reopenSavingItem(g.id).then(refresh)),
        });
      }
      track('saving_item_after_achieve', { choice: v });
      await refresh();
      return true;
    } catch {
      toast(copy.failed, { label: copy.retry, onClick: () => void choose(v) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, choose };
}

/** W-10 5번: 달성했는데 아직 고르지 않았으면 같은 질문 카드 */
export function AfterChoice({ item }: { item: SavingItem }) {
  const a = useAfter(item);
  return (
    <section className="hg-goalbox" aria-label={copy.afterQ}>
      <div className="hg-goalbox__head">
        <b>{copy.afterQ}</b>
      </div>
      <ChoiceCards<After>
        label={copy.afterQ}
        value={null}
        onChange={(v) => void a.choose(v)}
        autoAdvance={false}
        autoFocus={false}
        shortcuts={false}
        options={OPTIONS}
      />
    </section>
  );
}

export function W12aSavingAfter() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useSavingItems();
  const i = d.ready ? d.byId(id) : undefined;
  if (!d.ready) return <QuestionSkeleton title={copy.afterQ} />;
  if (!i) return <Navigate to={salaryPaths.checklist} replace />;
  // 이미 골랐거나 고칠 수 없으면 상세로
  if (i.state !== 'achieved' || !i.canEdit) return <Navigate to={savingPaths.item(id)} replace />;
  return <AfterPage item={i} onDone={() => nav(savingPaths.item(id), { replace: true })} />;
}

function AfterPage({ item, onDone }: { item: SavingItem; onDone: () => void }) {
  const a = useAfter(item);
  const [v, setV] = useState<After | null>(null);
  return (
    <QuestionLayout title={copy.afterQ} onBack={onDone}>
      <ChoiceCards<After>
        label={copy.afterQ}
        value={v}
        onChange={setV}
        onPick={(x) => void a.choose(x).then((ok) => ok && onDone())}
        options={OPTIONS}
      />
    </QuestionLayout>
  );
}
