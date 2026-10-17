import {
  AdminError,
  adminDecide,
  fetchAdminApprovals,
  type AdminApprovalRow,
  type ApprovalStatus,
} from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button, DataTable, Tabs } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { copy, ops } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';
import { SysTabs } from '../sys-tabs';

// 2인 승인(33 2·3장, AdminFrame hg-approve): 요청 → 최고 관리자 승인(작성자 본인 불가) → 적용.
// 최고 관리자는 모든 요청, 나머지는 내가 낸 요청만 보고 취소할 수 있음.
export function AD18Approvals() {
  const me = useAdmin();
  const qc = useQueryClient();
  const superAdmin = me.roles.includes('super');
  const [status, setStatus] = useState<ApprovalStatus>('requested');
  const q = useQuery({
    queryKey: ['admin', 'approvals', status],
    queryFn: () => fetchAdminApprovals(status),
  });
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (r: AdminApprovalRow, d: 'approve' | 'reject' | 'cancel') => {
    setMsg(null);
    try {
      await adminDecide(r.id, d);
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      setMsg(
        e instanceof AdminError && e.code === 'self_approval' ? ops.selfApproval : copy.failed,
      );
    }
  };
  const mine = (r: AdminApprovalRow) => r.requested_by === me.email;
  return (
    <Frame menu="system" title={ops.systemTitle}>
      <SysTabs current="approvals" />
      <Tabs<ApprovalStatus>
        variant="seg"
        label={ops.sysTabs.approvals}
        items={(['requested', 'approved', 'rejected', 'cancelled'] as const).map((s) => ({
          value: s,
          label: ops.approvalStatus[s] ?? s,
        }))}
        value={status}
        onChange={setStatus}
      />
      {msg && (
        <p className="hg-help" role="status">
          {msg}
        </p>
      )}
      <DataTable<AdminApprovalRow>
        label={ops.sysTabs.approvals}
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        empty={q.isLoading ? null : ops.noApproval}
        columns={[
          { key: 'sum', label: ops.approvalCols.summary, render: (r) => r.summary },
          { key: 'by', label: ops.approvalCols.by, render: (r) => r.requested_by ?? '—' },
          {
            key: 'at',
            label: ops.approvalCols.at,
            render: (r) => formatKstDateTime(r.requested_at),
          },
          {
            key: 'act',
            label: ops.approvalCols.status,
            render: (r) =>
              r.status !== 'requested' ? (
                `${ops.approvalStatus[r.status] ?? r.status} ${r.decided_by ?? ''}`
              ) : (
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  {superAdmin && !mine(r) && (
                    <>
                      <Button variant="primary" size="sm" onClick={() => void decide(r, 'approve')}>
                        {ops.approve}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void decide(r, 'reject')}
                      >
                        {ops.reject}
                      </Button>
                    </>
                  )}
                  {mine(r) && (
                    <Button variant="secondary" size="sm" onClick={() => void decide(r, 'cancel')}>
                      {ops.cancelRequest}
                    </Button>
                  )}
                  {!superAdmin && !mine(r) && ops.approvalStatus.requested}
                </span>
              ),
          },
        ]}
      />
    </Frame>
  );
}
