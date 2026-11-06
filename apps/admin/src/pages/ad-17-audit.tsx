import { fetchAdminAudit, type AdminAuditRow } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button, DataTable } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';
import { SysTabs } from '../sys-tabs';

const ACTIONS = ['search', 'view', 'reveal', 'request', 'execute', 'approve', 'download', 'edit'];

// AD-17 감사 로그: 필터(관리자, 대상 ID, 동작, 기간), 표(시각, 관리자, 동작, 대상, 사유·변경, 승인자), 행을 누르면 펼침
// (접속 IP, 화면, 전·후 값). 추가만, 수정·삭제 없음. 최고 관리자 외에는 본인 기록만(관리자 필터 없음).
export function AD17Audit() {
  const me = useAdmin();
  const superAdmin = me.roles.includes('super');
  const [draft, setDraft] = useState({ admin: '', target: '', action: '', from: '', to: '' });
  const [f, setF] = useState(draft);
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['admin', 'audit', f],
    queryFn: () =>
      fetchAdminAudit({
        admin: f.admin || undefined,
        target: f.target || undefined,
        action: f.action || undefined,
        from: f.from ? `${f.from}T00:00:00+09:00` : undefined,
        to: f.to ? `${f.to}T24:00:00+09:00` : undefined,
      }),
  });
  const set = (k: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Frame menu="system" title={copy.auditTitle}>
      <SysTabs current="audit" />
      <form
        className="hg-row"
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          setF(draft);
        }}
      >
        {superAdmin && (
          <input
            className="hg-input"
            style={{ width: 200 }}
            aria-label={copy.filter.admin}
            placeholder={copy.filter.admin}
            value={draft.admin}
            onChange={set('admin')}
          />
        )}
        <input
          className="hg-input"
          style={{ width: 240 }}
          aria-label={copy.filter.target}
          placeholder={copy.filter.target}
          value={draft.target}
          onChange={set('target')}
        />
        <select
          className="hg-input"
          style={{ width: 140 }}
          aria-label={copy.filter.action}
          value={draft.action}
          onChange={set('action')}
        >
          <option value="">{copy.all}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {copy.auditActions[a]}
            </option>
          ))}
        </select>
        <input
          className="hg-input"
          style={{ width: 160 }}
          type="date"
          aria-label={copy.filter.from}
          value={draft.from}
          onChange={set('from')}
        />
        <input
          className="hg-input"
          style={{ width: 160 }}
          type="date"
          aria-label={copy.filter.to}
          value={draft.to}
          onChange={set('to')}
        />
        <Button variant="secondary" type="submit">
          {copy.see}
        </Button>
      </form>
      <DataTable<AdminAuditRow>
        label={copy.auditTitle}
        rows={q.data ?? []}
        rowKey={(r) => String(r.id)}
        onRow={(r) => setOpen(open === r.id ? null : r.id)}
        expanded={(r) =>
          r.id === open ? (
            <div
              className="hg-stack"
              style={{ gap: 0 }}
              aria-label={`${formatKstDateTime(r.at)} ${r.action}`}
            >
              <div className="hg-admin__kv">
                <span>{copy.ip}</span>
                <span>{r.ip || '—'}</span>
              </div>
              <div className="hg-admin__kv">
                <span>{copy.screen}</span>
                <span>{r.screen}</span>
              </div>
              {detailLines(r.detail).map(([k, v]) => (
                <div key={k} className="hg-admin__kv">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          ) : null
        }
        empty={q.isLoading ? null : copy.noAudit}
        columns={[
          { key: 'at', label: copy.auditCols.at, render: (r) => formatKstDateTime(r.at) },
          { key: 'admin', label: copy.auditCols.admin, render: (r) => r.admin_email ?? '—' },
          {
            key: 'action',
            label: copy.auditCols.action,
            render: (r) => copy.auditActions[r.action] ?? r.action,
          },
          { key: 'target', label: copy.auditCols.target, render: (r) => r.target ?? '—' },
          { key: 'reason', label: copy.auditCols.reason, render: (r) => r.reason ?? '—' },
          { key: 'approver', label: copy.auditCols.approver, render: (r) => r.approver ?? '—' },
        ]}
      />
    </Frame>
  );
}

// 행 상세: 설정 전·후 값을 한 줄씩(before/after는 “전 → 후”), 나머지는 키: 값
function detailLines(d: unknown): [string, string][] {
  if (!d || typeof d !== 'object') return [];
  const o = d as Record<string, unknown>;
  const show = (v: unknown) =>
    v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const out: [string, string][] = [];
  if ('before' in o || 'after' in o) {
    const obj = (v: unknown) =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    const b = obj(o.before);
    const a = obj(o.after);
    if ((b || o.before == null) && (a || o.after == null) && (b || a)) {
      const keys = new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
      for (const k of keys) out.push([k, `${show(b?.[k])} → ${show(a?.[k])}`]);
    } else out.push([copy.change, `${show(o.before)} → ${show(o.after)}`]);
  }
  for (const [k, v] of Object.entries(o))
    if (k !== 'before' && k !== 'after') out.push([k, show(v)]);
  return out;
}
