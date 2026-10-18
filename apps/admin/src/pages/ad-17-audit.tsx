import { fetchAdminAudit, type AdminAuditRow } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button, DataTable } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

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
  const row = q.data?.find((r) => r.id === open) ?? null;

  return (
    <Frame menu="system" title={copy.auditTitle}>
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
      {row && (
        <section
          className="hg-card hg-stack"
          aria-label={`${formatKstDateTime(row.at)} ${row.action}`}
        >
          <span>
            {copy.ip}: {row.ip || '—'}
          </span>
          <span>
            {copy.screen}: {row.screen}
          </span>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(row.detail, null, 2)}
          </pre>
        </section>
      )}
    </Frame>
  );
}
