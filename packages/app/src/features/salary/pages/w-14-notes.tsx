import { markNotePaid, SavingAdjustBlocked, unpaySavingNote, updateSavingNote } from '@sweetwo/api';
import {
  amountBand as amountBandOf,
  formatMonthDay,
  todayKst,
  type SavingNoteRow,
} from '@sweetwo/core';
import { AddRow, BottomSheet, Button, ListRow, PageHeader, SkelRows } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { MoneyField } from '../bundle-parts';
import { copy } from '../copy';
import { salaryPaths, savingPaths, togetherPaths } from '../paths';
import { useSavingItems } from '../saving';
import { SavingLoadError } from '../saving-parts';
import { refreshSaving, useBundles, useSavingNotes, useTogetherRealtime } from '../together';

/** 메모 화면의 대상: 저금(goal) 또는 묶음(bundle) 하나 */
export function useNoteTarget(kind: 'goal' | 'bundle', id: string) {
  const d = useSavingItems();
  const bundles = useBundles();
  if (!d.ready) return { ready: false as const, d };
  if (kind === 'goal') {
    const i = d.byId(id);
    return {
      ready: true as const,
      d,
      found: !!i,
      name: i?.goal.name ?? '',
      canEdit: !!i?.canEdit,
      goalId: id,
      bundleId: undefined,
      back: savingPaths.item(id),
      noteTo: (note: string) => togetherPaths.note(id, note),
    };
  }
  const b = bundles.data?.find((x) => x.id === id);
  const mine = b?.goals.find((g) => g.mine);
  return {
    ready: !bundles.isLoading,
    d,
    found: !!b,
    name: b?.name ?? '',
    // 묶음 메모는 묶음에 든 사람이 고침(saving_note_editable), 해제 대기면 막음
    canEdit: !!mine && !d.pending,
    goalId: undefined,
    bundleId: id,
    back: mine ? savingPaths.item(mine.id) : salaryPaths.checklist,
    noteTo: (note: string) => togetherPaths.bundleNote(id, note),
  };
}

/**
 * W-14 쓸 곳 메모(20 v2.2, N7·F3): 저금(또는 묶음) 이름 + 메모 줄(항목, 예상 금액, 날짜, 오른쪽 ‘냈어요’).
 * ‘냈어요’ = 시트 “모은 금액에서 {금액} 뺄까요?”(Esc·닫기는 아무것도 안 바꿈) ‘뺄게요’ / ‘그대로 둘게요’, 금액이 없으면 금액 칸(시트).
 * ‘뺄게요’ = mark_note_paid(subtract) = 바로잡기 −(사유 “쓸 곳 메모: …”, 나만 봄). Toast ‘되돌리기’ = unpay_saving_note.
 * 날짜는 캘린더 금융 일정, D-7 알림(서버). “+ 메모 추가” → W-14a(고칠 수 있는 사람만)
 */
