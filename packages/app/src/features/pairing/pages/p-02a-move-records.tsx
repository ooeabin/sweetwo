import {
  fetchAssets,
  fetchMe,
  fetchRecordCounts,
  joinMovingRecords,
  qk,
  type JoinResult,
} from '@sweetwo/api';
import { readWon } from '@sweetwo/core';
import { ListRow, QuestionLayout, SectionHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';

type Vis = 'all' | 'sum';

// P-02a 혼자 쓰던 기록 옮기기(18): 월급·월급날, 내 명의 자산·부채(공개 범위 한 번, 기본 금액만 보여 주기)만 옮김.
// 목표·분배표·체크리스트는 안 옮김(원래 공간은 30일 보관 후 지움, 합류 전에 ‘사본 내려받기’ → S-18).
// ‘다음’ = 옮기고 합류(서버 join_moving_records). 옮길 내 명의 값이 없으면 “옮길 정보가 없어요”.
export function P02aMoveRecords({
  code,
  onDone,
  onCancel,
}: {
  code: string;
  onDone: (r: JoinResult) => void;
  onCancel: () => void;
}) {
  const nav = useNavigate();
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const counts = useQuery({ queryKey: ['record-counts'], queryFn: fetchRecordCounts });
  const [vis, setVis] = useState<Record<string, Vis>>({});
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (me.isLoading || assets.isLoading || counts.isLoading || !me.data) return null;
  const m = me.data;
  const mine = (assets.data ?? []).filter(
    (a) => a.owner === 'person' && (a.owner_user_id ?? a.created_by) === m.id && !a.deleted_at,
  );
  const salary =
    m.monthly_income !== null
      ? copy.moveSalary(
          readWon(m.monthly_income),
          m.payday_last ? copy.paydayLast : m.payday ? copy.paydayDay(m.payday) : '-',
        )
      : null;
  const c = counts.data ?? { goals: 0, splits: 0, lists: 0 };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const all = Object.fromEntries(mine.map((a) => [a.id, vis[a.id] ?? 'sum'])) as Record<
        string,
        Vis
      >;
      onDone(await joinMovingRecords(code, all));
    } catch {
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void submit() });
    } finally {
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.moveTitle}
      onBack={onCancel}
      primary={{ label: copy.next, loading: busy }}
      onSubmit={() => void submit()}
    >
      {!salary && !mine.length ? (
        <p className="hg-q__help">{copy.moveNone}</p>
      ) : (
        <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
          {salary && (
            <div className="hg-list">
              <ListRow label={salary} chevron={false} />
            </div>
          )}
          {mine.map((a, i) => (
            <div
              key={a.id}
              className="hg-row"
              style={{ gap: 'var(--space-3)', alignItems: 'center' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {a.name} {readWon(a.amount)}
              </span>
              <label htmlFor={`${id}-${i}`} className="hg-sr">
                {copy.moveVisLabel(a.name)}
              </label>
              <select
                id={`${id}-${i}`}
                className="hg-input"
                style={{ flex: 1 }}
                value={vis[a.id] ?? 'sum'}
                onChange={(e) => setVis({ ...vis, [a.id]: e.target.value as Vis })}
              >
                {(['all', 'sum'] as Vis[]).map((v) => (
                  <option key={v} value={v}>
                    {copy.moveVis[v]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <SectionHeader title={copy.moveSkip} />
      <p className="hg-q__help" style={{ margin: 0 }}>
        {copy.moveSkipCounts(c.goals, c.splits, c.lists)}. {copy.moveKeep}
      </p>
      <button
        type="button"
        className="hg-btn hg-btn--link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => nav('/settings/data')}
      >
        {copy.moveCopy}
      </button>
    </QuestionLayout>
  );
}
