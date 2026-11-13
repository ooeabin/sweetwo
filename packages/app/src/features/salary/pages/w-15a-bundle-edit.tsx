import { leaveBundle, setBundleVisibility, updateBundle } from '@sweetwo/api';
import { defaultDeadline, formatYm, thisMonth, type YearMonth } from '@sweetwo/core';
import {
  AmountInput,
  ListRow,
  Modal,
  PageHeader,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
  Toggle,
  YearMonthInput,
} from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { money, useMask } from '../../../shared/mask';
import { carryToast, quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { savingPaths, togetherPaths } from '../paths';
import { useSavingItems } from '../saving';
import { refreshBundles, refreshSaving, useBundles, useTogetherRealtime } from '../together';

/**
 * W-15a 묶음 고치기(20 v2.2, R2·G1): 이름·목표 금액·기한(누구나 바로 고침 + 상대 알림, 서버), 토글 “각자 모은 금액 보여 주기”
 * (내 쪽만, 상대도 켜야 보임), “퍼센트만 보여 주기”(내 쪽만, 하나라도 켜면 둘 다 %, 목표 금액이 있을 때만), “묶음 풀기”(Modal,
 * 각자 저금은 그대로). W-10 묶음 카드 ⋯에서 열림
 */
export function W15aBundleEdit() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSavingItems();
  const bundles = useBundles();
  const { masked } = useMask();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  useTogetherRealtime(d.ready ? d.space.id : null);
  const back = () => (window.history.length > 1 ? nav(-1) : nav(savingPaths.list));
  if (bundles.isLoading || !d.ready) return <LoadingFrame current="salary" sub="detail" />;
  const b = bundles.data?.find((x) => x.id === id);
  const mine = b?.goals.find((g) => g.mine);
  if (!b || !mine) return <Navigate to={savingPaths.list} replace />;
  const vis = async (o: { showEach?: boolean; percentOnly?: boolean }) => {
    try {
      await setBundleVisibility(id, o);
      if (o.showEach !== undefined)
        track('bundle_show_each_toggled', {
          entry: 'w15a',
          has_target: b.pct !== null,
          on: o.showEach,
        });
      if (o.percentOnly !== undefined) track('bundle_percent_only_toggled', { on: o.percentOnly });
      await Promise.all([refreshBundles(qc), refreshSaving(qc)]);
    } catch {
      toast(copy.failed);
    }
  };
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveBundle(id);
      track('bundle_left', { entry: 'w15a', has_target: b.pct !== null, on: false });
      await Promise.all([refreshBundles(qc), refreshSaving(qc)]);
      carryToast(copy.bundleLeft);
      nav(savingPaths.item(mine.id), { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  // 목표 금액: 퍼센트만이면 서버가 금액을 보내지 않아 ‘%’만
  const targetText = b.percent_only
    ? `${b.pct ?? 0}%`
    : b.target !== null
      ? money(b.target, masked)
      : copy.bundleNone;
  const body = (
    <div key="l" className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.bundleEditTitle}
        backLabel={copy.back}
        backTo={b.name}
        onBack={back}
      />
      <div className="hg-list">
        <ListRow
          label={copy.bundleName}
          value={b.name}
          onClick={d.pending ? undefined : () => nav(togetherPaths.bundleField(id, 'name'))}
        />
        <ListRow
          label={copy.bundleTarget}
          value={targetText}
          onClick={
            d.pending || b.percent_only
              ? undefined
              : () => nav(togetherPaths.bundleField(id, 'target'))
          }
        />
        <ListRow
          label={copy.bundleDeadline}
          value={b.deadline ? formatYm(b.deadline) : copy.bundleNone}
          onClick={d.pending ? undefined : () => nav(togetherPaths.bundleField(id, 'deadline'))}
        />
      </div>
      <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
        <Toggle
          label={copy.showEach}
          help={copy.showEachHelp(d.partnerName)}
          checked={b.my_show_each}
          disabled={d.pending}
          onChange={(on) => vis({ showEach: on })}
        />
        <Toggle
          label={copy.percentOnly}
          help={b.pct === null ? copy.percentOnlyNoTarget : copy.percentOnlyHelp}
          checked={b.my_percent_only}
          disabled={d.pending || (b.pct === null && !b.my_percent_only)}
          onChange={(on) => vis({ percentOnly: on })}
        />
      </div>
      <button
        type="button"
        className="hg-btn hg-btn--danger-text"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => setLeaving(true)}
      >
        {copy.bundleLeave}
      </button>
      {leaving && (
        <Modal
          title={copy.bundleLeaveQ}
          body={copy.bundleLeaveBody}
          confirmLabel={copy.bundleLeaveOk}
          cancelLabel={copy.cancel}
          busy={busy}
          onConfirm={() => void leave()}
          onCancel={() => setLeaving(false)}
        />
      )}
    </div>
  );
  return <MainFrame sub="detail" current="salary" columns={[body]} />;
}