export function W14Notes({ kind }: { kind: 'goal' | 'bundle' }) {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const t = useNoteTarget(kind, id);
  const notes = useSavingNotes(kind === 'goal' ? { goalId: id } : { bundleId: id });
  const { masked } = useMask();
  const [paying, setPaying] = useState<SavingNoteRow | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useTogetherRealtime(t.d.ready ? t.d.space.id : null);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(salaryPaths.checklist));
  if (!t.d.ready && t.d.failed) return <SavingLoadError onBack={back} onRetry={t.d.retry} />;
  if (!t.ready) return <LoadingFrame current="salary" sub="detail" />;
  if (!t.found) return <Navigate to={salaryPaths.checklist} replace />;
  const m = (v: number) => money(v, masked);
  const pay = async (n: SavingNoteRow, subtract: boolean, amount: number | null) => {
    if (busy) return;
    setBusy(true);
    try {
      if (subtract && amount !== null && amount !== n.amount)
        await updateSavingNote(n.id, { amount });
      await markNotePaid(n.id, subtract && !!amount);
      const did = subtract && !!amount;
      track('saving_note_paid', { has_due: !!n.due_on, subtracted: did });
      if (did)
        track('saving_adjusted', {
          sign: 'minus',
          amount_band: amountBandOf(amount ?? 0),
          reason_code: 'note_paid',
          from: 'note_paid',
        });
      await refreshSaving(qc);
      toast(did ? copy.notePaidSubToast(m(amount ?? 0)) : copy.notePaidToast(n.name), {
        label: copy.undo,
        onClick: () => quietly(unpaySavingNote(n.id).then(() => refreshSaving(qc))),
      });
      setPaying(null);
    } catch (e) {
      toast(
        e instanceof SavingAdjustBlocked && e.reason === 'below_zero'
          ? copy.adjustOver
          : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  const list = notes.data ?? [];
  const today = todayKst();
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.notesTitle(t.name)}
        sub={copy.notesHelp}
        backLabel={copy.back}
        backTo={t.name}
        onBack={back}
      />
      {notes.isLoading ? (
        <SkelRows
          rows={[
            [120, 72],
            [96, 72],
          ]}
        />
      ) : notes.isError && !notes.data ? (
        <section className="hg-card hg-card--fill hg-stack" role="status">
          <p className="hg-card__meta">{copy.loadFailed}</p>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => void notes.refetch()}
          >
            {copy.retry}
          </button>
        </section>
      ) : list.length ? (
        <div className="hg-list">
          {list.map((n) => (
            // 오른쪽 ‘냈어요’는 줄 안쪽 여백만큼 띄우고 줄지 않게(카드 밖으로 넘치지 않음, 2026-11-14)
            <div
              key={n.id}
              className="hg-row"
              style={{ gap: 'var(--space-2)', paddingRight: 'var(--space-4)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <ListRow
                  label={n.name}
                  sub={[
                    // 날짜가 지났는데 안 낸 메모는 “12월 3일 지났어요”(사라지지 않음, 2026-11-14)
                    n.due_on
                      ? !n.paid && n.due_on < today
                        ? copy.noteOverdue(formatMonthDay(n.due_on))
                        : formatMonthDay(n.due_on)
                      : null,
                    n.amount !== null ? m(n.amount) : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  onClick={t.canEdit && !n.paid ? () => nav(t.noteTo(n.id)) : undefined}
                  value={n.paid ? copy.notePaidDone : undefined}
                />
              </div>
              {!n.paid && t.canEdit && (
                <span style={{ flex: 'none' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={copy.notePaidLabel(n.name)}
                    onClick={() => {
                      setPayAmount(n.amount);
                      setPaying(n);
                    }}
                  >
                    {copy.notePaid}
                  </Button>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="hg-help" style={{ margin: 0 }}>
          {copy.notesEmpty}
        </p>
      )}
      {t.canEdit && <AddRow label={copy.noteAdd} block onClick={() => nav(t.noteTo('new'))} />}
      {/* 금액이 있으면 “모은 금액에서 {금액} 뺄까요?”, 없으면 금액 칸(시트, 닫으면 아무것도 안 바뀜) */}
      {paying && (
        <BottomSheet
          title={paying.amount ? copy.notePayQ(m(paying.amount)) : copy.notePayAmountQ}
          onClose={() => setPaying(null)}
          actions={
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button block variant="secondary" onClick={() => void pay(paying, false, null)}>
                {copy.notePayKeep}
              </Button>
              <Button
                block
                variant="primary"
                loading={busy}
                disabled={!payAmount}
                onClick={() => void pay(paying, true, payAmount)}
              >
                {copy.notePaySub}
              </Button>
            </div>
          }
        >
          {!paying.amount && (
            <MoneyField label={copy.notePayAmountQ} value={payAmount} onChange={setPayAmount} />
          )}
        </BottomSheet>
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}
