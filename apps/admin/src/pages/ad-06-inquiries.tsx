import { fetchAdminInquiries, fetchAdminInquiryCounts, type InquiryStatus } from '@sweetwo/api';
import { hoursBetween } from '@sweetwo/core';
import { DataTable, Tabs } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';

const STATUSES: InquiryStatus[] = ['received', 'in_progress', 'waiting_user', 'done'];

// AD-06 문의 처리(MVP 간단 버전): 상태 탭 + 건수, 목록(문의 번호, 분류, 경과 시간) 오래된 순.
// 1영업일(24시간) 넘으면 경과 시간 강조. 행 → 상세.
export function AD06Inquiries() {
  const nav = useNavigate();
  const [status, setStatus] = useState<InquiryStatus>('received');
  const counts = useQuery({
    queryKey: ['admin', 'inquiry-counts'],
    queryFn: fetchAdminInquiryCounts,
  });
  const list = useQuery({
    queryKey: ['admin', 'inquiries', status],
    queryFn: () => fetchAdminInquiries(status),
  });
  return (
    <Frame menu="inquiries" title={copy.menus.inquiries}>
      <Tabs<InquiryStatus>
        label={copy.menus.inquiries}
        items={STATUSES.map((s) => ({
          value: s,
          label: `${copy.statuses[s]} ${counts.data?.[s] ?? 0}`,
        }))}
        value={status}
        onChange={setStatus}
      />
      <DataTable
        label={copy.statuses[status] ?? ''}
        rows={list.data ?? []}
        rowKey={(r) => r.id}
        onRow={(r) => nav(`/inquiries/${r.id}`)}
        empty={list.isLoading ? null : copy.noInquiry}
        columns={[
          { key: 'no', label: copy.inqCols.no, render: (r) => r.no },
          {
            key: 'cat',
            label: copy.inqCols.category,
            render: (r) => copy.categories[r.category] ?? r.category,
          },
          {
            key: 'ch',
            label: copy.inqCols.channel,
            render: (r) => copy.channels[r.channel] ?? r.channel,
          },
          {
            key: 'el',
            label: copy.inqCols.elapsed,
            num: true,
            render: (r) => {
              const h = hoursBetween(r.created_at);
              const t = copy.elapsed(h);
              return status !== 'done' && h >= 24 ? <b>{t}</b> : t;
            },
          },
        ]}
      />
    </Frame>
  );
}
