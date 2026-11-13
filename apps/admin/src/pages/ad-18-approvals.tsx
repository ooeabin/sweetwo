import {
  AdminError,
  adminDecide,
  fetchAdminApprovals,
  type AdminApprovalRow,
  type ApprovalStatus,
} from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { DataTable, Status, Tabs } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../act';
import { copy, ops } from '../copy';
import { decisionTone } from '../tones';
import { Frame } from '../frame';
import { useToast } from '../toast';
import { useAdmin } from '../gate';
import { useReauth } from '../reauth';
import { SysTabs } from '../sys-tabs';

// 승인(33 2·3장, AdminFrame hg-approve): 요청 → 최고 관리자 승인(2026-11-06부터 요청한 본인도 승인 가능) → 적용.
// 최고 관리자는 모든 요청, 나머지는 내가 낸 요청만 보고 취소할 수 있음.
export function AD18Approvals() {
  const me = useAdmin();
  const qc = useQueryClient();
  const reauth = useReauth();
  const superAdmin = me.roles.includes('super');
  const [status, setStatus] = useState<ApprovalStatus>('requested');
  const q = useQuery({
    queryKey: ['admin', 'approvals', status],
    queryFn: () => fetchAdminApprovals(status),
  });
  const setMsg = useToast();
  const decide = async (r: AdminApprovalRow, d: 'approve' | 'reject' | 'cancel') => {
    setMsg(null);
    try {
      await (d === 'cancel' ? adminDecide(r.id, d) : reauth(() => adminDecide(r.id, d)));
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      setMsg(
        e instanceof AdminError && e.code === 'reauth_cancelled'
          ? null
          : e instanceof AdminError && e.code === 'super_min'
            ? ops.superMin
            : copy.failed,
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
      <DataTable<AdminApprovalRow>
        label={ops.sysTabs.approvals}
        rows={q.data ?? []}
        loading={q.isLoading}
        rowKey={(r) => r.id}
        empty={ops.noApproval}
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
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  <Status tone={decisionTone[r.status] ?? 'off'}>
                    {ops.approvalStatus[r.status] ?? r.status}
                  </Status>
                  {r.decided_by && <span className="hg-card__meta">{r.decided_by}</span>}
                </span>
              ) : (
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  {superAdmin && (
                    <>
                      <Button variant="primary" size="sm" onAct={() => decide(r, 'approve')}>
                        {ops.approve}
                      </Button>
                      <Button variant="secondary" size="sm" onAct={() => decide(r, 'reject')}>
                        {ops.reject}
                      </Button>
                    </>
                  )}
                  {mine(r) && (
                    <Button variant="secondary" size="sm" onAct={() => decide(r, 'cancel')}>
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
