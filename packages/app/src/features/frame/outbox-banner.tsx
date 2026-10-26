import { formatYm, readWon } from '@sweetwo/core';
import { Button, ConflictChoice } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  discardRejected,
  flushOutbox,
  hasOldOps,
  resolveOutboxConflict,
  retryRejected,
  useOutbox,
  type RejectReason,
} from '../../shared/outbox';
import { copy } from './copy';

// 오프라인 입력 대기열 표시와 보내기(30 동기화 4장, 13 공통 상태 9·11번).
// - 연결되면(켤 때, online 이벤트, 30초마다) 순서대로 보냄. 7일 넘게 기다린 입력이 있으면 목록 먼저 + ‘한 번에 보내기’
// - 보내지 못한 입력 {n}건 → 보기: 줄마다 다시 하기 / 버리기
// - 배우자가 그 뒤에 바꾼 칸: 충돌 선택 + “오프라인일 때 바꾼 값이 예빈님이 나중에 바꾼 값과 달라요”
export function useOutboxSync(meId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!meId) return;
    const go = () => {
      if (navigator.onLine && !hasOldOps()) void flushOutbox(qc, meId);
    };
    go();
    window.addEventListener('online', go);
    const t = setInterval(go, 30_000);
    return () => {
      window.removeEventListener('online', go);
      clearInterval(t);
    };
  }, [qc, meId]);
}

const show = (v: unknown, key: string) =>
  v === null || v === undefined
    ? '-'
    : key === 'deadline'
      ? formatYm(String(v))
      : typeof v === 'number'
        ? readWon(v)
        : String(v);

export function OutboxBanner({ meId, partnerName }: { meId: string; partnerName: string }) {
  const qc = useQueryClient();
  const ops = useOutbox((s) => s.ops);
  const rejected = useOutbox((s) => s.rejected);
  const conflicts = useOutbox((s) => s.conflicts);
  const sending = useOutbox((s) => s.sending);
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  const reason: Record<RejectReason, string> = {
    closed: copy.rejectClosed,
    gone: copy.rejectGone,
    denied: copy.rejectDenied,
  };
  const c = conflicts[0];
  const key = c
    ? (Object.keys(c.op.patch).find(
        (k) => k !== 'amount_estimated' && k !== 'deadline_estimated' && k !== 'estimated',
      ) ?? '')
    : '';
  return (
    <>
      {online && ops.length > 0 && hasOldOps() && (
        <div className="hg-banner hg-banner--info" role="status">
          <span>{copy.pending(ops.length)}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={sending}
            onClick={() => void flushOutbox(qc, meId)}
          >
            {copy.sendAll}
          </Button>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="hg-banner hg-banner--info" role="status">
          <span>{copy.rejected(rejected.length)}</span>
          <button
            type="button"
            className="hg-btn hg-btn--link"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {copy.rejectedShow}
          </button>
        </div>
      )}
      {open && rejected.length > 0 && (
        <div className="hg-list" role="list" aria-label={copy.rejected(rejected.length)}>
          {rejected.map((r) => (
            <div key={r.op.id} className="hg-listrow" role="listitem">
              <span />
              <span className="hg-listrow__text">
                <span className="hg-listrow__label">{r.op.label}</span>
                <span className="hg-listrow__sub">{reason[r.reason]}</span>
              </span>
              <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                <Button
                  size="sm"
                  onClick={() => {
                    retryRejected(r.op.id);
                    void flushOutbox(qc, meId);
                  }}
                >
                  {copy.retryInput}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => discardRejected(r.op.id)}>
                  {copy.discardInput}
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {c && (
        <ConflictChoice
          title={copy.conflictQ}
          body={`${c.op.label}: ${copy.conflictBody(partnerName)}`}
          sub={copy.conflictOffline(partnerName)}
          mine={{ label: copy.conflictMine, value: show(c.op.patch[key as never], key) }}
          theirs={{ label: copy.conflictTheirs(partnerName), value: show(c.current[key], key) }}
          onMine={() => void resolveOutboxConflict(qc, c.op.id, true)}
          onTheirs={() => void resolveOutboxConflict(qc, c.op.id, false)}
        />
      )}
    </>
  );
}
