import {
  adminAddReview,
  adminRequestUser,
  adminSetLock,
  fetchAdminReviews,
  fetchAdminUsers,
  type AdminUserRow,
} from '@sweetwo/api';
import { formatKstDateTime, type AdminRole } from '@sweetwo/core';
import { Button, Chip, DataTable } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy, ops } from '../copy';
import { Frame, NoPermission } from '../frame';
import { useAdmin } from '../gate';
import { SysTabs } from '../sys-tabs';

const ROLES: AdminRole[] = ['super', 'ops', 'cs', 'analyst'];

// AD-18 관리자 계정(최고 관리자만): 표(ID, 역할, 마지막 접속, 2단계 인증, 잠금), 관리자 추가·역할 바꾸기(승인 요청),
// 잠금·풀기(본인 불가, 90일 미접속은 자동 잠금), 분기 점검 기록. 최고 관리자는 2명 이상 유지.
export function AD18Admins() {
  const me = useAdmin();
  const list = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
    enabled: me.roles.includes('super'),
  });
  const reviews = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: fetchAdminReviews,
    enabled: me.roles.includes('super'),
  });
  const [f, setF] = useState<{ email: string; name: string; roles: AdminRole[] }>({
    email: '',
    name: '',
    roles: ['cs'],
  });
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!me.roles.includes('super')) return <NoPermission />;
  const run = async (p: Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await p;
      setMsg(ok);
      void list.refetch();
      void reviews.refetch();
    } catch {
      setMsg(copy.failed);
    }
  };
  const toggle = (r: AdminRole) =>
    setF((x) => ({
      ...x,
      roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r],
    }));
  return (
    <Frame menu="system" title={ops.systemTitle}>
      <SysTabs current="admins" />
      {msg && (
        <p className="hg-help" role="status">
          {msg}
        </p>
      )}
      <div className="hg-admin__grid">
        <div className="hg-admin__col">
          <DataTable<AdminUserRow>
            label={ops.sysTabs.admins}
            rows={list.data ?? []}
            rowKey={(u) => u.email}
            columns={[
              { key: 'email', label: ops.adminCols.email, render: (u) => u.email },
              { key: 'name', label: ops.adminCols.name, render: (u) => u.name },
              {
                key: 'roles',
                label: ops.adminCols.roles,
                render: (u) => u.roles.map((r) => copy.roles[r]).join(', '),
              },
              {
                key: 'last',
                label: ops.adminCols.last,
                render: (u) =>
                  u.linked
                    ? u.last_seen_at
                      ? formatKstDateTime(u.last_seen_at)
                      : '—'
                    : ops.notLinked,
              },
              { key: 'mfa', label: ops.adminCols.mfa, render: (u) => (u.mfa ? ops.yes : ops.no) },
              {
                key: 'lock',
                label: ops.adminCols.locked,
                render: (u) =>
                  u.email === me.email ? (
                    u.locked ? (
                      ops.yes
                    ) : (
                      ops.no
                    )
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => void run(adminSetLock(u.email, !u.locked), ops.saved)}
                    >
                      {u.locked ? ops.unlock : ops.lock}
                    </Button>
                  ),
              },
            ]}
          />
          <DataTable
            label={ops.review}
            rows={reviews.data ?? []}
            rowKey={(r) => r.at}
            columns={[
              { key: 'at', label: copy.auditCols.at, render: (r) => formatKstDateTime(r.at) },
              { key: 'by', label: copy.auditCols.admin, render: (r) => r.by_email ?? '—' },
              { key: 'note', label: ops.reviewNote, render: (r) => r.note },
            ]}
          />
        </div>
        <div className="hg-admin__col">
          <section className="hg-card hg-stack" aria-label={ops.addAdmin}>
            <span className="hg-card__label">{ops.addAdmin}</span>
            <label className="hg-field">
              <span className="hg-field__label">{ops.adminCols.email}</span>
              <input
                className="hg-input"
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </label>
            <label className="hg-field">
              <span className="hg-field__label">{ops.adminCols.name}</span>
              <input
                className="hg-input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </label>
            <div
              className="hg-row"
              style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
              role="group"
              aria-label={ops.adminCols.roles}
            >
              {ROLES.map((r) => (
                <Chip key={r} small selected={f.roles.includes(r)} onClick={() => toggle(r)}>
                  {copy.roles[r]}
                </Chip>
              ))}
            </div>
            <Button
              variant="primary"
              disabled={!f.email.includes('@') || !f.name.trim() || !f.roles.length}
              onClick={() =>
                void run(adminRequestUser(f.email, f.name, f.roles), ops.requestedApproval)
              }
            >
              {ops.requestApproval}
            </Button>
          </section>
          <section className="hg-card hg-stack" aria-label={ops.review}>
            <label className="hg-field">
              <span className="hg-field__label">{ops.reviewNote}</span>
              <textarea
                className="hg-input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <Button
              variant="secondary"
              disabled={!note.trim()}
              onClick={() => void run(adminAddReview(note), ops.saved)}
            >
              {ops.addReview}
            </Button>
          </section>
        </div>
      </div>
    </Frame>
  );
}