/** W-15a 이름·목표 금액·기한 한 칸 고치기(`/salary/bundles/:id/edit/:field`). 저장 = bundle_update + Toast ‘되돌리기’ */
export function W15aBundleField() {
  const { id = '', field = 'name' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const bundles = useBundles();
  const [name, setName] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null | undefined>(undefined);
  const [deadline, setDeadline] = useState<YearMonth | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  if (bundles.isLoading) return <QuestionSkeleton />;
  const b = bundles.data?.find((x) => x.id === id);
  if (!b || !['name', 'target', 'deadline'].includes(field))
    return <Navigate to={savingPaths.list} replace />;
  const f = field as 'name' | 'target' | 'deadline';
  const done = () => nav(togetherPaths.bundleEdit(id), { replace: true });
  const run = async (
    o: Parameters<typeof updateBundle>[1],
    undo: Parameters<typeof updateBundle>[1],
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateBundle(id, o);
      await refreshBundles(qc);
      carryToast(copy.bundleChanged(f), {
        label: copy.undo,
        onClick: () => quietly(updateBundle(id, undo).then(() => refreshBundles(qc))),
      });
      done();
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  if (f === 'name') {
    const v = name ?? b.name;
    return (
      <QuestionLayout
        title={copy.bundleNameQ}
        onBack={done}
        primary={{ label: copy.saveEdit, disabled: !v.trim(), loading: busy }}
        onSubmit={() => void run({ name: v.trim() }, { name: b.name })}
      >
        <ShortText label={copy.bundleNameQ} value={v} onChange={setName} max={20} />
      </QuestionLayout>
    );
  }
  if (f === 'target') {
    const v = target === undefined ? b.target : target;
    return (
      <QuestionLayout
        title={copy.bundleTargetQ}
        onBack={done}
        primary={{ label: copy.saveEdit, disabled: !v, loading: busy }}
        onSubmit={() => void run({ target: v }, { target: b.target })}
      >
        <AmountInput
          label={copy.bundleTargetQ}
          value={v}
          onChange={(x) => setTarget(x && x > 0 ? x : null)}
        />
      </QuestionLayout>
    );
  }
  const ym = deadline ?? (b.deadline?.slice(0, 7) as YearMonth | undefined) ?? defaultDeadline();
  const err = ym < thisMonth() ? copy.notBeforeThisMonth : undefined;
  return (
    <QuestionLayout
      title={copy.bundleDeadlineQ}
      onBack={done}
      primary={{ label: copy.saveEdit, disabled: !!err, loading: busy }}
      onSubmit={() =>
        void run({ deadline: ym }, b.deadline ? { deadline: b.deadline } : { clearDeadline: true })
      }
      later={
        b.deadline
          ? {
              label: copy.clearDeadline,
              onClick: () => void run({ clearDeadline: true }, { deadline: b.deadline }),
            }
          : undefined
      }
    >
      <YearMonthInput
        label={copy.bundleDeadlineQ}
        value={ym}
        onChange={(x) => setDeadline((x ?? undefined) as YearMonth | undefined)}
        error={err}
      />
    </QuestionLayout>
  );
}
