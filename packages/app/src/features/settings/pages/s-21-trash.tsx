import {
  fetchTrash,
  purgeTrash,
  qk,
  restoreTrash,
  trashAsset,
  trashCareDay,
  trashGoals,
  type TrashRow,
} from '@sweetwo/api';
import { daysBetween, formatMonthDay, todayKst } from '@sweetwo/core';
import { Badge, Button, EmptyState, IconButton, Menu, Modal, PageHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { quietly, toast } from '../../../shared/toast';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-21 휴지통(docs/spec/25-settings.md): 지운 지 30일 안의 내 명의·공동 항목(자산·부채, 저금 항목, 가족, 경조사), 최근 지운 순.
// 되살리기는 묻지 않고 바로 + Toast “되살렸어요”(같이 지워진 것도 함께, 서버). 파트너의 저금 항목은 안 보임.
// 영구 삭제(⋯)와 비우기만 Modal. 30일 지나면 서버가 매일 자동 영구 삭제.
// 2026-11-12 QA 11구간: 오프라인이면 영구 삭제·비우기 비활성(S11-10), 연결 대상이 없어 따로 되살렸으면
// “연결된 항목이 없어 따로 되살렸어요”, 분석 trash_restored(entry trash, S11-06).
export function S21Trash() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const list = useQuery({ queryKey: qk.trash, queryFn: fetchTrash });
  const [confirm, setConfirm] = useState<TrashRow | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const online = useOnline();
  if (d.loading || !d.me || !d.c || !d.space || list.isLoading)
    return <LoadingFrame sub="settings" current={null} />;
  const rows = list.data ?? [];
  const today = todayKst();
  const c = d.c;
  const refresh = () =>
    Promise.all(
      [qk.trash, qk.assets, qk.goals, qk.careDays, qk.splits].map((k) =>
        qc.invalidateQueries({ queryKey: k }),
      ),
    );
  const restore = async (r: TrashRow) => {
    if (busy) return;
    setBusy(true);
    setRestoring(r.id);
    try {
      const result = await restoreTrash(r.kind, r.id);
      track('trash_restored', {
        item_type: r.kind,
        days_in_trash: daysBetween(todayKst(new Date(r.deletedAt)), todayKst()),
        relinked: result === 'restored',
        entry: 'trash',
      });
      await refresh();
      // 되살리기 Toast ‘되돌리기’ = 다시 휴지통으로(25 S-21 3번)
      toast(result === 'unlinked' ? copy.restoredUnlinked : copy.restored, {
        label: copy.undo,
        onClick: () =>
          quietly(
            (r.kind === 'asset'
              ? trashAsset(r.id)
              : r.kind === 'goal'
                ? trashGoals([r.id])
                : trashCareDay(r.id)
            ).then(refresh),
          ),
      });
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
      setRestoring(null);
    }
  };
  const purge = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      if (confirm === 'all') await purgeTrash();
      else await purgeTrash(confirm.kind, confirm.id);
      setConfirm(null);
      toast(copy.purged);
      await refresh();
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const who = (id: string | null) => (id === d.me?.id ? c.myName : id ? c.partnerName : '');
  const kindLabel = (r: TrashRow) =>
    copy.trashKinds[r.kind === 'asset' ? (r.sub ?? 'asset') : r.kind];

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.trash}
        backLabel={copy.back}
        backTo={copy.data}
        onBack={() => nav('/settings/data')}
      />
      {rows.length === 0 ? (
        <EmptyState title={copy.trashEmpty} />
      ) : (
        <>
          <p className="hg-q__help">{copy.trashNote}</p>
          <div className="hg-list">
            {rows.map((r) => {
              const day = todayKst(new Date(r.deletedAt));
              const left = Math.max(0, 30 - daysBetween(day, today));
              const name = who(r.deletedBy);
              return (
                <div key={r.kind + r.id} className="hg-listrow" style={{ cursor: 'default' }}>
                  <span className="hg-avatars" aria-hidden="true">
                    {name && (
                      <span
                        className={
                          (r.deletedBy === d.me?.id) === c.starter
                            ? 'hg-avatar hg-avatar--p1'
                            : 'hg-avatar hg-avatar--p2'
                        }
                      >
                        {[...name][0] ?? ''}
                      </span>
                    )}
                  </span>
                  <span className="hg-listrow__text">
                    <span className="hg-listrow__label">
                      {r.name} <Badge kind="temp">{kindLabel(r)}</Badge>
                    </span>
                    <span className="hg-listrow__sub">
                      {copy.trashWhen(formatMonthDay(day))}{' '}
                      <span className="hg-q__help">{copy.trashLeft(left)}</span>
                    </span>
                  </span>
                  <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={restoring === r.id}
                      onClick={() => void restore(r)}
                    >
                      {copy.restore}
                    </Button>
                  </span>
                  {online ? (
                    <Menu
                      label={`${r.name} ${copy.more}`}
                      actions={[{ label: copy.purge, danger: true, onSelect: () => setConfirm(r) }]}
                    />
                  ) : (
                    // 오프라인: 영구 삭제(⋯의 하나뿐인 동작) 비활성
                    <IconButton icon="ellipsis" label={`${r.name} ${copy.more}`} ghost disabled />
                  )}
                </div>
              );
            })}
          </div>
          <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            {!online && <p className="hg-q__help">{copy.needOnline}</p>}
            <div className="hg-row">
              <Button
                variant="secondary"
                disabled={busy || !online}
                onClick={() => setConfirm('all')}
              >
                {copy.emptyTrash}
              </Button>
            </div>
          </div>
        </>
      )}
      {confirm && (
        <Modal
          title={confirm === 'all' ? copy.emptyQ(rows.length) : copy.purgeQ}
          body={copy.purgeBody}
          confirmLabel={copy.purgeYes}
          cancelLabel={copy.cancel}
          busy={busy}
          onConfirm={() => void purge()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
  return <MainFrame sub="settings" current={null} columns={[body]} />;
}
