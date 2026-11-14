import { deleteMoneyIn, fetchMoneyInPuts, fetchMoneyIns, qk, restoreMoneyIn } from '@sweetwo/api';
import { formatDateFull } from '@sweetwo/core';
import { ListRow, Menu, PageHeader, SkelRows } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useMe } from '../data';
import { savingPaths, togetherPaths } from '../paths';
import { refreshMoneyIn } from '../together';

/**
 * W-20b 들어온 돈 기록(20 v2.2 ‘고침 A’, 2026-11-14 M6): 내가 적은 돈 들어왔어요 기록(최근 받은 날부터).
 * 줄 = 금액 + “11월 14일, 상여, 저금 2개에 넣었어요”. 줄 ⋯ = ‘고치기’(W-20 같은 화면, 금액·종류·받은 날) / ‘지우기’
 * (묻지 않고 지움 + Toast ‘되돌리기’ = money_in_restore). 지우면 그 기록으로 저금에 넣은 금액도 빠짐(money_in_delete).
 * 입구: W-13 ⋯ ‘들어온 돈 기록’, W-20 아래 글자 버튼
 */
export function W20bMoneyInList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const { masked } = useMask();
  const ins = useQuery({ queryKey: qk.moneyIns, queryFn: () => fetchMoneyIns() });
  const puts = useQuery({ queryKey: qk.moneyInPuts, queryFn: fetchMoneyInPuts });
  const back = () => (window.history.length > 1 ? nav(-1) : nav(savingPaths.list));
  if (!me.data) return <LoadingFrame current="salary" sub="detail" />;
  const m = (v: number) => money(v, masked);
  const mine = (ins.data ?? []).filter((r) => r.owner_user_id === me.data?.id);
  const remove = async (id: string) => {
    const put = puts.data?.[id] ?? 0;
    try {
      await deleteMoneyIn(id);
      track('money_in_deleted', { distributed: put > 0 });
      await refreshMoneyIn(qc);
      toast(put > 0 ? copy.moneyInDeletedPut : copy.moneyInDeleted, {
        label: copy.undo,
        onClick: () => quietly(restoreMoneyIn(id).then(() => refreshMoneyIn(qc))),
      });
    } catch {
      toast(copy.failed);
    }
  };
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.moneyInList}
        backLabel={copy.back}
        backTo={copy.listTitle}
        onBack={back}
      />
      {ins.isLoading ? (
        <SkelRows
          rows={[
            [120, 72],
            [96, 72],
          ]}
        />
      ) : ins.isError && !ins.data ? (
        <section className="hg-card hg-card--fill hg-stack" role="status">
          <p className="hg-card__meta">{copy.loadFailed}</p>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => void ins.refetch()}
          >
            {copy.retry}
          </button>
        </section>
      ) : mine.length ? (
        <div className="hg-list">
          {mine.map((r) => {
            const put = puts.data?.[r.id] ?? 0;
            const sub = [formatDateFull(r.received_on), copy.moneyInKinds[r.kind]];
            if (put > 0) sub.push(copy.moneyInPutOf(m(put)));
            return (
              <div
                key={r.id}
                className="hg-row"
                style={{ gap: 'var(--space-2)', paddingRight: 'var(--space-2)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ListRow label={m(r.amount)} sub={sub.join(', ')} />
                </div>
                <Menu
                  label={copy.moneyInRowMenu(m(r.amount))}
                  actions={[
                    {
                      label: copy.moneyInEdit,
                      onSelect: () => nav(togetherPaths.moneyInEdit(r.id)),
                    },
                    { label: copy.moneyInDelete, danger: true, onSelect: () => void remove(r.id) },
                  ]}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.moneyInListEmpty}
        </p>
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
